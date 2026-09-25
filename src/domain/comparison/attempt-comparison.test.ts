import { describe, expect, it } from "vitest";
import { emptyStructuredDesign } from "../design/structured-design";
import type { StructuredDesign } from "../design/structured-design";
import type { Requirement } from "../problem/requirement";
import type { CriterionResult } from "../evaluation/criterion-result";
import type { FeedbackItem } from "../feedback/feedback-item";
import { buildAttemptComparison } from "./attempt-comparison";

const REQUIREMENTS: readonly Requirement[] = [
  {
    id: "req_1",
    problemId: "prb_1",
    code: "PL-REQ-01",
    title: "Compatible spot allocation",
    description: "...",
    priority: "MUST",
  },
];

function design(overrides: Partial<StructuredDesign> = {}): StructuredDesign {
  return { ...emptyStructuredDesign(), ...overrides };
}

describe("buildAttemptComparison", () => {
  it("produces an empty, non-crashing comparison for two empty designs", () => {
    const comparison = buildAttemptComparison({
      requirements: REQUIREMENTS,
      designBefore: emptyStructuredDesign(),
      designAfter: emptyStructuredDesign(),
      previousFeedback: [],
      criteriaBefore: null,
      criteriaAfter: null,
    });

    expect(comparison.structure.classChanges).toEqual([]);
    expect(comparison.summary.totalStructuralChanges).toBe(0);
    expect(comparison.requirementCoverage[0]).toMatchObject({
      transition: "UNCOVERED_TO_UNCOVERED",
    });
  });

  it("reports no structural changes when the same design is submitted twice", () => {
    const twice = design({
      classes: [
        { id: "c1", name: "ParkingLot", responsibility: "Coordinates parking.", attributes: [], methods: [] },
      ],
    });

    const comparison = buildAttemptComparison({
      requirements: REQUIREMENTS,
      designBefore: twice,
      designAfter: twice,
      previousFeedback: [],
      criteriaBefore: null,
      criteriaAfter: null,
    });

    expect(comparison.summary.totalStructuralChanges).toBe(0);
    expect(
      comparison.structure.classChanges.every((change) => change.kind === "UNCHANGED"),
    ).toBe(true);
  });

  it("does not penalize a structurally different but equally valid alternative design", () => {
    // Two different, equally legitimate decompositions of the same problem. Neither
    // is compared against a reference solution, only against each other, and the
    // comparison must describe the difference without implying either is worse.
    const before = design({
      classes: [
        { id: "c1", name: "ParkingLot", responsibility: "Owns levels, allocation and pricing.", attributes: [], methods: [] },
      ],
    });
    const after = design({
      classes: [
        { id: "c2", name: "Level", responsibility: "Owns a floor's spots.", attributes: [], methods: [] },
        { id: "c3", name: "TariffBoard", responsibility: "Prices a stay.", attributes: [], methods: [] },
      ],
    });

    const comparison = buildAttemptComparison({
      requirements: REQUIREMENTS,
      designBefore: before,
      designAfter: after,
      previousFeedback: [],
      criteriaBefore: null,
      criteriaAfter: null,
    });

    // The comparison states what changed; it carries no verdict field, no score,
    // and nothing here claims one side is the correct one.
    expect(comparison.summary.classes).toEqual({ added: 2, removed: 1, modified: 0, unchanged: 0 });
    expect(comparison).not.toHaveProperty("verdict");
    expect(comparison).not.toHaveProperty("score");
  });

  it("surfaces an improvement and a new regression together, without one hiding the other", () => {
    const feedback: readonly FeedbackItem[] = [
      {
        id: "fdb_1",
        priority: "P0",
        criterion: "RESPONSIBILITY",
        what: "ParkingLot has too many responsibilities.",
        where: [{ entity: "ParkingLot" }],
        why: "Three reasons to change in one class.",
      },
    ];
    const criteriaBefore: readonly CriterionResult[] = [
      { criterion: "RESPONSIBILITY", assessment: "NEEDS_IMPROVEMENT", evidence: [] },
      { criterion: "COUPLING", assessment: "STRONG", evidence: [] },
    ];
    const criteriaAfter: readonly CriterionResult[] = [
      { criterion: "RESPONSIBILITY", assessment: "ADEQUATE", evidence: [] },
      { criterion: "COUPLING", assessment: "NEEDS_IMPROVEMENT", evidence: [] },
    ];

    const comparison = buildAttemptComparison({
      requirements: REQUIREMENTS,
      designBefore: design({
        classes: [
          { id: "c1", name: "ParkingLot", responsibility: "Does everything.", attributes: [], methods: [] },
        ],
      }),
      designAfter: design({
        classes: [
          { id: "c2", name: "SpotAllocator", responsibility: "Allocates spots.", attributes: [], methods: [] },
          { id: "c3", name: "PaymentService", responsibility: "Processes payment.", attributes: [], methods: [] },
        ],
      }),
      previousFeedback: feedback,
      criteriaBefore,
      criteriaAfter,
    });

    const improved = comparison.criterionEvolutions.find((e) => e.criterion === "RESPONSIBILITY");
    const regressed = comparison.criterionEvolutions.find((e) => e.criterion === "COUPLING");
    expect(improved?.trend).toBe("IMPROVED");
    expect(regressed?.trend).toBe("REGRESSED");
    expect(comparison.summary.criteriaImproved).toBe(1);
    expect(comparison.summary.criteriaRegressed).toBe(1);
    // Neither count is zeroed out by the other's presence.
    expect(comparison.summary.mostSignificantRegression).toBe("COUPLING");
  });

  it("cannot safely establish identity across a renamed element with no other change", () => {
    const before = design({
      classes: [
        { id: "c1", name: "ParkingLot", responsibility: "Coordinates parking.", attributes: [], methods: [] },
      ],
    });
    const after = design({
      classes: [
        { id: "c2", name: "Garage", responsibility: "Coordinates parking.", attributes: [], methods: [] },
      ],
    });

    const comparison = buildAttemptComparison({
      requirements: REQUIREMENTS,
      designBefore: before,
      designAfter: after,
      previousFeedback: [],
      criteriaBefore: null,
      criteriaAfter: null,
    });

    // Honest about the limitation: a rename with everything else identical is
    // indistinguishable from a removal and a fresh addition, and it must be
    // reported as exactly that rather than a guessed-at "renamed" claim.
    expect(comparison.structure.classChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "REMOVED", name: "ParkingLot" }),
        expect.objectContaining({ kind: "ADDED", name: "Garage" }),
      ]),
    );
  });
});
