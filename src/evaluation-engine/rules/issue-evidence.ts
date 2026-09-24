import type { DesignElementIndex } from "@/domain/design/design-element-index";
import type { StructuredDesign } from "@/domain/design/structured-design";
import type { Evidence } from "@/domain/feedback/evidence";
import type { ValidationIssue } from "@/domain/shared/validation";

const PATH_HEAD = /^([A-Za-z]+)\[(\d+)\](?:\.(.+))?$/;

/**
 * Resolves a validation issue's path to evidence in the submitted design.
 *
 * Returns nothing when the issue is about something that cannot be pointed at —
 * a class with no name, a decision, an endpoint that does not exist. An empty
 * result is the correct answer there: inventing an entity would make the finding
 * look grounded when it is not.
 */
export function evidenceForIssue(
  issue: ValidationIssue,
  design: StructuredDesign,
  elements: DesignElementIndex,
): readonly Evidence[] {
  const match = PATH_HEAD.exec(issue.path);
  if (match === null) {
    return [];
  }

  const collection = match[1] ?? "";
  const index = Number(match[2]);
  const field = match[3];

  switch (collection) {
    case "classes":
      return namedElement(design.classes[index]?.name, "classes", field);
    case "interfaces":
      return namedElement(design.interfaces[index]?.name, "interfaces", field);
    case "relationships":
      return relationshipEvidence(design, elements, index);
    case "requirementMappings":
      return mappingEvidence(design, elements, index);
    default:
      // Decisions and edge cases are not design elements, so there is no entity
      // to name. The finding text carries the position instead.
      return [];
  }
}

function namedElement(
  name: string | undefined,
  collection: string,
  field: string | undefined,
): readonly Evidence[] {
  const entity = name?.trim() ?? "";
  if (entity.length === 0) {
    return [];
  }
  return [
    field === undefined
      ? { entity, field: collection }
      : { entity, field, value: collection },
  ];
}

function relationshipEvidence(
  design: StructuredDesign,
  elements: DesignElementIndex,
  index: number,
): readonly Evidence[] {
  const relationship = design.relationships[index];
  if (relationship === undefined) {
    return [];
  }

  const source = relationship.source.trim();
  const target = relationship.target.trim();
  const entity = elements.has(source)
    ? source
    : elements.has(target)
      ? target
      : null;
  if (entity === null) {
    return [];
  }

  return [
    {
      entity,
      field: "relationships",
      value: `${source} -> ${target} (${String(relationship.type)})`,
    },
  ];
}

function mappingEvidence(
  design: StructuredDesign,
  elements: DesignElementIndex,
  index: number,
): readonly Evidence[] {
  const mapping = design.requirementMappings[index];
  if (mapping === undefined) {
    return [];
  }

  const entity = mapping.references
    .map((reference) => reference.entity.trim())
    .find((candidate) => elements.has(candidate));
  if (entity === undefined) {
    return [];
  }

  return [
    {
      entity,
      field: "requirementMappings",
      value: mapping.requirementId,
    },
  ];
}
