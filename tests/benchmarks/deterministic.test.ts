import { describe, expect, it } from "vitest";
import { RuleBasedEvaluator } from "@/evaluation-engine/rule-based-evaluator";
import { submissionOf } from "@/testing/fixtures";
import { BENCHMARK_CASES, benchmarkCase } from "./fixtures";

/**
 * Section 6 of the M10 benchmark: what the deterministic evaluator alone must get
 * right on each curated case. Assertions are on semantic outcomes (an assessment,
 * a criterion, whether a specific requirement is covered) rather than exact
 * wording — a rewording of a suggestion must never break this suite.
 */
const evaluator = new RuleBasedEvaluator();

function deterministicOutcome(id: string) {
  const testCase = benchmarkCase(id);
  return evaluator.evaluate({
    problem: testCase.problem,
    submission: submissionOf(testCase.design),
  });
}

describe("deterministic benchmark", () => {
  it("runs every benchmark case's design through the deterministic evaluator without throwing", async () => {
    for (const testCase of BENCHMARK_CASES) {
      await expect(deterministicOutcome(testCase.id)).resolves.toBeDefined();
    }
  });

  it("strong design: both requirements covered, nothing else flagged", async () => {
    const outcome = await deterministicOutcome("strong-design");
    const byCriterion = new Map(outcome.criterionResults.map((r) => [r.criterion, r]));

    expect(byCriterion.get("REQUIREMENT_COVERAGE")?.assessment).toBe("ADEQUATE");
    expect(byCriterion.get("STRUCTURAL_VALIDITY")?.assessment).toBe("ADEQUATE");
    expect(byCriterion.get("DESIGN_COMPLETENESS")?.assessment).toBe("ADEQUATE");
    expect(byCriterion.get("DESIGN_DECISIONS")?.assessment).toBe("ADEQUATE");
    expect(byCriterion.get("EDGE_CASE_COVERAGE")?.assessment).toBe("ADEQUATE");
    // No deterministic criterion may ever claim STRONG — that would be a judgement.
    for (const result of outcome.criterionResults) {
      expect(result.assessment).not.toBe("STRONG");
    }
  });

  it("weak design: technically covered, but the missing decisions and edge cases are caught", async () => {
    const outcome = await deterministicOutcome("weak-design");
    const byCriterion = new Map(outcome.criterionResults.map((r) => [r.criterion, r]));

    // Determinism has no way to see past a mapping to a god class: this is
    // exactly the boundary the benchmark's intent documents.
    expect(byCriterion.get("REQUIREMENT_COVERAGE")?.assessment).toBe("ADEQUATE");
    expect(byCriterion.get("DESIGN_DECISIONS")?.assessment).toBe("MISSING");
    expect(byCriterion.get("EDGE_CASE_COVERAGE")?.assessment).toBe("MISSING");
    expect(byCriterion.get("STRUCTURAL_VALIDITY")?.assessment).toBe("ADEQUATE");
  });

  it("valid alternative: receives the same class of deterministic assessment as the strong design, with no shared element name", async () => {
    const strong = await deterministicOutcome("strong-design");
    const alternative = await deterministicOutcome("valid-alternative-design");

    const strongNames = new Set(
      benchmarkCase("strong-design").design.classes.map((c) => c.name),
    );
    const alternativeNames = new Set(
      benchmarkCase("valid-alternative-design").design.classes.map((c) => c.name),
    );
    expect([...alternativeNames].some((name) => strongNames.has(name))).toBe(false);

    const criterionOf = (
      outcome: Awaited<ReturnType<typeof deterministicOutcome>>,
      criterion: string,
    ) => outcome.criterionResults.find((r) => r.criterion === criterion)?.assessment;

    for (const criterion of [
      "REQUIREMENT_COVERAGE",
      "STRUCTURAL_VALIDITY",
      "DESIGN_COMPLETENESS",
      "DESIGN_DECISIONS",
      "EDGE_CASE_COVERAGE",
    ] as const) {
      expect(criterionOf(alternative, criterion)).toBe(criterionOf(strong, criterion));
    }
  });

  it("over-engineered design: structurally valid and complete despite the redundant factory layer", async () => {
    const outcome = await deterministicOutcome("over-engineered-design");
    const byCriterion = new Map(outcome.criterionResults.map((r) => [r.criterion, r]));

    // Determinism has no opinion on unnecessary abstraction — only a semantic
    // judge can see that. It must not invent a structural complaint either.
    expect(byCriterion.get("STRUCTURAL_VALIDITY")?.assessment).toBe("ADEQUATE");
    expect(byCriterion.get("DESIGN_COMPLETENESS")?.assessment).toBe("ADEQUATE");
    expect(byCriterion.get("REQUIREMENT_COVERAGE")?.assessment).toBe("ADEQUATE");
  });

  it("missing requirement: the specific uncovered requirement is named, the other stays covered", async () => {
    const outcome = await deterministicOutcome("missing-requirement-design");
    const coverage = outcome.criterionResults.find(
      (r) => r.criterion === "REQUIREMENT_COVERAGE",
    );

    expect(coverage?.assessment).toBe("NEEDS_IMPROVEMENT");
    const findingsAboutRequirement = outcome.priorityImprovements.filter(
      (item) => item.criterion === "REQUIREMENT_COVERAGE",
    );
    expect(findingsAboutRequirement).toHaveLength(1);
    expect(findingsAboutRequirement[0]?.what).toContain("PL-REQ-02");
    // The still-covered requirement leaves a positive trace, not just the gap.
    expect(coverage?.evidence.some((e) => e.value === "PL-REQ-01")).toBe(true);
  });

  it("edge-case-heavy design: five edge cases recorded, independent of every other criterion", async () => {
    const outcome = await deterministicOutcome("edge-case-heavy-design");
    const edgeCases = outcome.criterionResults.find(
      (r) => r.criterion === "EDGE_CASE_COVERAGE",
    );

    expect(edgeCases?.assessment).toBe("ADEQUATE");
    expect(outcome.strengths.some((strength) => strength.includes("5 edge"))).toBe(true);
    // Deterministic criteria cannot see the coupling flaw at all; that is the
    // semantic evaluator's job, exercised in ai-semantic.test.ts.
    expect(outcome.criterionResults.map((r) => r.criterion)).not.toContain("COUPLING");
  });

  it("never emits STRONG from the deterministic evaluator, on any benchmark case", async () => {
    for (const testCase of BENCHMARK_CASES) {
      const outcome = await deterministicOutcome(testCase.id);
      for (const result of outcome.criterionResults) {
        expect(result.assessment).not.toBe("STRONG");
        expect(result.confidence).toBeUndefined();
      }
    }
  });

  it("produces byte-for-byte identical results across repeated runs of the same design", async () => {
    const first = await deterministicOutcome("weak-design");
    const second = await deterministicOutcome("weak-design");

    expect(second).toEqual(first);
  });
});
