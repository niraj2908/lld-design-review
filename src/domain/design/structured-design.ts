import type { RelationshipType } from "./relationship-type";

export interface AttributeDefinition {
  readonly name: string;
  readonly type?: string;
}

export interface MethodDefinition {
  readonly name: string;
  readonly signature?: string;
  readonly description?: string;
}

export interface ClassDefinition {
  readonly id: string;
  readonly name: string;
  readonly responsibility: string;
  readonly attributes: readonly AttributeDefinition[];
  readonly methods: readonly MethodDefinition[];
}

export interface InterfaceDefinition {
  readonly id: string;
  readonly name: string;
  readonly responsibility: string;
  readonly methods: readonly MethodDefinition[];
}

/**
 * `source` and `target` reference design elements by name, because that is also
 * how AI feedback evidence addresses them (`{ entity: "ParkingLot" }`). Element
 * names therefore share a single namespace across classes and interfaces.
 */
export interface Relationship {
  readonly source: string;
  readonly target: string;
  readonly type: RelationshipType;
  readonly cardinality?: string;
  readonly rationale?: string;
}

export interface DesignDecision {
  readonly decision: string;
  readonly rationale: string;
  readonly tradeoff: string;
}

export interface EdgeCase {
  readonly description: string;
  readonly expectedBehavior: string;
}

export interface DesignElementReference {
  readonly entity: string;
  readonly field?: string;
  readonly value?: string;
}

export interface RequirementMapping {
  readonly requirementId: string;
  readonly references: readonly DesignElementReference[];
  readonly note?: string;
}

export interface StructuredDesign {
  readonly classes: readonly ClassDefinition[];
  readonly interfaces: readonly InterfaceDefinition[];
  readonly relationships: readonly Relationship[];
  readonly decisions: readonly DesignDecision[];
  readonly edgeCases: readonly EdgeCase[];
  readonly requirementMappings: readonly RequirementMapping[];
}

export function emptyStructuredDesign(): StructuredDesign {
  return {
    classes: [],
    interfaces: [],
    relationships: [],
    decisions: [],
    edgeCases: [],
    requirementMappings: [],
  };
}

export function isDesignEmpty(design: StructuredDesign): boolean {
  return design.classes.length === 0 && design.interfaces.length === 0;
}
