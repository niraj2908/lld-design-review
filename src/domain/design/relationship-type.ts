import { InvalidRelationshipError } from "../shared/errors";

export const RELATIONSHIP_TYPES = [
  "ASSOCIATION",
  "AGGREGATION",
  "COMPOSITION",
  "INHERITANCE",
  "IMPLEMENTATION",
  "DEPENDENCY",
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export function isRelationshipType(value: unknown): value is RelationshipType {
  return (
    typeof value === "string" &&
    (RELATIONSHIP_TYPES as readonly string[]).includes(value)
  );
}

export function assertRelationshipType(
  value: unknown,
  path: string,
): RelationshipType {
  if (!isRelationshipType(value)) {
    throw new InvalidRelationshipError(
      `Unsupported relationship type at ${path}. Supported types: ${RELATIONSHIP_TYPES.join(", ")}.`,
      { path, value },
    );
  }
  return value;
}
