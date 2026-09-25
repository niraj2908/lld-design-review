import type {
  LLMProvider,
  LLMRequest,
  LLMResult,
} from "@/application/ports/llm-provider";
import { LLMTimeoutError } from "@/application/ports/llm-provider";

/**
 * Stands in for a provider so tests never need a key or a network.
 *
 * It records the request it was given, so a test can assert what the evaluator
 * actually sent, and it is told what to answer — including how to fail.
 */
type FakeAnswer =
  | { readonly kind: "output"; readonly output: unknown }
  | { readonly kind: "throw"; readonly error: Error };

export class FakeLLMProvider implements LLMProvider {
  readonly name = "fake";
  readonly requests: LLMRequest[] = [];
  private callIndex = 0;

  constructor(
    private readonly answers: readonly FakeAnswer[],
    readonly model = "fake-model-v1",
  ) {}

  static answering(output: unknown, model?: string): FakeLLMProvider {
    return new FakeLLMProvider([{ kind: "output", output }], model);
  }

  static failing(error: Error, model?: string): FakeLLMProvider {
    return new FakeLLMProvider([{ kind: "throw", error }], model);
  }

  static timingOut(timeoutMs = 45_000): FakeLLMProvider {
    return FakeLLMProvider.failing(new LLMTimeoutError(timeoutMs));
  }

  /**
   * Scripts a different answer for each successive call, in order — the one
   * shape a single fixed answer cannot cover: exercising a retry needs the
   * first call to fail and a later one to succeed. A call past the end of the
   * list repeats the last scripted answer, the same "keep answering the one
   * thing you were told" rule a single-answer provider already follows.
   */
  static sequence(
    answers: readonly ({ readonly output: unknown } | { readonly error: Error })[],
    model?: string,
  ): FakeLLMProvider {
    return new FakeLLMProvider(
      answers.map((entry) =>
        "error" in entry
          ? { kind: "throw" as const, error: entry.error }
          : { kind: "output" as const, output: entry.output },
      ),
      model,
    );
  }

  get lastRequest(): LLMRequest {
    const request = this.requests.at(-1);
    if (request === undefined) {
      throw new Error("The provider was never called.");
    }
    return request;
  }

  async generateStructured(request: LLMRequest): Promise<LLMResult<unknown>> {
    this.requests.push(request);
    const answer = this.answers[Math.min(this.callIndex, this.answers.length - 1)];
    this.callIndex += 1;
    if (answer === undefined) {
      throw new Error("FakeLLMProvider was constructed with no scripted answer.");
    }
    if (answer.kind === "throw") {
      throw answer.error;
    }
    return {
      output: answer.output,
      model: this.model,
      latencyMs: 7,
    };
  }
}
