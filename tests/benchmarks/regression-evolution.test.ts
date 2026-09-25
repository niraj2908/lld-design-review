import { describe, expect, it } from "vitest";
import { buildAttemptComparison } from "@/domain/comparison";
import { AIDesignEvaluator } from "@/evaluation-engine/ai/ai-design-evaluator";
import { HybridEvaluator } from "@/evaluation-engine/hybrid-evaluator";
import { RuleBasedEvaluator } from "@/evaluation-engine/rule-based-evaluator";
import { parkingLotProblem, submissionOf } from "@/testing/fixtures";
import { FakeLLMProvider } from "@/testing/fake-llm-provider";
import {
  regressionAttempt1Design,
  regressionAttempt1Review,
  regressionAttempt2Design,
  regressionAttempt2Review,
} from "./regression-fixtures";

/**
 * Benchmark G, section 13 of the M10 benchmark: a two-attempt evolution where
 * the second attempt genuinely fixes one issue and genuinely introduces another.
 * The M8 comparison must show both at once — an improvement on one criterion, a
 * regression on a different one, a resolved prior finding, and unchanged
 * requirement coverage — never a single collapsed "better" or "worse" verdict.
 *
 * `buildAttemptComparison` is called directly, the same pure domain function
 * `CompareAttempts` calls in production (see `src/domain/comparison`); loading,
 * ownership and ordering are already covered by M8's own tests and by
 * `tests/integration/learner-journey.test.ts`, so this benchmark stays focused on
 * the comparison's behaviour on a case built to exercise it.
 */
const problem = parkingLotProblem();

async function evaluate(design: typeof regressionAttempt1Design, review: unknown) {
  const hybrid = new HybridEvaluator(
    new RuleBasedEvaluator(),
    new AIDesignEvaluator(FakeLLMProvider.answering(review)),
  );
  return hybrid.evaluate({ problem, submission: submissionOf(design) });
}

describe("regression / evolution benchmark", () => {
  it("shows an improvement and a regression on different criteria in the same comparison, plus the resolved prior finding", async () => {
    const before = await evaluate(regressionAttempt1Design, regressionAttempt1Review);
    const after = await evaluate(regressionAttempt2Design, regressionAttempt2Review);

    const comparison = buildAttemptComparison({
      requirements: problem.requirements,
      designBefore: regressionAttempt1Design,
      designAfter: regressionAttempt2Design,
      previousFeedback: before.priorityImprovements,
      criteriaBefore: before.criterionResults,
      criteriaAfter: after.criterionResults,
    });

    const responsibility = comparison.criterionEvolutions.find((e) => e.criterion === "RESPONSIBILITY");
    const abstraction = comparison.criterionEvolutions.find((e) => e.criterion === "ABSTRACTION");
    expect(responsibility?.trend).toBe("IMPROVED");
    expect(abstraction?.trend).toBe("REGRESSED");

    // Never collapsed into one verdict: both an IMPROVED and a REGRESSED trend
    // exist side by side in the same result.
    const trends = new Set(comparison.criterionEvolutions.map((e) => e.trend));
    expect(trends.has("IMPROVED")).toBe(true);
    expect(trends.has("REGRESSED")).toBe(true);

    // ParkingLot no longer exists under that name — the prior RESPONSIBILITY
    // finding about it resolves as addressed. The AI evaluator assigns the
    // finding's id (`fbk_ai_1`, the first and only AI improvement in attempt 1).
    expect(before.priorityImprovements).toHaveLength(1);
    const resolved = comparison.feedbackResolutions.find(
      (item) => item.feedbackId === before.priorityImprovements[0]?.id,
    );
    expect(resolved?.status).toBe("ADDRESSED");
    expect(resolved?.entitiesRemoved).toContain("ParkingLot");

    // A new, distinct concern appears that attempt 1 never raised.
    expect(abstraction?.after?.concern).toContain("factory");

    // Requirement coverage is untouched by either change — this benchmark is
    // deliberately orthogonal to the missing-requirement benchmark.
    expect(
      comparison.requirementCoverage.every(
        (change) => change.transition === "COVERED_TO_COVERED",
      ),
    ).toBe(true);
  });

  it("the summary names both directions rather than reducing them to a single score", async () => {
    const before = await evaluate(regressionAttempt1Design, regressionAttempt1Review);
    const after = await evaluate(regressionAttempt2Design, regressionAttempt2Review);

    const comparison = buildAttemptComparison({
      requirements: problem.requirements,
      designBefore: regressionAttempt1Design,
      designAfter: regressionAttempt2Design,
      previousFeedback: before.priorityImprovements,
      criteriaBefore: before.criterionResults,
      criteriaAfter: after.criterionResults,
    });

    expect(comparison.summary.criteriaImproved).toBeGreaterThan(0);
    expect(comparison.summary.criteriaRegressed).toBeGreaterThan(0);
    expect(comparison.summary).not.toHaveProperty("overallScore");
    expect(comparison.summary).not.toHaveProperty("verdict");
  });
});
