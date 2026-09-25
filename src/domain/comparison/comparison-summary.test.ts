import { describe, expect, it } from "vitest";
import type { DesignStructureComparison } from "./design-comparison";
import type { FeedbackResolution } from "./feedback-resolution";
import type { CriterionEvolution } from "./criterion-evolution";
import type { RequirementCoverageChange } from "./requirement-coverage-comparison";
import { summarizeComparison } from "./comparison-summary";

const EMPTY_STRUCTURE: DesignStructureComparison = {
  classChanges: [],
  interfaceChanges: [],
  relationshipChanges: [],
  decisionChanges: [],
  edgeCaseChanges: [],
};

describe("summarizeComparison", () => {
  it("counts structural changes by kind and by element type", () => {
    const summary = summarizeComparison({
      structure: {
        ...EMPTY_STRUCTURE,
        classChanges: [
          { kind: "ADDED", name: "SpotAllocator", responsibilityChanged: false, attributeChanges: [], methodChanges: [] },
          { kind: "REMOVED", name: "ParkingLot", responsibilityChanged: false, attributeChanges: [], methodChanges: [] },
          { kind: "UNCHANGED", name: "Ticket", responsibilityChanged: false, attributeChanges: [], methodChanges: [] },
        ],
      },
      requirementCoverage: [],
      feedbackResolutions: [],
      criterionEvolutions: [],
    });

    expect(summary.classes).toEqual({ added: 1, removed: 1, modified: 0, unchanged: 1 });
    expect(summary.totalStructuralChanges).toBe(2);
  });

  it("counts newly covered and lost requirements separately from unchanged ones", () => {
    const coverage: readonly RequirementCoverageChange[] = [
      { requirementId: "r1", code: "R1", title: "", coveredBefore: false, coveredAfter: true, transition: "UNCOVERED_TO_COVERED", changed: true },
      { requirementId: "r2", code: "R2", title: "", coveredBefore: true, coveredAfter: false, transition: "COVERED_TO_UNCOVERED", changed: true },
      { requirementId: "r3", code: "R3", title: "", coveredBefore: true, coveredAfter: true, transition: "COVERED_TO_COVERED", changed: false },
    ];

    const summary = summarizeComparison({
      structure: EMPTY_STRUCTURE,
      requirementCoverage: coverage,
      feedbackResolutions: [],
      criterionEvolutions: [],
    });

    expect(summary.requirementsNewlyCovered).toBe(1);
    expect(summary.requirementsCoverageLost).toBe(1);
  });

  it("picks the addressed feedback resolution with the most entities removed as most significant", () => {
    const resolutions: readonly FeedbackResolution[] = [
      { feedbackId: "small", status: "ADDRESSED", referencedEntities: ["A"], entitiesStillPresent: [], entitiesRemoved: ["A"], detail: "" },
      { feedbackId: "big", status: "ADDRESSED", referencedEntities: ["B", "C"], entitiesStillPresent: [], entitiesRemoved: ["B", "C"], detail: "" },
      { feedbackId: "not-addressed", status: "STILL_PRESENT", referencedEntities: ["D"], entitiesStillPresent: ["D"], entitiesRemoved: [], detail: "" },
    ];

    const summary = summarizeComparison({
      structure: EMPTY_STRUCTURE,
      requirementCoverage: [],
      feedbackResolutions: resolutions,
      criterionEvolutions: [],
    });

    expect(summary.mostSignificantFeedbackId).toBe("big");
  });

  it("leaves the most significant feedback undefined when nothing was addressed", () => {
    const summary = summarizeComparison({
      structure: EMPTY_STRUCTURE,
      requirementCoverage: [],
      feedbackResolutions: [
        { feedbackId: "a", status: "STILL_PRESENT", referencedEntities: [], entitiesStillPresent: [], entitiesRemoved: [], detail: "" },
      ],
      criterionEvolutions: [],
    });

    expect(summary.mostSignificantFeedbackId).toBeUndefined();
  });

  it("picks the most severely regressed criterion as most significant", () => {
    const evolutions: readonly CriterionEvolution[] = [
      {
        criterion: "COUPLING",
        nature: "SEMANTIC",
        before: { criterion: "COUPLING", assessment: "STRONG", evidence: [] },
        after: { criterion: "COUPLING", assessment: "NEEDS_IMPROVEMENT", evidence: [] },
        trend: "REGRESSED",
      },
      {
        criterion: "COHESION",
        nature: "SEMANTIC",
        before: { criterion: "COHESION", assessment: "ADEQUATE", evidence: [] },
        after: { criterion: "COHESION", assessment: "MISSING", evidence: [] },
        trend: "REGRESSED",
      },
    ];

    const summary = summarizeComparison({
      structure: EMPTY_STRUCTURE,
      requirementCoverage: [],
      feedbackResolutions: [],
      criterionEvolutions: evolutions,
    });

    // MISSING is the worse severity, so COHESION's fall wins even though it is
    // listed second.
    expect(summary.mostSignificantRegression).toBe("COHESION");
    expect(summary.criteriaRegressed).toBe(2);
  });
});
