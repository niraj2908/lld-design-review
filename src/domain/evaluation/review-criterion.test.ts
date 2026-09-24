import { describe, expect, it } from "vitest";
import { EVALUATION_CRITERIA } from "../problem/rubric";
import {
  DETERMINISTIC_CRITERIA,
  isDeterministicCriterion,
  natureOf,
} from "./review-criterion";

describe("review criteria", () => {
  it("names the five criteria a rule evaluator can settle", () => {
    expect([...DETERMINISTIC_CRITERIA]).toEqual([
      "STRUCTURAL_VALIDITY",
      "REQUIREMENT_COVERAGE",
      "DESIGN_COMPLETENESS",
      "EDGE_CASE_COVERAGE",
      "DESIGN_DECISIONS",
    ]);
  });

  it("keeps the deterministic and semantic sets disjoint", () => {
    const semantic = new Set<string>(EVALUATION_CRITERIA);

    for (const criterion of DETERMINISTIC_CRITERIA) {
      expect(semantic.has(criterion)).toBe(false);
    }
  });

  it.each(DETERMINISTIC_CRITERIA)("treats %s as a factual finding", (criterion) => {
    expect(isDeterministicCriterion(criterion)).toBe(true);
    expect(natureOf(criterion)).toBe("FACTUAL");
  });

  it.each(EVALUATION_CRITERIA)("treats %s as a judgement", (criterion) => {
    expect(isDeterministicCriterion(criterion)).toBe(false);
    expect(natureOf(criterion)).toBe("SEMANTIC");
  });

  it.each(["", "structural_validity", "UNKNOWN", null, 7])(
    "does not recognise %s",
    (value) => {
      expect(isDeterministicCriterion(value)).toBe(false);
    },
  );
});
