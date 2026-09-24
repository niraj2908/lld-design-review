import { describe, expect, it } from "vitest";
import { EmbeddingConfigurationError } from "@/application/ports/embedding-provider";
import { LLMConfigurationError } from "@/application/ports/llm-provider";
import { RULE_EVALUATOR_VERSION } from "@/evaluation-engine/rule-based-evaluator";
import { HYBRID_EVALUATOR_VERSION } from "@/evaluation-engine/hybrid-evaluator";
import { DEFAULT_GROQ_MODEL } from "./ai/groq-config";
import { HASHING_PROVIDER_NAME } from "./ai/hashing-embedding-provider";
import { OPENAI_COMPATIBLE_PROVIDER_NAME } from "./ai/openai-compatible-embedding-provider";
import {
  createDefaultEvaluator,
  createEmbeddingProvider,
} from "./composition-root";

describe("createDefaultEvaluator", () => {
  it("uses the deterministic evaluator alone when no model is configured", () => {
    const evaluator = createDefaultEvaluator({});

    expect(evaluator.version).toBe(RULE_EVALUATOR_VERSION);
    expect(evaluator.metadata).toBeUndefined();
  });

  it("falls back when a model is named but no key is available", () => {
    expect(createDefaultEvaluator({ GROQ_MODEL: "m" }).version).toBe(
      RULE_EVALUATOR_VERSION,
    );
  });

  it("composes both evaluators from a key alone, using the default model", () => {
    const evaluator = createDefaultEvaluator({
      GROQ_API_KEY: "test-key-not-a-real-credential",
    });

    expect(evaluator.version).toBe(HYBRID_EVALUATOR_VERSION);
    expect(evaluator.metadata?.model).toBe(DEFAULT_GROQ_MODEL);
  });

  it("composes both evaluators when a model is configured", () => {
    const evaluator = createDefaultEvaluator({
      GROQ_API_KEY: "test-key-not-a-real-credential",
      GROQ_MODEL: "some-model-id",
    });

    expect(evaluator.version).toBe(HYBRID_EVALUATOR_VERSION);
    expect(evaluator.metadata).toEqual({
      provider: "groq",
      model: "some-model-id",
      promptVersion: "ai-review-v1",
    });
  });

  it("refuses a configuration it cannot honour rather than running with a bad setting", () => {
    expect(() =>
      createDefaultEvaluator({
        GROQ_API_KEY: "test-key-not-a-real-credential",
        GROQ_MODEL: "some-model-id",
        GROQ_TIMEOUT_MS: "nonsense",
      }),
    ).toThrow(LLMConfigurationError);
  });
});

describe("createEmbeddingProvider", () => {
  const WITH_KEY = {
    EMBEDDING_API_KEY: "test-key-not-a-real-credential",
  } as const;

  it("uses the real embedding service when a key is configured", () => {
    const provider = createEmbeddingProvider(WITH_KEY);

    expect(provider.name).toBe(OPENAI_COMPATIBLE_PROVIDER_NAME);
    expect(provider.model).toBe("text-embedding-3-small");
    expect(provider.dimensions).toBe(1536);
  });

  it("uses the real service in production too, when a key is configured", () => {
    const provider = createEmbeddingProvider({
      ...WITH_KEY,
      NODE_ENV: "production",
    });

    expect(provider.name).toBe(OPENAI_COMPATIBLE_PROVIDER_NAME);
  });

  it("honours an overridden model and host", () => {
    const provider = createEmbeddingProvider({
      ...WITH_KEY,
      EMBEDDING_MODEL: "another-embedding-model",
      EMBEDDING_BASE_URL: "http://localhost:11434/v1",
    });

    expect(provider.model).toBe("another-embedding-model");
  });

  /**
   * The point of the whole switch: a deployment that loses its key must stop,
   * because lexical retrieval would still return ranked, cited passages and
   * nothing downstream could tell the difference.
   */
  it("refuses to run in production without a key", () => {
    expect(() =>
      createEmbeddingProvider({ NODE_ENV: "production" }),
    ).toThrow(EmbeddingConfigurationError);
  });

  it("says what to do about it rather than just failing", () => {
    expect(() => createEmbeddingProvider({ NODE_ENV: "production" })).toThrow(
      /EMBEDDING_API_KEY is not set and local lexical embeddings are not permitted in production/,
    );
  });

  it.each(["", "   ", "\t"])(
    "treats the blank key %j as no key in production",
    (EMBEDDING_API_KEY) => {
      expect(() =>
        createEmbeddingProvider({ EMBEDDING_API_KEY, NODE_ENV: "production" }),
      ).toThrow(EmbeddingConfigurationError);
    },
  );

  it.each(["development", "test", undefined])(
    "falls back to local lexical embeddings when NODE_ENV is %s",
    (NODE_ENV) => {
      const provider = createEmbeddingProvider(
        NODE_ENV === undefined ? {} : { NODE_ENV },
      );

      expect(provider.name).toBe(HASHING_PROVIDER_NAME);
      expect(provider.dimensions).toBe(1536);
    },
  );

  it.each(["", "   "])(
    "treats the blank key %j as no key outside production too",
    (EMBEDDING_API_KEY) => {
      expect(createEmbeddingProvider({ EMBEDDING_API_KEY }).name).toBe(
        HASHING_PROVIDER_NAME,
      );
    },
  );

  it("names the fallback so a store filled with it is recognisable", () => {
    const provider = createEmbeddingProvider({});

    expect(provider.model).toContain("hashing");
    expect(provider.name).not.toBe(OPENAI_COMPATIBLE_PROVIDER_NAME);
  });

  it("still refuses a configuration it cannot honour", () => {
    expect(() =>
      createEmbeddingProvider({ ...WITH_KEY, EMBEDDING_DIMENSIONS: "768" }),
    ).toThrow(EmbeddingConfigurationError);
  });
});
