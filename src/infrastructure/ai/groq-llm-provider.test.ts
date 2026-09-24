import { describe, expect, it } from "vitest";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  RateLimitError,
} from "groq-sdk";
import {
  LLMConfigurationError,
  LLMRateLimitError,
  LLMResponseFormatError,
  LLMTimeoutError,
  LLMUnavailableError,
} from "@/application/ports/llm-provider";
import type { LLMRequest } from "@/application/ports/llm-provider";
import { GROQ_PROVIDER_NAME, GroqLLMProvider, translateGroqError } from "./groq-llm-provider";

const config = {
  apiKey: "test-key-not-a-real-credential",
  model: "some-model-id",
  timeoutMs: 5_000,
  maxRetries: 0,
} as const;

const request: LLMRequest = {
  promptVersion: "ai-review-v1",
  system: "rules",
  user: "data",
  responseSchema: { type: "object" },
  schemaName: "design_review",
  temperature: 0.2,
  maxOutputTokens: 256,
  timeoutMs: 1_000,
};

/** A stand-in for the SDK client, so nothing here touches the network. */
function fakeClient(
  handler: (body: unknown, options: unknown) => unknown,
): never {
  return { chat: { completions: { create: handler } } } as never;
}

function completion(content: string | null, model = "some-model-id") {
  return {
    model,
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 11, completion_tokens: 22 },
  };
}

describe("GroqLLMProvider", () => {
  it("names itself and its configured model", () => {
    const provider = new GroqLLMProvider(config, fakeClient(() => completion("{}")));

    expect(provider.name).toBe(GROQ_PROVIDER_NAME);
    expect(provider.model).toBe("some-model-id");
  });

  it("asks for structured output against the supplied schema", async () => {
    let sent: Record<string, unknown> = {};
    const provider = new GroqLLMProvider(
      config,
      fakeClient((body) => {
        sent = body as Record<string, unknown>;
        return completion('{"ok":true}');
      }),
    );

    await provider.generateStructured(request);

    expect(sent.model).toBe("some-model-id");
    expect(sent.response_format).toEqual({
      type: "json_schema",
      json_schema: {
        name: "design_review",
        schema: { type: "object" },
        strict: true,
      },
    });
    expect(sent.temperature).toBe(0.2);
    expect(sent.max_completion_tokens).toBe(256);
  });

  it("sends the rules and the data as separate messages", async () => {
    let sent: { messages?: { role: string; content: string }[] } = {};
    const provider = new GroqLLMProvider(
      config,
      fakeClient((body) => {
        sent = body as typeof sent;
        return completion("{}");
      }),
    );

    await provider.generateStructured(request);

    expect(sent.messages).toEqual([
      { role: "system", content: "rules" },
      { role: "user", content: "data" },
    ]);
  });

  it("applies the request timeout to the call", async () => {
    let options: { timeout?: number; signal?: AbortSignal } = {};
    const provider = new GroqLLMProvider(
      config,
      fakeClient((_body, received) => {
        options = received as typeof options;
        return completion("{}");
      }),
    );

    await provider.generateStructured(request);

    expect(options.timeout).toBe(1_000);
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("falls back to the configured timeout when the request names none", async () => {
    let options: { timeout?: number } = {};
    const provider = new GroqLLMProvider(
      config,
      fakeClient((_body, received) => {
        options = received as typeof options;
        return completion("{}");
      }),
    );

    const { timeoutMs: _omitted, ...withoutTimeout } = request;
    await provider.generateStructured(withoutTimeout);

    expect(options.timeout).toBe(5_000);
  });

  it("returns the parsed answer with the model and usage the provider reported", async () => {
    const provider = new GroqLLMProvider(
      config,
      fakeClient(() => completion('{"criteria":[]}', "resolved-model")),
    );

    const result = await provider.generateStructured(request);

    expect(result.output).toEqual({ criteria: [] });
    expect(result.model).toBe("resolved-model");
    expect(result.usage).toEqual({ promptTokens: 11, completionTokens: 22 });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it.each([null, ""])("rejects an empty answer (%s)", async (content) => {
    const provider = new GroqLLMProvider(
      config,
      fakeClient(() => completion(content)),
    );

    await expect(provider.generateStructured(request)).rejects.toThrow(
      LLMResponseFormatError,
    );
  });

  it("rejects an answer that is not JSON", async () => {
    const provider = new GroqLLMProvider(
      config,
      fakeClient(() => completion("Sure! Here is your review:")),
    );

    await expect(provider.generateStructured(request)).rejects.toThrow(
      /not valid JSON/,
    );
  });

  it("translates a provider failure before it leaves the adapter", async () => {
    const provider = new GroqLLMProvider(
      config,
      fakeClient(() => {
        throw new RateLimitError(429, undefined, "slow down", new Headers());
      }),
    );

    await expect(provider.generateStructured(request)).rejects.toThrow(
      LLMRateLimitError,
    );
  });
});

describe("translateGroqError", () => {
  it("maps a timeout", () => {
    expect(
      translateGroqError(new APIConnectionTimeoutError({ message: "slow" }), 900),
    ).toBeInstanceOf(LLMTimeoutError);
  });

  it("maps an aborted request", () => {
    const aborted = Object.assign(new Error("aborted"), { name: "TimeoutError" });

    expect(translateGroqError(aborted, 900)).toBeInstanceOf(LLMTimeoutError);
  });

  it("maps a rate limit", () => {
    expect(
      translateGroqError(new RateLimitError(429, undefined, "x", new Headers()), 1),
    ).toBeInstanceOf(LLMRateLimitError);
  });

  it("maps rejected credentials to a configuration failure", () => {
    expect(
      translateGroqError(new AuthenticationError(401, undefined, "x", new Headers()), 1),
    ).toBeInstanceOf(LLMConfigurationError);
  });

  it("maps a connection failure", () => {
    expect(
      translateGroqError(new APIConnectionError({ message: "down" }), 1),
    ).toBeInstanceOf(LLMUnavailableError);
  });

  it("maps any other API error to unavailable", () => {
    expect(
      translateGroqError(new APIError(500, undefined, "boom", new Headers()), 1),
    ).toBeInstanceOf(LLMUnavailableError);
  });

  it("passes an unrelated error through untouched", () => {
    const original = new TypeError("not the provider's fault");

    expect(translateGroqError(original, 1)).toBe(original);
  });

  it("never repeats the key, which it is never given", () => {
    const translated = translateGroqError(
      new AuthenticationError(401, undefined, "invalid api key", new Headers()),
      1,
    );

    expect(translated.message).not.toContain(config.apiKey);
  });
});
