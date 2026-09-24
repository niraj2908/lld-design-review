import { describe, expect, it } from "vitest";
import { LLMTimeoutError } from "@/application/ports/llm-provider";
import type { EvaluationContext } from "@/application/ports/evaluator";
import { natureOf } from "@/domain/evaluation/review-criterion";
import {
  designForProblem,
  parkingLotProblem,
  submissionOf,
} from "@/testing/fixtures";
import { FakeLLMProvider } from "@/testing/fake-llm-provider";
import { AIDesignEvaluator } from "./ai/ai-design-evaluator";
import { HYBRID_EVALUATOR_VERSION, HybridEvaluator, criteriaAreDisjoint } from "./hybrid-evaluator";
import { RuleBasedEvaluator } from "./rule-based-evaluator";

const problem = parkingLotProblem();
const context: EvaluationContext = {
  problem,
  submission: submissionOf(designForProblem(problem)),
};

const review = {
  criteria: [
    {
      criterion: "COHESION",
      assessment: "ADEQUATE",
      evidence: [{ entity: "ParkingLot", field: "methods", value: "park" }],
      concern: "Two flows in one element, which the brief allows.",
      confidence: 0.6,
    },
  ],
  strengths: ["The pricing contract is explicit."],
  priorityImprovements: [
    {
      criterion: "COHESION",
      priority: "P3",
      what: "Exit and entry share an element.",
      where: [{ entity: "ParkingLot", field: "methods", value: "exit" }],
      why: "They may diverge later.",
    },
  ],
  summary: "A sound decomposition with one boundary worth watching.",
};

function hybrid(provider = FakeLLMProvider.answering(review)) {
  return {
    provider,
    evaluator: new HybridEvaluator(
      new RuleBasedEvaluator(),
      new AIDesignEvaluator(provider),
    ),
  };
}

describe("HybridEvaluator", () => {
  it("reports its own version and the judge's provider metadata", () => {
    const { evaluator } = hybrid();

    expect(evaluator.version).toBe(HYBRID_EVALUATOR_VERSION);
    expect(evaluator.metadata.provider).toBe("fake");
    expect(evaluator.metadata.model).toBe("fake-model-v1");
    expect(evaluator.metadata.promptVersion).toBe("ai-review-v2");
  });

  it("returns both the deterministic and the semantic criteria", async () => {
    const outcome = await hybrid().evaluator.evaluate(context);

    const factual = outcome.criterionResults.filter(
      (result) => natureOf(result.criterion) === "FACTUAL",
    );
    const semantic = outcome.criterionResults.filter(
      (result) => natureOf(result.criterion) === "SEMANTIC",
    );

    expect(factual).toHaveLength(5);
    expect(semantic).toHaveLength(1);
  });

  it("cannot let the judge overwrite a fact, because the criteria are disjoint", async () => {
    const outcome = await hybrid().evaluator.evaluate(context);

    expect(criteriaAreDisjoint(outcome)).toBe(true);
  });

  it("keeps the deterministic assessments exactly as the rule evaluator produced them", async () => {
    const deterministic = await new RuleBasedEvaluator().evaluate(context);
    const outcome = await hybrid().evaluator.evaluate(context);

    for (const expected of deterministic.criterionResults) {
      expect(outcome.criterionResults).toContainEqual(expected);
    }
  });

  it("hands the deterministic outcome to the judge", async () => {
    const { provider, evaluator } = hybrid();

    await evaluator.evaluate(context);

    expect(provider.lastRequest.user).toContain(
      "ALREADY ESTABLISHED BY THE STRUCTURAL CHECKER",
    );
  });

  it("orders improvements by priority across both evaluators", async () => {
    const design = designForProblem(problem);
    const outcome = await hybrid().evaluator.evaluate({
      problem,
      submission: submissionOf({ ...design, requirementMappings: [] }),
    });

    const priorities = outcome.priorityImprovements.map((item) => item.priority);
    expect(priorities).toEqual([...priorities].toSorted());
    expect(priorities[0]).toBe("P0");
  });

  it("joins both summaries", async () => {
    const outcome = await hybrid().evaluator.evaluate(context);

    expect(outcome.summary).toContain("structurally sound");
    expect(outcome.summary).toContain("A sound decomposition");
  });

  it("fails the whole evaluation when the judge fails, rather than reporting half a review", async () => {
    const { evaluator } = hybrid(FakeLLMProvider.timingOut(1_000));

    await expect(evaluator.evaluate(context)).rejects.toThrow(LLMTimeoutError);
  });

  it("still lets the deterministic evaluator be used alone", async () => {
    const outcome = await new RuleBasedEvaluator().evaluate(context);

    expect(outcome.criterionResults).toHaveLength(5);
  });
});
