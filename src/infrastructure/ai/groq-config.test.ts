import { describe, expect, it } from "vitest";
import { LLMConfigurationError } from "@/application/ports/llm-provider";
import {
  DEFAULT_GROQ_MODEL,
  isGroqConfigured,
  readGroqConfig,
} from "./groq-config";

const complete = {
  GROQ_API_KEY: "test-key-not-a-real-credential",
  GROQ_MODEL: "some-model-id",
} as const;

describe("readGroqConfig", () => {
  it("reads a complete configuration", () => {
    const config = readGroqConfig(complete);

    expect(config.model).toBe("some-model-id");
    expect(config.timeoutMs).toBe(45_000);
    expect(config.maxRetries).toBe(1);
  });

  it("trims surrounding whitespace", () => {
    expect(readGroqConfig({ ...complete, GROQ_MODEL: "  spaced  " }).model).toBe(
      "spaced",
    );
  });

  it.each([undefined, "", "   "])(
    "refuses to run with GROQ_API_KEY %s",
    (GROQ_API_KEY) => {
      expect(() => readGroqConfig({ ...complete, GROQ_API_KEY })).toThrow(
        LLMConfigurationError,
      );
    },
  );

  it.each([undefined, "", "   "])(
    "falls back to the default model when GROQ_MODEL is %s",
    (GROQ_MODEL) => {
      expect(readGroqConfig({ ...complete, GROQ_MODEL }).model).toBe(
        DEFAULT_GROQ_MODEL,
      );
    },
  );

  it("lets GROQ_MODEL override the default", () => {
    expect(
      readGroqConfig({ ...complete, GROQ_MODEL: "another-model-id" }).model,
    ).toBe("another-model-id");
  });

  it("defaults to Llama 3.3 70B on Groq, declared in exactly one place", () => {
    expect(DEFAULT_GROQ_MODEL).toBe("llama-3.3-70b-versatile");
    expect(readGroqConfig({ GROQ_API_KEY: "k" }).model).toBe(DEFAULT_GROQ_MODEL);
  });

  it("reads an overridden timeout and retry count", () => {
    const config = readGroqConfig({
      ...complete,
      GROQ_TIMEOUT_MS: "1000",
      GROQ_MAX_RETRIES: "0",
    });

    expect(config.timeoutMs).toBe(1000);
    expect(config.maxRetries).toBe(0);
  });

  it.each(["0", "-5", "abc", "1.5"])(
    "rejects the timeout value %s",
    (GROQ_TIMEOUT_MS) => {
      expect(() => readGroqConfig({ ...complete, GROQ_TIMEOUT_MS })).toThrow(
        LLMConfigurationError,
      );
    },
  );

  it("never repeats the key in its error messages", () => {
    const error = (() => {
      try {
        readGroqConfig({
          GROQ_API_KEY: "secret-value",
          GROQ_TIMEOUT_MS: "nonsense",
        });
      } catch (caught) {
        return caught as Error;
      }
      throw new Error("expected a throw");
    })();

    expect(error.message).not.toContain("secret-value");
  });
});

describe("isGroqConfigured", () => {
  it("needs only the key, because the model has a default", () => {
    expect(isGroqConfigured(complete)).toBe(true);
    expect(isGroqConfigured({ GROQ_API_KEY: "k" })).toBe(true);
    expect(isGroqConfigured({ GROQ_MODEL: "m" })).toBe(false);
    expect(isGroqConfigured({})).toBe(false);
  });

  it.each(["", "   "])("is false for a blank key (%s)", (GROQ_API_KEY) => {
    expect(isGroqConfigured({ GROQ_API_KEY })).toBe(false);
  });

  it("reveals nothing but a boolean", () => {
    expect(typeof isGroqConfigured(complete)).toBe("boolean");
  });
});
