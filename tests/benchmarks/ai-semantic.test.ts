import { describe, expect, it } from "vitest";
import { AIDesignEvaluator } from "@/evaluation-engine/ai/ai-design-evaluator";
import { submissionOf } from "@/testing/fixtures";
import { FakeLLMProvider } from "@/testing/fake-llm-provider";
import { benchmarkCase } from "./fixtures";

/**
 * Section 7, 10, 11 and 12 of the M10 benchmark: what the semantic evaluator
 * does with a representative, hand-written judge answer for each curated case.
 *
 * The judge is always `FakeLLMProvider` scripted with the case's own
 * `mockAiReview` — never a live model — so this suite is deterministic,
 * reproducible and free of any API credential. It is not a claim that a real
 * model would answer exactly this way; it is a claim about what the pipeline
 * does with an answer of this shape once it has one. Schema-rejection,
 * hallucinated-evidence and out-of-remit-criterion coverage already lives in
 * `src/evaluation-engine/ai/ai-design-evaluator.test.ts` and is not repeated
 * here — this file is about representative, problem-realistic cases end to end.
 */
function semanticOutcome(id: string, review = benchmarkCase(id).mockAiReview) {
  const testCase = benchmarkCase(id);
  const llm = FakeLLMProvider.answering(review);
  return new AIDesignEvaluator(llm).evaluate({
    problem: testCase.problem,
    submission: submissionOf(testCase.design),
  });
}

describe("AI semantic benchmark", () => {
  it("strong design: the judge's finding is grounded and no improvement is manufactured", async () => {
    const outcome = await semanticOutcome("strong-design");

    expect(outcome.priorityImprovements).toEqual([]);
    expect(outcome.criterionResults.every((r) => r.unverifiedEvidenceCount === undefined)).toBe(
      true,
    );
    const abstraction = outcome.criterionResults.find((r) => r.criterion === "ABSTRACTION");
    expect(abstraction?.assessment).toBe("STRONG");
    expect(abstraction?.evidence[0]?.entity).toBe("PricingStrategy");
  });

  it("weak design: real, evidence-backed issues are identified and each points at something in the submission", async () => {
    const outcome = await semanticOutcome("weak-design");

    const criteria = new Map(outcome.criterionResults.map((r) => [r.criterion, r]));
    expect(criteria.get("RESPONSIBILITY")?.assessment).toBe("NEEDS_IMPROVEMENT");
    expect(criteria.get("COUPLING")?.assessment).toBe("NEEDS_IMPROVEMENT");
    expect(criteria.get("ENCAPSULATION")?.assessment).toBe("NEEDS_IMPROVEMENT");

    // Every finding's evidence resolves to a real element of this exact design.
    for (const result of outcome.criterionResults) {
      for (const evidence of result.evidence) {
        expect(["ParkingLotManager", "SqlDatabase"]).toContain(evidence.entity);
      }
    }
    expect(outcome.priorityImprovements).not.toEqual([]);
    expect(outcome.priorityImprovements[0]?.reconsider).toBeDefined();
  });

  it("valid alternative: is not penalised merely for differing from the strong design", async () => {
    const strong = await semanticOutcome("strong-design");
    const alternative = await semanticOutcome("valid-alternative-design");

    // Both receive real assessments; neither manufactures an improvement.
    expect(alternative.priorityImprovements).toEqual([]);
    expect(strong.priorityImprovements).toEqual([]);
    expect(alternative.strengths.length).toBeGreaterThan(0);

    // Nothing about the alternative's outcome references the strong design's
    // own vocabulary — there is no reference design in the pipeline to leak.
    const alternativeText = JSON.stringify(alternative);
    expect(alternativeText).not.toContain("PricingStrategy");
    expect(alternativeText).not.toContain("ParkingLot\"");
  });

  it("valid alternative: the 'no seam yet' observation is a proportionate note, not a manufactured penalty", async () => {
    const outcome = await semanticOutcome("valid-alternative-design");
    const abstraction = outcome.criterionResults.find((r) => r.criterion === "ABSTRACTION");

    expect(abstraction?.assessment).toBe("ADEQUATE");
    expect(abstraction?.concern).toContain("proportionate");
  });

  it("over-engineered design: the factory layer is flagged, but the justified strategy seam is not", async () => {
    const outcome = await semanticOutcome("over-engineered-design");
    const criteria = new Map(outcome.criterionResults.map((r) => [r.criterion, r]));

    const abstraction = criteria.get("ABSTRACTION");
    expect(abstraction?.assessment).toBe("NEEDS_IMPROVEMENT");
    expect(abstraction?.evidence.map((e) => e.entity)).toEqual(
      expect.arrayContaining(["AllocationStrategyFactory", "PricingStrategyFactory"]),
    );
    // The concern names the factories, never a blanket "too many interfaces".
    expect(abstraction?.concern).not.toMatch(/too many interfaces/iu);
    expect(abstraction?.concern).toContain("no stated requirement");

    const extensibility = criteria.get("EXTENSIBILITY");
    expect(extensibility?.assessment).toBe("ADEQUATE");
  });

  it("edge-case-heavy design: the coupling concern surfaces independently of the strong edge-case reading", async () => {
    const outcome = await semanticOutcome("edge-case-heavy-design");
    const criteria = new Map(outcome.criterionResults.map((r) => [r.criterion, r]));

    expect(criteria.get("COUPLING")?.assessment).toBe("NEEDS_IMPROVEMENT");
    expect(criteria.get("EDGE_CASES")?.assessment).toBe("STRONG");
    // Neither criterion's confidence is contaminated by the other's assessment.
    expect(criteria.get("COUPLING")?.confidence).not.toBe(criteria.get("EDGE_CASES")?.confidence);
  });

  describe("false positives", () => {
    it("does not fabricate a concern about the plain, pattern-free valid alternative", async () => {
      const outcome = await semanticOutcome("valid-alternative-design");

      expect(outcome.priorityImprovements).toEqual([]);
      const concerns = outcome.criterionResults
        .map((r) => r.concern)
        .filter((c): c is string => c !== undefined);
      // The one note present is the proportionate ABSTRACTION observation
      // already asserted above — nothing else is raised against this design.
      expect(concerns).toHaveLength(1);
    });

    it("does not flag a composition relationship or a direct, non-variation dependency as a defect", async () => {
      const outcome = await semanticOutcome("valid-alternative-design");
      const text = JSON.stringify(outcome);

      // ParkingRecord is only ever reached through composition or a direct
      // dependency in this design (never through an interface) — a pipeline
      // that penalised "no interface" or "direct dependency" as such would
      // show up here as a concern naming it. None exists.
      expect(text).not.toContain("ParkingRecord");
      expect(text).not.toMatch(/composition.*(wrong|bad|avoid)/iu);
      expect(text).not.toMatch(/no interface/iu);
    });
  });
});
