import type { StructuredDesign } from "../design/structured-design";
import type { ClassChange } from "./class-comparison";
import { compareClasses } from "./class-comparison";
import type { InterfaceChange } from "./interface-comparison";
import { compareInterfaces } from "./interface-comparison";
import type { RelationshipChange } from "./relationship-comparison";
import { compareRelationships } from "./relationship-comparison";
import type { DecisionChange } from "./decision-comparison";
import { compareDecisions } from "./decision-comparison";
import type { EdgeCaseChange } from "./edge-case-comparison";
import { compareEdgeCases } from "./edge-case-comparison";

export interface DesignStructureComparison {
  readonly classChanges: readonly ClassChange[];
  readonly interfaceChanges: readonly InterfaceChange[];
  readonly relationshipChanges: readonly RelationshipChange[];
  readonly decisionChanges: readonly DecisionChange[];
  readonly edgeCaseChanges: readonly EdgeCaseChange[];
}

/**
 * The full structural comparison between two submitted designs, one element
 * kind at a time. Each kind is compared independently and by its own identity
 * rule (name, endpoints, or exact text — see `identity.ts`), because a class
 * rename and a relationship's target moving are different shapes of "the old
 * name is gone" and must not be collapsed into one generic diff.
 */
export function compareDesigns(
  before: StructuredDesign,
  after: StructuredDesign,
): DesignStructureComparison {
  return {
    classChanges: compareClasses(before.classes, after.classes),
    interfaceChanges: compareInterfaces(before.interfaces, after.interfaces),
    relationshipChanges: compareRelationships(
      before.relationships,
      after.relationships,
    ),
    decisionChanges: compareDecisions(before.decisions, after.decisions),
    edgeCaseChanges: compareEdgeCases(before.edgeCases, after.edgeCases),
  };
}
