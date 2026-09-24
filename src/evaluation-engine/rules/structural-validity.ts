import type { DesignElementIndex } from "@/domain/design/design-element-index";
import type { StructuredDesign } from "@/domain/design/structured-design";
import type { ValidationIssue } from "@/domain/shared/validation";
import { analyseIssues } from "./structural-rules";
import type { RuleAnalysis } from "./rule-analysis";

/** Is the design internally well formed, judged only on its own consistency? */
export function analyseStructuralValidity(input: {
  readonly issues: readonly ValidationIssue[];
  readonly design: StructuredDesign;
  readonly elements: DesignElementIndex;
}): RuleAnalysis {
  return analyseIssues({
    criterion: "STRUCTURAL_VALIDITY",
    issues: input.issues,
    design: input.design,
    elements: input.elements,
    passedStrength:
      "Element names are unique and every relationship uses a kind its endpoints allow.",
    suggestion:
      "Rename or remove the conflicting element, or correct the relationship so its endpoints match its kind.",
  });
}
