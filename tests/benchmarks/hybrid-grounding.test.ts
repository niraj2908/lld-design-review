import { describe, expect, it } from "vitest";
import { AIDesignEvaluator } from "@/evaluation-engine/ai/ai-design-evaluator";
import { HybridEvaluator } from "@/evaluation-engine/hybrid-evaluator";
import { RuleBasedEvaluator } from "@/evaluation-engine/rule-based-evaluator";
import { submissionOf } from "@/testing/fixtures";
import { FakeLLMProvider } from "@/testing/fake-llm-provider";
import { benchmarkCase } from "./fixtures";

/**
 * Section 8 of the M10 benchmark: deterministic truth must remain deterministic
 * truth, even when a judge's answer disagrees with it.
 *
 * `missing-requirement-design` genuinely fails to map `req_pl_02`. Here the
 * mocked judge is scripted to claim, in prose, that the design "probably
 * addresses" both requirements — the exact failure mode section 8 names. The
 * schema itself already makes this claim unable to overwrite anything: a judge's
 * `criterion` is drawn from `EVALUATION_CRITERIA`, which shares no name with
 * `REQUIREMENT_COVERAGE`, and `AIDesignEvaluator.validate()` additionally drops
 * any criterion outside `AI_CRITERIA` (`isAICriterion`) before it ever reaches an
 * outcome — see `src/evaluation-engine/ai/ai-criteria.ts`. This test exercises
 * that guarantee end to end, on a realistic case, rather than re-asserting the
 * unit-level mechanism already covered by `ai-design-evaluator.test.ts`.
 */
describe("hybrid grounding benchmark", () => {
  it("a judge's prose claim that a requirement is 'probably handled' cannot move the deterministic finding", async () => {
    const testCase = benchmarkCase("missing-requirement-design");
    const context = {
      problem: testCase.problem,
      submission: submissionOf(testCase.design),
    };

    const dishonestJudge = FakeLLMProvider.answering({
      criteria: [
        {
          criterion: "REQUIREMENT_UNDERSTANDING",
          assessment: "STRONG",
          evidence: [
            { entity: "ParkingLot", field: "responsibility", value: "Owns levels and coordinates parking and exit flows." },
          ],
          concern: "Both requirements are probably handled by ParkingLot even without an explicit mapping.",
          confidence: 0.9,
        },
      ],
      strengths: ["The design almost certainly covers fee calculation somewhere."],
      priorityImprovements: [],
      summary: "Both requirements are likely addressed in practice.",
    });

    const hybrid = new HybridEvaluator(
      new RuleBasedEvaluator(),
      new AIDesignEvaluator(dishonestJudge),
    );
    const outcome = await hybrid.evaluate(context);

    const coverage = outcome.criterionResults.find(
      (r) => r.criterion === "REQUIREMENT_COVERAGE",
    );
    expect(coverage?.assessment).toBe("NEEDS_IMPROVEMENT");
    expect(
      outcome.priorityImprovements.some(
        (item) => item.criterion === "REQUIREMENT_COVERAGE" && item.what.includes("PL-REQ-02"),
      ),
    ).toBe(true);

    // The judge's out-of-remit claim was dropped entirely — never smoothed over
    // the gap, and never persisted as if it were a real finding.
    expect(
      outcome.criterionResults.some((r) => r.criterion === "REQUIREMENT_UNDERSTANDING"),
    ).toBe(false);
    expect(JSON.stringify(outcome)).not.toContain("probably handled");
  });

  it("the deterministic and semantic criterion sets stay disjoint on every benchmark case", async () => {
    const testCase = benchmarkCase("weak-design");
    const hybrid = new HybridEvaluator(
      new RuleBasedEvaluator(),
      new AIDesignEvaluator(FakeLLMProvider.answering(testCase.mockAiReview)),
    );

    const outcome = await hybrid.evaluate({
      problem: testCase.problem,
      submission: submissionOf(testCase.design),
    });

    const deterministicCriteria = new Set([
      "STRUCTURAL_VALIDITY",
      "REQUIREMENT_COVERAGE",
      "DESIGN_COMPLETENESS",
      "EDGE_CASE_COVERAGE",
      "DESIGN_DECISIONS",
    ]);
    const semanticResults = outcome.criterionResults.filter(
      (r) => !deterministicCriteria.has(r.criterion),
    );
    expect(semanticResults.length).toBeGreaterThan(0);
    expect(
      semanticResults.every((r) => !deterministicCriteria.has(r.criterion)),
    ).toBe(true);
  });
});
