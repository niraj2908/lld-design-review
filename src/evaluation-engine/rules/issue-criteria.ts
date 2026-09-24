import type { DeterministicCriterion } from "@/domain/evaluation/review-criterion";
import { VALIDATION_ISSUE_CODES } from "@/domain/shared/validation";
import type { ValidationIssueCode } from "@/domain/shared/validation";

/**
 * Which criterion each structural validation issue belongs to.
 *
 * The engine adds no validation of its own: `validateStructuredDesign` is the one
 * place design rules live, and this table only decides where each of its findings
 * is reported. The split is by question:
 *
 * - STRUCTURAL_VALIDITY — is the design internally well formed? Names unique and
 *   present, relationship kinds legal for their endpoints.
 * - DESIGN_COMPLETENESS — does it contain and resolve what it refers to? Not
 *   empty, responsibilities stated, every reference pointing at something real.
 *
 * A test asserts this map covers every issue code, so a new rule in the validator
 * cannot silently go unreported.
 */
export const ISSUE_CRITERIA: Readonly<
  Record<ValidationIssueCode, DeterministicCriterion>
> = {
  CLASS_NAME_REQUIRED: "STRUCTURAL_VALIDITY",
  INTERFACE_NAME_REQUIRED: "STRUCTURAL_VALIDITY",
  DUPLICATE_CLASS_NAME: "STRUCTURAL_VALIDITY",
  DUPLICATE_INTERFACE_NAME: "STRUCTURAL_VALIDITY",
  ELEMENT_NAME_COLLISION: "STRUCTURAL_VALIDITY",
  RELATIONSHIP_SOURCE_REQUIRED: "STRUCTURAL_VALIDITY",
  RELATIONSHIP_TARGET_REQUIRED: "STRUCTURAL_VALIDITY",
  UNSUPPORTED_RELATIONSHIP_TYPE: "STRUCTURAL_VALIDITY",
  INVALID_IMPLEMENTATION_SOURCE: "STRUCTURAL_VALIDITY",
  INVALID_IMPLEMENTATION_TARGET: "STRUCTURAL_VALIDITY",
  INVALID_INHERITANCE_ENDPOINT: "STRUCTURAL_VALIDITY",
  INVALID_SELF_RELATIONSHIP: "STRUCTURAL_VALIDITY",
  DUPLICATE_RELATIONSHIP: "STRUCTURAL_VALIDITY",
  NAME_TOO_LONG: "STRUCTURAL_VALIDITY",

  DESIGN_EMPTY: "DESIGN_COMPLETENESS",
  CLASS_RESPONSIBILITY_REQUIRED: "DESIGN_COMPLETENESS",
  INTERFACE_RESPONSIBILITY_REQUIRED: "DESIGN_COMPLETENESS",
  CLASS_ATTRIBUTE_NAME_REQUIRED: "DESIGN_COMPLETENESS",
  CLASS_METHOD_NAME_REQUIRED: "DESIGN_COMPLETENESS",
  INTERFACE_METHOD_NAME_REQUIRED: "DESIGN_COMPLETENESS",
  UNKNOWN_RELATIONSHIP_SOURCE: "DESIGN_COMPLETENESS",
  UNKNOWN_RELATIONSHIP_TARGET: "DESIGN_COMPLETENESS",
  UNKNOWN_EVIDENCE_ENTITY: "DESIGN_COMPLETENESS",
  REQUIREMENT_MAPPING_REFERENCE_REQUIRED: "DESIGN_COMPLETENESS",
  TEXT_TOO_LONG: "DESIGN_COMPLETENESS",
  COLLECTION_LIMIT_EXCEEDED: "DESIGN_COMPLETENESS",

  UNKNOWN_REQUIREMENT: "REQUIREMENT_COVERAGE",
  DECISION_FIELD_REQUIRED: "DESIGN_DECISIONS",
  EDGE_CASE_FIELD_REQUIRED: "EDGE_CASE_COVERAGE",
};

export const ALL_ISSUE_CODES: readonly ValidationIssueCode[] =
  VALIDATION_ISSUE_CODES;
