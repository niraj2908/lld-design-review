import type { DesignElementIndex } from "@/domain/design/design-element-index";
import type { StructuredDesign } from "@/domain/design/structured-design";
import type { ValidationIssue } from "@/domain/shared/validation";
import { analyseIssues } from "./structural-rules";
import type { RuleAnalysis } from "./rule-analysis";

/**
 * Does the design contain what it needs to be reviewable, and does everything it
 * refers to actually exist? Nothing here judges how much design is enough.
 */
export function analyseDesignCompleteness(input: {
  readonly issues: readonly ValidationIssue[];
  readonly design: StructuredDesign;
  readonly elements: DesignElementIndex;
}): RuleAnalysis {
  return analyseIssues({
    criterion: "DESIGN_COMPLETENESS",
    issues: input.issues,
    design: input.design,
    elements: input.elements,
    passedStrength:
      "Every class and interface states a responsibility, and every reference in the design resolves to an element that exists.",
    suggestion:
      "Add the missing element, or point the reference at one that is part of this design.",
  });
}
