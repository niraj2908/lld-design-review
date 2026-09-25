import { describe, expect, it } from "vitest";
import type { CriterionResult } from "../evaluation/criterion-result";
import { evolveCriteria } from "./criterion-evolution";

function result(overrides: Partial<CriterionResult> = {}): CriterionResult {
  return {
    criterion: "RESPONSIBILITY",
    assessment: "NEEDS_IMPROVEMENT",
    evidence: [],
    ...overrides,
  };
}

describe("evolveCriteria", () => {
  it("returns nothing when either side has no completed evaluation", () => {
    expect(evolveCriteria(null, [result()])).toEqual([]);
    expect(evolveCriteria([result()], null)).toEqual([]);
    expect(evolveCriteria(null, null)).toEqual([]);
  });

  it("reports an improvement when the assessment rank rises", () => {
    const [evolution] = evolveCriteria(
      [result({ assessment: "NEEDS_IMPROVEMENT" })],
      [result({ assessment: "ADEQUATE" })],
    );

    expect(evolution?.trend).toBe("IMPROVED");
  });

  it("reports a regression when the assessment rank falls", () => {
    const [evolution] = evolveCriteria(
      [result({ criterion: "COUPLING", assessment: "ADEQUATE" })],
      [result({ criterion: "COUPLING", assessment: "NEEDS_IMPROVEMENT" })],
    );

    expect(evolution?.trend).toBe("REGRESSED");
  });

  it("reports unchanged when the same assessment repeats with the same concern", () => {
    const [evolution] = evolveCriteria(
      [result({ assessment: "NEEDS_IMPROVEMENT", concern: "Too many responsibilities." })],
      [result({ assessment: "NEEDS_IMPROVEMENT", concern: "Too many responsibilities." })],
    );

    expect(evolution?.trend).toBe("UNCHANGED");
  });

  it("reports changed when the assessment repeats but the concern text differs", () => {
    const [evolution] = evolveCriteria(
      [result({ assessment: "NEEDS_IMPROVEMENT", concern: "Too many responsibilities." })],
      [result({ assessment: "NEEDS_IMPROVEMENT", concern: "Still concentrated, differently." })],
    );

    expect(evolution?.trend).toBe("CHANGED");
  });

  it("never treats a criterion missing from one side as an improvement or a new concern", () => {
    // Attempt A ran the deterministic evaluator only; attempt B also had a model
    // configured. The extra criterion must not be read as design progress or
    // regression — that would blame or credit the design for an evaluator change.
    const evolutions = evolveCriteria(
      [result({ criterion: "STRUCTURAL_VALIDITY", assessment: "ADEQUATE" })],
      [
        result({ criterion: "STRUCTURAL_VALIDITY", assessment: "ADEQUATE" }),
        result({ criterion: "COHESION", assessment: "STRONG" }),
      ],
    );

    const cohesion = evolutions.find((evolution) => evolution.criterion === "COHESION");
    expect(cohesion?.trend).toBe("NOT_COMPARABLE");
  });

  it("carries the nature (factual vs semantic) of each criterion", () => {
    const [structural, semantic] = evolveCriteria(
      [
        result({ criterion: "STRUCTURAL_VALIDITY", assessment: "ADEQUATE" }),
        result({ criterion: "COHESION", assessment: "ADEQUATE" }),
      ],
      [
        result({ criterion: "STRUCTURAL_VALIDITY", assessment: "ADEQUATE" }),
        result({ criterion: "COHESION", assessment: "ADEQUATE" }),
      ],
    );

    expect(structural?.nature).toBe("FACTUAL");
    expect(semantic?.nature).toBe("SEMANTIC");
  });
});
