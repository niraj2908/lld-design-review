import type {
  AttributeDefinition,
  MethodDefinition,
  StructuredDesign,
} from "@/domain/design/structured-design";
import { PersistenceMappingError } from "../persistence-errors";
import type {
  DesignClassRow,
  DesignInterfaceRow,
  DesignReferenceRow,
  DesignRow,
} from "./rows";

/**
 * Write payload for one design and all of its children.
 *
 * It is a plain object so this module stays free of Prisma types; the repository
 * hands it to `prisma.design.create({ data })`, whose nested-create input it
 * satisfies structurally.
 */
export interface DesignCreateData {
  readonly classes: { readonly create: DesignClassCreate[] };
  readonly interfaces: { readonly create: DesignInterfaceCreate[] };
  readonly relationships: { readonly create: DesignRelationshipCreate[] };
  readonly decisions: { readonly create: DesignDecisionCreate[] };
  readonly edgeCases: { readonly create: DesignEdgeCaseCreate[] };
  readonly requirementMappings: {
    readonly create: DesignRequirementMappingCreate[];
  };
}

/**
 * JSON columns accept only plain string-keyed records, and the domain's optional
 * fields are absent rather than `undefined`, so the leaf lists are rebuilt as
 * flat records with no absent-vs-null ambiguity.
 */
type JsonLeaf = Record<string, string>;

interface DesignClassCreate {
  readonly elementId: string;
  readonly name: string;
  readonly responsibility: string;
  readonly attributes: JsonLeaf[];
  readonly methods: JsonLeaf[];
  readonly position: number;
}

interface DesignInterfaceCreate {
  readonly elementId: string;
  readonly name: string;
  readonly responsibility: string;
  readonly methods: JsonLeaf[];
  readonly position: number;
}

interface DesignRelationshipCreate {
  readonly source: string;
  readonly target: string;
  readonly type: StructuredDesign["relationships"][number]["type"];
  readonly cardinality: string | null;
  readonly rationale: string | null;
  readonly position: number;
}

interface DesignDecisionCreate {
  readonly decision: string;
  readonly rationale: string;
  readonly tradeoff: string;
  readonly position: number;
}

interface DesignEdgeCaseCreate {
  readonly description: string;
  readonly expectedBehavior: string;
  readonly position: number;
}

interface DesignReferenceCreate {
  readonly entity: string;
  readonly field: string | null;
  readonly value: string | null;
  readonly position: number;
}

interface DesignRequirementMappingCreate {
  /**
   * Connected rather than set as a raw column: Prisma's nested writes require a
   * single style per record, and this row also creates its own references.
   */
  readonly requirement: { readonly connect: { readonly id: string } };
  readonly note: string | null;
  readonly position: number;
  readonly references: { readonly create: DesignReferenceCreate[] };
}

export function toDesignCreateData(design: StructuredDesign): DesignCreateData {
  return {
    classes: {
      create: design.classes.map((definition, position) => ({
        elementId: definition.id,
        name: definition.name,
        responsibility: definition.responsibility,
        attributes: definition.attributes.map(toAttributeJson),
        methods: definition.methods.map(toMethodJson),
        position,
      })),
    },
    interfaces: {
      create: design.interfaces.map((definition, position) => ({
        elementId: definition.id,
        name: definition.name,
        responsibility: definition.responsibility,
        methods: definition.methods.map(toMethodJson),
        position,
      })),
    },
    relationships: {
      create: design.relationships.map((relationship, position) => ({
        source: relationship.source,
        target: relationship.target,
        type: relationship.type,
        cardinality: relationship.cardinality ?? null,
        rationale: relationship.rationale ?? null,
        position,
      })),
    },
    decisions: {
      create: design.decisions.map((decision, position) => ({
        decision: decision.decision,
        rationale: decision.rationale,
        tradeoff: decision.tradeoff,
        position,
      })),
    },
    edgeCases: {
      create: design.edgeCases.map((edgeCase, position) => ({
        description: edgeCase.description,
        expectedBehavior: edgeCase.expectedBehavior,
        position,
      })),
    },
    requirementMappings: {
      create: design.requirementMappings.map((mapping, position) => ({
        requirement: { connect: { id: mapping.requirementId } },
        note: mapping.note ?? null,
        position,
        references: {
          create: mapping.references.map((reference, referencePosition) => ({
            entity: reference.entity,
            field: reference.field ?? null,
            value: reference.value ?? null,
            position: referencePosition,
          })),
        },
      })),
    },
  };
}

