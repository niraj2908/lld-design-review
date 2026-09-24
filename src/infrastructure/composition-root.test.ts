import { describe, expect, it } from "vitest";
import { LLMConfigurationError } from "@/application/ports/llm-provider";
import { RULE_EVALUATOR_VERSION } from "@/evaluation-engine/rule-based-evaluator";
import { HYBRID_EVALUATOR_VERSION } from "@/evaluation-engine/hybrid-evaluator";
import { DEFAULT_GROQ_MODEL } from "./ai/groq-config";
import { createDefaultEvaluator } from "./composition-root";

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
