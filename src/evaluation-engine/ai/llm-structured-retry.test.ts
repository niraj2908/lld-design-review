import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  LLMConfigurationError,
  LLMRateLimitError,
  LLMResponseFormatError,
  LLMTimeoutError,
} from "@/application/ports/llm-provider";
import type { LLMProvider, LLMRequest, LLMResult } from "@/application/ports/llm-provider";
import {
  EXECUTION_BUDGET_MS,
  MIN_SAFE_RETRY_BUDGET_MS,
  NON_LLM_OVERHEAD_BUDGET_MS,
  STRUCTURED_OUTPUT_RETRY_NOTE,
  generateStructuredWithRetry,
} from "./llm-structured-retry";

const schema = z.object({ ok: z.boolean(), note: z.string().min(1) });

const request: LLMRequest = {
  promptVersion: "test-v1",
  system: "rules",
  user: "data",
  responseSchema: { type: "object" },
  schemaName: "test_schema",
  temperature: 0.2,
  maxOutputTokens: 128,
  timeoutMs: 1_000,
};

function result(output: unknown): LLMResult<unknown> {
  return { output, model: "fake-model", latencyMs: 5 };
}

/** Scripts a fixed sequence of outcomes, one per call, and records every request it was sent. */
class SequencedLLMProvider implements LLMProvider {
  readonly name = "fake-sequenced";
  readonly model = "fake-model";
  readonly requests: LLMRequest[] = [];
  private index = 0;

  constructor(
    private readonly steps: readonly (
      | { readonly kind: "output"; readonly value: unknown }
      | { readonly kind: "throw"; readonly error: Error }
    )[],
  ) {}

  async generateStructured(req: LLMRequest): Promise<LLMResult<unknown>> {
    this.requests.push(req);
    const step = this.steps[this.index];
    this.index += 1;
    if (step === undefined) {
      throw new Error("SequencedLLMProvider ran out of scripted steps — the code under test called it more times than expected.");
    }
    if (step.kind === "throw") {
      throw step.error;
    }
    return result(step.value);
  }

  get callCount(): number {
    return this.requests.length;
  }
}

/** `startedAt` far enough in the past that only `remainingMs` of the execution budget is left. */
function startedAtWithRemaining(remainingMs: number): number {
  return Date.now() - (EXECUTION_BUDGET_MS - NON_LLM_OVERHEAD_BUDGET_MS - remainingMs);
}

