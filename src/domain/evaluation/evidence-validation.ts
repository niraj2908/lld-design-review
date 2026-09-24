import { buildDesignElementIndex } from "../design/design-element-index";
import type { StructuredDesign } from "../design/structured-design";
import type { Evidence } from "../feedback/evidence";

/**
 * Fields of a design element that evidence may point at. Anything else is a
 * field the submission format does not have, so a claim about it cannot be true.
 */
export const EVIDENCE_FIELDS = [
  "responsibility",
  "attributes",
  "methods",
  "relationships",
  "decisions",
  "edgeCases",
  "requirementMappings",
] as const;

export type EvidenceField = (typeof EVIDENCE_FIELDS)[number];

export const EVIDENCE_REJECTIONS = [
  "UNKNOWN_ENTITY",
  "UNKNOWN_FIELD",
  "VALUE_NOT_FOUND",
] as const;

export type EvidenceRejection = (typeof EVIDENCE_REJECTIONS)[number];

export interface RejectedEvidence {
  readonly evidence: Evidence;
  readonly reason: EvidenceRejection;
}

export interface EvidenceValidationResult {
  /** Evidence that was found in the submitted design, verbatim. */
  readonly verified: readonly Evidence[];
  readonly rejected: readonly RejectedEvidence[];
}

/**
 * Checks evidence against the design it claims to describe.
 *
 * A model's output is a claim, not a fact, and this is where the difference is
 * settled: an entity that is not in the design, a field the format does not
 * have, or a value that does not appear in the named element is rejected, and a
 * caller must not present it to the learner as grounding.
 */
export function validateEvidence(
  evidence: readonly Evidence[],
  design: StructuredDesign,
): EvidenceValidationResult {
  const elements = buildDesignElementIndex(design);
  const verified: Evidence[] = [];
  const rejected: RejectedEvidence[] = [];

  for (const item of evidence) {
    const entity = item.entity.trim();
    if (!elements.has(entity)) {
      rejected.push({ evidence: item, reason: "UNKNOWN_ENTITY" });
      continue;
    }

    if (item.field !== undefined && !isEvidenceField(item.field)) {
      rejected.push({ evidence: item, reason: "UNKNOWN_FIELD" });
      continue;
    }

    if (item.value !== undefined && !valueAppears(design, entity, item)) {
      rejected.push({ evidence: item, reason: "VALUE_NOT_FOUND" });
      continue;
    }

    verified.push(item);
  }

  return { verified, rejected };
}

export function isEvidenceField(value: string): value is EvidenceField {
  return (EVIDENCE_FIELDS as readonly string[]).includes(value);
}

/**
 * A quoted value has to appear in the submitted text of the element it is
 * attributed to. The comparison is case-insensitive and whitespace-normalised so
 * a model that reflows a sentence is not punished, but it is still a containment
 * check against real submitted text rather than a similarity score.
 */
function valueAppears(
  design: StructuredDesign,
  entity: string,
  item: Evidence,
): boolean {
  const needle = normalize(item.value ?? "");
  if (needle.length === 0) {
    return false;
  }
  return searchable(design, entity, item.field).some((haystack) =>
    normalize(haystack).includes(needle),
  );
}

function searchable(
  design: StructuredDesign,
  entity: string,
  field: string | undefined,
): readonly string[] {
  const definition = design.classes.find(
    (candidate) => candidate.name.trim() === entity,
  );
  const contract = design.interfaces.find(
    (candidate) => candidate.name.trim() === entity,
  );

  const responsibility = definition?.responsibility ?? contract?.responsibility;
  const attributes = (definition?.attributes ?? []).flatMap((attribute) => [
    attribute.name,
    attribute.type ?? "",
  ]);
  const methods = [
    ...(definition?.methods ?? []),
    ...(contract?.methods ?? []),
  ].flatMap((method) => [
    method.name,
    method.signature ?? "",
    method.description ?? "",
  ]);

  const relationships = design.relationships
    .filter(
      (relationship) =>
        relationship.source.trim() === entity ||
        relationship.target.trim() === entity,
    )
    .flatMap((relationship) => [
      `${relationship.source} -> ${relationship.target}`,
      `${String(relationship.type)} -> ${relationship.target}`,
      `${relationship.source} -> ${String(relationship.type)} -> ${relationship.target}`,
      String(relationship.type),
      relationship.rationale ?? "",
    ]);

  const mappings = design.requirementMappings
    .filter((mapping) =>
      mapping.references.some(
        (reference) => reference.entity.trim() === entity,
      ),
    )
    .flatMap((mapping) => [mapping.requirementId, mapping.note ?? ""]);

  const decisions = design.decisions.flatMap((decision) => [
    decision.decision,
    decision.rationale,
    decision.tradeoff,
  ]);
  const edgeCases = design.edgeCases.flatMap((edgeCase) => [
    edgeCase.description,
    edgeCase.expectedBehavior,
  ]);

  switch (field) {
    case "responsibility":
      return responsibility === undefined ? [] : [responsibility];
    case "attributes":
      return attributes;
    case "methods":
      return methods;
    case "relationships":
      return relationships;
    case "requirementMappings":
      return mappings;
    case "decisions":
      return decisions;
    case "edgeCases":
      return edgeCases;
    default:
      // No field named: the value may appear anywhere that belongs to the entity.
      return [
        responsibility ?? "",
        ...attributes,
        ...methods,
        ...relationships,
        ...mappings,
      ];
  }
}

function normalize(value: string): string {
  return value.trim().replaceAll(/\s+/gu, " ").toLowerCase();
}
