import { describe, expect, it } from "vitest";
import { buildDesignElementIndex } from "@/domain/design/design-element-index";
import { validateStructuredDesign } from "@/domain/design/design-validator";
import { emptyStructuredDesign } from "@/domain/design/structured-design";
import { DETERMINISTIC_CRITERIA } from "@/domain/evaluation/review-criterion";
import { VALIDATION_ISSUE_CODES } from "@/domain/shared/validation";
import { analyseDesignCompleteness } from "./design-completeness";
import { ISSUE_CRITERIA } from "./issue-criteria";

describe("issue-to-criterion map", () => {
  it("assigns every validation issue code to a criterion", () => {
    const unmapped = VALIDATION_ISSUE_CODES.filter(
      (code) => ISSUE_CRITERIA[code] === undefined,
    );

    expect(unmapped).toEqual([]);
  });

  it("assigns each code to exactly one of the deterministic criteria", () => {
    for (const code of VALIDATION_ISSUE_CODES) {
      expect(DETERMINISTIC_CRITERIA).toContain(ISSUE_CRITERIA[code]);
    }
  });

  it("does not route a code to a criterion that reports nothing else", () => {
    const used = new Set(Object.values(ISSUE_CRITERIA));

    expect(used).toContain("STRUCTURAL_VALIDITY");
    expect(used).toContain("DESIGN_COMPLETENESS");
    expect(used).toContain("REQUIREMENT_COVERAGE");
  });
});

describe("design completeness on an empty design", () => {
  it("reports DESIGN_EMPTY when given one directly", () => {
    const design = emptyStructuredDesign();
    const issues = validateStructuredDesign(design, {
      requirementIds: [],
    }).issues;

    const analysis = analyseDesignCompleteness({
      issues,
      design,
      elements: buildDesignElementIndex(design),
    });

    expect(analysis.assessment).toBe("NEEDS_IMPROVEMENT");
    expect(analysis.findings.map((finding) => finding.code)).toEqual([
      "DESIGN_EMPTY",
    ]);
    expect(analysis.findings[0]?.where).toEqual([]);
  });
});
