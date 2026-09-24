import { RELATIONSHIP_TYPES } from "@/domain/design/relationship-type";
import type { StructuredDesign } from "@/domain/design/structured-design";

export const RELATIONSHIP_OPTIONS = RELATIONSHIP_TYPES;

/**
 * The editor's working shape.
 *
 * Optional domain fields become plain strings here, because a controlled input needs
 * a value and `undefined` is not one. `toStructuredDesign` drops the empties again on
 * the way out, so a blank field never reaches the server as an empty string the
 * domain would then reject.
 */
export interface DraftClass {
  readonly key: string;
  name: string;
  responsibility: string;
  attributes: { key: string; name: string; type: string }[];
  methods: { key: string; name: string; signature: string }[];
}

export interface DraftInterface {
  readonly key: string;
  name: string;
  responsibility: string;
  methods: { key: string; name: string; signature: string }[];
}

export interface DraftRelationship {
  readonly key: string;
  source: string;
  target: string;
  type: (typeof RELATIONSHIP_TYPES)[number];
  rationale: string;
}

export interface DraftDecision {
  readonly key: string;
  decision: string;
  rationale: string;
  tradeoff: string;
}

export interface DraftEdgeCase {
  readonly key: string;
  description: string;
  expectedBehavior: string;
}

export interface DraftMapping {
  readonly key: string;
  requirementId: string;
  entities: string;
  note: string;
  /**
   * What was stored for this mapping before editing.
   *
   * The editor only exposes element names, but a stored reference may also carry a
   * field and a quoted value. Keeping the original means opening and re-saving a
   * draft does not silently discard detail the learner cannot see; it is used
   * whenever the element list is still the one that was loaded.
   */
  readonly loaded: readonly { entity: string; field?: string; value?: string }[];
}

export interface DraftState {
  classes: DraftClass[];
  interfaces: DraftInterface[];
  relationships: DraftRelationship[];
  decisions: DraftDecision[];
  edgeCases: DraftEdgeCase[];
  mappings: DraftMapping[];
}

let keySeed = 0;

/** Stable keys for React rows. Never sent to the server. */
export function nextKey(prefix: string): string {
  keySeed += 1;
  return `${prefix}-${keySeed}`;
}

export function emptyDraft(): DraftState {
  return {
    classes: [],
    interfaces: [],
    relationships: [],
    decisions: [],
    edgeCases: [],
    mappings: [],
  };
}

export function toDraftState(design: StructuredDesign | null): DraftState {
  if (design === null) {
    return emptyDraft();
  }

  return {
    classes: design.classes.map((definition) => ({
      key: nextKey("class"),
      name: definition.name,
      responsibility: definition.responsibility,
      attributes: definition.attributes.map((attribute) => ({
        key: nextKey("attr"),
        name: attribute.name,
        type: attribute.type ?? "",
      })),
      methods: definition.methods.map((method) => ({
        key: nextKey("method"),
        name: method.name,
        signature: method.signature ?? "",
      })),
    })),
    interfaces: design.interfaces.map((contract) => ({
      key: nextKey("interface"),
      name: contract.name,
      responsibility: contract.responsibility,
      methods: contract.methods.map((method) => ({
        key: nextKey("method"),
        name: method.name,
        signature: method.signature ?? "",
      })),
    })),
    relationships: design.relationships.map((relationship) => ({
      key: nextKey("rel"),
      source: relationship.source,
      target: relationship.target,
      type: relationship.type,
      rationale: relationship.rationale ?? "",
    })),
    decisions: design.decisions.map((decision) => ({
      key: nextKey("decision"),
      decision: decision.decision,
      rationale: decision.rationale,
      tradeoff: decision.tradeoff,
    })),
    edgeCases: design.edgeCases.map((edgeCase) => ({
      key: nextKey("edge"),
      description: edgeCase.description,
      expectedBehavior: edgeCase.expectedBehavior,
    })),
    mappings: design.requirementMappings.map((mapping) => ({
      key: nextKey("mapping"),
      requirementId: mapping.requirementId,
      entities: mapping.references.map((reference) => reference.entity).join(", "),
      note: mapping.note ?? "",
      loaded: mapping.references.map((reference) => ({ ...reference })),
    })),
  };
}

/** The wire shape. Blank optional fields are omitted rather than sent as "". */
export function toStructuredDesign(state: DraftState): StructuredDesign {
  return {
    classes: state.classes.map((definition) => ({
      id: slug(definition.name),
      name: definition.name.trim(),
      responsibility: definition.responsibility.trim(),
      attributes: definition.attributes
        .filter((attribute) => attribute.name.trim().length > 0)
        .map((attribute) =>
          withOptional({ name: attribute.name.trim() }, "type", attribute.type),
        ),
      methods: definition.methods
        .filter((method) => method.name.trim().length > 0)
        .map((method) =>
          withOptional({ name: method.name.trim() }, "signature", method.signature),
        ),
    })),
    interfaces: state.interfaces.map((contract) => ({
      id: slug(contract.name),
      name: contract.name.trim(),
      responsibility: contract.responsibility.trim(),
      methods: contract.methods
        .filter((method) => method.name.trim().length > 0)
        .map((method) =>
          withOptional({ name: method.name.trim() }, "signature", method.signature),
        ),
    })),
    relationships: state.relationships.map((relationship) =>
      withOptional(
        {
          source: relationship.source.trim(),
          target: relationship.target.trim(),
          type: relationship.type,
        },
        "rationale",
        relationship.rationale,
      ),
    ),
    decisions: state.decisions.map((decision) => ({
      decision: decision.decision.trim(),
      rationale: decision.rationale.trim(),
      tradeoff: decision.tradeoff.trim(),
    })),
    edgeCases: state.edgeCases.map((edgeCase) => ({
      description: edgeCase.description.trim(),
      expectedBehavior: edgeCase.expectedBehavior.trim(),
    })),
    requirementMappings: state.mappings
      .filter((mapping) => mapping.requirementId.trim().length > 0)
      .map((mapping) =>
        withOptional(
          {
            requirementId: mapping.requirementId.trim(),
            references: referencesFor(mapping),
          },
          "note",
          mapping.note,
        ),
      ),
  };
}

/**
 * The stored references when the learner has not changed which elements are named,
 * and plain entity references when they have.
 */
function referencesFor(
  mapping: DraftMapping,
): readonly { entity: string; field?: string; value?: string }[] {
  const typed = mapping.entities
    .split(",")
    .map((entity) => entity.trim())
    .filter((entity) => entity.length > 0);

  const loadedNames = mapping.loaded.map((reference) => reference.entity.trim());
  const unchanged =
    typed.length === loadedNames.length &&
    typed.every((entity, index) => entity === loadedNames[index]);

  return unchanged
    ? mapping.loaded.map((reference) => ({ ...reference }))
    : typed.map((entity) => ({ entity }));
}

function withOptional<T extends object>(
  base: T,
  key: string,
  value: string,
): T {
  const trimmed = value.trim();
  return trimmed.length === 0 ? base : { ...base, [key]: trimmed };
}

function slug(name: string): string {
  const cleaned = name.trim().toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-");
  return cleaned.length === 0 ? "element" : cleaned;
}

/** Element names the learner can point a relationship or a mapping at. */
export function elementNames(state: DraftState): readonly string[] {
  return [
    ...state.classes.map((definition) => definition.name.trim()),
    ...state.interfaces.map((contract) => contract.name.trim()),
  ].filter((name) => name.length > 0);
}