describe("generateStructuredWithRetry", () => {
  it("returns the first attempt's output and makes exactly one provider call when it already validates", async () => {
    const provider = new SequencedLLMProvider([{ kind: "output", value: { ok: true, note: "fine" } }]);

    const { output, attempt } = await generateStructuredWithRetry(provider, request, schema, "test");

    expect(output).toEqual({ ok: true, note: "fine" });
    expect(attempt).toBe("first");
    expect(provider.callCount).toBe(1);
  });

  it("retries once and succeeds when the first answer fails schema validation", async () => {
    const provider = new SequencedLLMProvider([
      { kind: "output", value: { ok: true, note: "" } }, // fails schema: note must be non-empty
      { kind: "output", value: { ok: true, note: "corrected" } },
    ]);

    const { output, attempt } = await generateStructuredWithRetry(provider, request, schema, "test");

    expect(output).toEqual({ ok: true, note: "corrected" });
    expect(attempt).toBe("retry");
    expect(provider.callCount).toBe(2);
    // The retry carries the same provider, model and base request, plus the
    // corrective note appended to the system prompt — nothing else changes.
    expect(provider.requests[1]?.system).toBe(`${request.system}\n${STRUCTURED_OUTPUT_RETRY_NOTE}`);
    expect(provider.requests[1]?.user).toBe(request.user);
    expect(provider.requests[0]?.system).toBe(request.system);
  });

  it("retries once and succeeds when the provider itself reports a structured-output rejection", async () => {
    const provider = new SequencedLLMProvider([
      { kind: "throw", error: new LLMResponseFormatError("provider rejected the generation as invalid JSON") },
      { kind: "output", value: { ok: true, note: "corrected" } },
    ]);

    const { output, attempt } = await generateStructuredWithRetry(provider, request, schema, "test");

    expect(output).toEqual({ ok: true, note: "corrected" });
    expect(attempt).toBe("retry");
    expect(provider.callCount).toBe(2);
  });

  it("fails cleanly, with the retry's own error, when both the first attempt and the retry fail validation", async () => {
    const provider = new SequencedLLMProvider([
      { kind: "output", value: { ok: true, note: "" } },
      { kind: "output", value: { ok: "not-a-boolean", note: "still wrong" } },
    ]);

    await expect(generateStructuredWithRetry(provider, request, schema, "test")).rejects.toThrow(
      LLMResponseFormatError,
    );
    expect(provider.callCount).toBe(2);
  });

  it("never invents or coerces a value: a doubly-failing answer is thrown, not patched into something valid", async () => {
    const provider = new SequencedLLMProvider([
      { kind: "output", value: { ok: true, note: "" } },
      { kind: "output", value: { ok: true, note: "" } },
    ]);

    await expect(generateStructuredWithRetry(provider, request, schema, "test")).rejects.toThrow(
      /note/u,
    );
  });

  it.each([
    ["a timeout", new LLMTimeoutError(1_000)],
    ["a rate limit", new LLMRateLimitError("rate limited")],
    ["a configuration error", new LLMConfigurationError("bad credentials")],
    ["a plain network error", new Error("ECONNRESET")],
  ])("never retries %s — exactly one call, the original error propagates", async (_label, error) => {
    const provider = new SequencedLLMProvider([{ kind: "throw", error }]);

    await expect(generateStructuredWithRetry(provider, request, schema, "test")).rejects.toBe(error);
    expect(provider.callCount).toBe(1);
  });

  it("is bounded to exactly one additional attempt — never a second retry, even on a schema failure again", async () => {
    const provider = new SequencedLLMProvider([
      { kind: "output", value: { ok: true, note: "" } },
      { kind: "output", value: { ok: true, note: "" } },
    ]);

    await expect(generateStructuredWithRetry(provider, request, schema, "test")).rejects.toThrow();
    // Exactly two calls total: the first attempt and the one allowed retry — never a third.
    expect(provider.callCount).toBe(2);
  });

  describe("budget-aware retry", () => {
    it("skips the retry and throws the original schema failure when too little of the execution budget remains", async () => {
      const firstError = new LLMResponseFormatError("first attempt was malformed");
      const provider = new SequencedLLMProvider([
        { kind: "throw", error: firstError },
        { kind: "output", value: { ok: true, note: "would have been the retry" } },
      ]);

      await expect(
        generateStructuredWithRetry(
          provider,
          request,
          schema,
          "test",
          startedAtWithRemaining(MIN_SAFE_RETRY_BUDGET_MS - 1),
        ),
      ).rejects.toBe(firstError);
      // Never made the second, budget-unsafe call.
      expect(provider.callCount).toBe(1);
    });

    it("still retries when comfortably more than the minimum safe budget remains", async () => {
      const provider = new SequencedLLMProvider([
        { kind: "output", value: { ok: true, note: "" } },
        { kind: "output", value: { ok: true, note: "corrected" } },
      ]);

      // A margin above the threshold, not the exact boundary: the check reads
      // the real clock, so an exact-boundary value is flaky against ordinary
      // test-execution timing slop.
      const { output, attempt } = await generateStructuredWithRetry(
        provider,
        request,
        schema,
        "test",
        startedAtWithRemaining(MIN_SAFE_RETRY_BUDGET_MS + 2_000),
      );

      expect(output).toEqual({ ok: true, note: "corrected" });
      expect(attempt).toBe("retry");
      expect(provider.callCount).toBe(2);
    });

    it("retries normally with a fresh start time and comfortable remaining budget", async () => {
      const provider = new SequencedLLMProvider([
        { kind: "output", value: { ok: true, note: "" } },
        { kind: "output", value: { ok: true, note: "corrected" } },
      ]);

      const { attempt } = await generateStructuredWithRetry(
        provider,
        request,
        schema,
        "test",
        Date.now(),
      );

      expect(attempt).toBe("retry");
      expect(provider.callCount).toBe(2);
    });

    it("never skips based on budget for a non-schema failure — it was never going to retry anyway", async () => {
      const error = new LLMTimeoutError(1_000);
      const provider = new SequencedLLMProvider([{ kind: "throw", error }]);

      await expect(
        generateStructuredWithRetry(
          provider,
          request,
          schema,
          "test",
          startedAtWithRemaining(0),
        ),
      ).rejects.toBe(error);
      expect(provider.callCount).toBe(1);
    });
  });
});
