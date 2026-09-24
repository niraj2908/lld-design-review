import { validateStructuredDesign } from "../design/design-validator";
import { normalizeText } from "../shared/text";
import type { ValidationResult } from "../shared/validation";
import type {
  AttributeDefinition,
  ClassDefinition,
  DesignDecision,
  DesignElementReference,
  EdgeCase,
  InterfaceDefinition,
  MethodDefinition,
  Relationship,
  RequirementMapping,
  StructuredDesign,
} from "../design/structured-design";
import type {
  SubmissionFormat,
  SubmissionFormatContext,
} from "./submission-format";
import { STRUCTURED_DESIGN } from "./submission-format-type";

/**
 * Normalization is deliberately lossless about intent and strict about shape:
 * unknown keys are dropped, text is trimmed, and missing collections become
 * empty arrays so validation can report real gaps instead of crashing.
 */
export const structuredDesignFormat: SubmissionFormat<StructuredDesign> = {
  type: STRUCTURED_DESIGN,

  normalize(input: unknown): StructuredDesign {
    const record = asRecord(input);
    return {
      classes: asArray(record.classes).map(normalizeClass),
      interfaces: asArray(record.interfaces).map(normalizeInterface),
      relationships: asArray(record.relationships).map(normalizeRelationship),
      decisions: asArray(record.decisions).map(normalizeDecision),
      edgeCases: asArray(record.edgeCases).map(normalizeEdgeCase),
      requirementMappings: asArray(record.requirementMappings).map(
        normalizeRequirementMapping,
      ),
    };
  },

  validate(
    payload: StructuredDesign,
    context: SubmissionFormatContext,
  ): ValidationResult {
    return validateStructuredDesign(payload, {
      requirementIds: context.requirementIds,
    });
  },
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function asText(value: unknown): string {
  return typeof value === "string" ? normalizeText(value) : "";
}

function asOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const text = normalizeText(value);
  return text.length === 0 ? undefined : text;
}

function withOptional<T extends object, K extends string, V>(
  base: T,
  key: K,
  value: V | undefined,
): T & Partial<Record<K, V>> {
  return value === undefined ? base : { ...base, [key]: value };
}

function normalizeAttribute(value: unknown): AttributeDefinition {
  const record = asRecord(value);
  return withOptional(
    { name: asText(record.name) },
    "type",
    asOptionalText(record.type),
  );
}

function normalizeMethod(value: unknown): MethodDefinition {
  const record = asRecord(value);
  const base = withOptional(
    { name: asText(record.name) },
    "signature",
    asOptionalText(record.signature),
  );
  return withOptional(base, "description", asOptionalText(record.description));
}

function normalizeClass(value: unknown, index: number): ClassDefinition {
  const record = asRecord(value);
  return {
    id: asOptionalText(record.id) ?? `class-${index + 1}`,
    name: asText(record.name),
    responsibility: asText(record.responsibility),
    attributes: asArray(record.attributes).map(normalizeAttribute),
    methods: asArray(record.methods).map(normalizeMethod),
  };
}

function normalizeInterface(value: unknown, index: number): InterfaceDefinition {
  const record = asRecord(value);
  return {
    id: asOptionalText(record.id) ?? `interface-${index + 1}`,
    name: asText(record.name),
    responsibility: asText(record.responsibility),
    methods: asArray(record.methods).map(normalizeMethod),
  };
}

function normalizeRelationship(value: unknown): Relationship {
  const record = asRecord(value);
  const base: Relationship = {
    source: asText(record.source),
    target: asText(record.target),
    // Validation reports an unsupported type; normalization must not throw.
    type: record.type as Relationship["type"],
  };
  return withOptional(
    withOptional(base, "cardinality", asOptionalText(record.cardinality)),
    "rationale",
    asOptionalText(record.rationale),
  );
}

function normalizeDecision(value: unknown): DesignDecision {
  const record = asRecord(value);
  return {
    decision: asText(record.decision),
    rationale: asText(record.rationale),
    tradeoff: asText(record.tradeoff),
  };
}

function normalizeEdgeCase(value: unknown): EdgeCase {
  const record = asRecord(value);
  return {
    description: asText(record.description),
    expectedBehavior: asText(record.expectedBehavior),
  };
}

function normalizeReference(value: unknown): DesignElementReference {
  const record = asRecord(value);
  const base = withOptional(
    { entity: asText(record.entity) },
    "field",
    asOptionalText(record.field),
  );
  return withOptional(base, "value", asOptionalText(record.value));
}

function normalizeRequirementMapping(value: unknown): RequirementMapping {
  const record = asRecord(value);
  const base: RequirementMapping = {
    requirementId: asText(record.requirementId),
    references: asArray(record.references).map(normalizeReference),
  };
  return withOptional(base, "note", asOptionalText(record.note));
}
