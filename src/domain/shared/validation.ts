export type ValidationSeverity = "ERROR" | "WARNING";

export const VALIDATION_ISSUE_CODES = [
  "DESIGN_EMPTY",
  "CLASS_NAME_REQUIRED",
  "CLASS_RESPONSIBILITY_REQUIRED",
  "CLASS_ATTRIBUTE_NAME_REQUIRED",
  "CLASS_METHOD_NAME_REQUIRED",
  "DUPLICATE_CLASS_NAME",
  "INTERFACE_NAME_REQUIRED",
  "INTERFACE_RESPONSIBILITY_REQUIRED",
  "INTERFACE_METHOD_NAME_REQUIRED",
  "DUPLICATE_INTERFACE_NAME",
  "ELEMENT_NAME_COLLISION",
  "RELATIONSHIP_SOURCE_REQUIRED",
  "RELATIONSHIP_TARGET_REQUIRED",
  "UNSUPPORTED_RELATIONSHIP_TYPE",
  "UNKNOWN_RELATIONSHIP_SOURCE",
  "UNKNOWN_RELATIONSHIP_TARGET",
  "INVALID_IMPLEMENTATION_SOURCE",
  "INVALID_IMPLEMENTATION_TARGET",
  "INVALID_INHERITANCE_ENDPOINT",
  "INVALID_SELF_RELATIONSHIP",
  "DUPLICATE_RELATIONSHIP",
  "DECISION_FIELD_REQUIRED",
  "EDGE_CASE_FIELD_REQUIRED",
  "UNKNOWN_REQUIREMENT",
  "REQUIREMENT_MAPPING_REFERENCE_REQUIRED",
  "UNKNOWN_EVIDENCE_ENTITY",
  "NAME_TOO_LONG",
  "TEXT_TOO_LONG",
  "COLLECTION_LIMIT_EXCEEDED",
] as const;

export type ValidationIssueCode = (typeof VALIDATION_ISSUE_CODES)[number];

export interface ValidationIssue {
  readonly code: ValidationIssueCode;
  readonly path: string;
  readonly message: string;
  readonly severity: ValidationSeverity;
}

export interface ValidationResult {
  readonly issues: readonly ValidationIssue[];
}

export function blockingIssues(
  result: ValidationResult,
): readonly ValidationIssue[] {
  return result.issues.filter((issue) => issue.severity === "ERROR");
}

export function isValid(result: ValidationResult): boolean {
  return blockingIssues(result).length === 0;
}

export function hasIssueCode(
  result: ValidationResult,
  code: ValidationIssueCode,
): boolean {
  return result.issues.some((issue) => issue.code === code);
}