function toAttributeJson(attribute: AttributeDefinition): JsonLeaf {
  const leaf: JsonLeaf = { name: attribute.name };
  if (attribute.type !== undefined) {
    leaf.type = attribute.type;
  }
  return leaf;
}

function toMethodJson(method: MethodDefinition): JsonLeaf {
  const leaf: JsonLeaf = { name: method.name };
  if (method.signature !== undefined) {
    leaf.signature = method.signature;
  }
  if (method.description !== undefined) {
    leaf.description = method.description;
  }
  return leaf;
}

export function toStructuredDesign(row: DesignRow): StructuredDesign {
  return {
    classes: byPosition(row.classes).map(toClassDefinition),
    interfaces: byPosition(row.interfaces).map(toInterfaceDefinition),
    relationships: byPosition(row.relationships).map((relationship) =>
      withOptionals(
        {
          source: relationship.source,
          target: relationship.target,
          type: relationship.type,
        },
        {
          cardinality: relationship.cardinality,
          rationale: relationship.rationale,
        },
      ),
    ),
    decisions: byPosition(row.decisions).map((decision) => ({
      decision: decision.decision,
      rationale: decision.rationale,
      tradeoff: decision.tradeoff,
    })),
    edgeCases: byPosition(row.edgeCases).map((edgeCase) => ({
      description: edgeCase.description,
      expectedBehavior: edgeCase.expectedBehavior,
    })),
    requirementMappings: byPosition(row.requirementMappings).map((mapping) =>
      withOptionals(
        {
          requirementId: mapping.requirementId,
          references: byPosition(mapping.references).map(toReference),
        },
        { note: mapping.note },
      ),
    ),
  };
}

function toClassDefinition(row: DesignClassRow) {
  return {
    id: row.elementId,
    name: row.name,
    responsibility: row.responsibility,
    attributes: toAttributes(row.attributes, row.name),
    methods: toMethods(row.methods, row.name),
  };
}

function toInterfaceDefinition(row: DesignInterfaceRow) {
  return {
    id: row.elementId,
    name: row.name,
    responsibility: row.responsibility,
    methods: toMethods(row.methods, row.name),
  };
}

function toReference(row: DesignReferenceRow) {
  return withOptionals({ entity: row.entity }, {
    field: row.field,
    value: row.value,
  });
}

/**
 * `exactOptionalPropertyTypes` is on, so a nullable column must become an absent
 * property rather than an explicit `undefined`; otherwise a round trip would not
 * equal the design that was stored.
 */
function withOptionals<T extends object>(
  base: T,
  optionals: Readonly<Record<string, string | null>>,
): T {
  let result = base;
  for (const [key, value] of Object.entries(optionals)) {
    if (value !== null) {
      result = { ...result, [key]: value };
    }
  }
  return result;
}

function byPosition<T extends { readonly position: number }>(
  rows: readonly T[],
): readonly T[] {
  return rows.toSorted((left, right) => left.position - right.position);
}

function toAttributes(
  value: unknown,
  owner: string,
): readonly AttributeDefinition[] {
  return jsonList(value, `${owner}.attributes`).map((entry) =>
    withOptionals({ name: requiredString(entry.name, `${owner}.attributes`) }, {
      type: optionalString(entry.type),
    }),
  );
}

function toMethods(value: unknown, owner: string): readonly MethodDefinition[] {
  return jsonList(value, `${owner}.methods`).map((entry) =>
    withOptionals({ name: requiredString(entry.name, `${owner}.methods`) }, {
      signature: optionalString(entry.signature),
      description: optionalString(entry.description),
    }),
  );
}

function jsonList(
  value: unknown,
  path: string,
): readonly Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new PersistenceMappingError(
      `Stored "${path}" is not a JSON array, so the design cannot be rebuilt.`,
    );
  }
  return value.map((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new PersistenceMappingError(
        `Stored "${path}" contains an entry that is not an object.`,
      );
    }
    return entry as Record<string, unknown>;
  });
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new PersistenceMappingError(
      `Stored "${path}" entry is missing its name.`,
    );
  }
  return value;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
