import type { StructuredDesign } from "./structured-design";

export type DesignElementKind = "CLASS" | "INTERFACE";

export interface DesignElementIndex {
  kindOf(name: string): DesignElementKind | undefined;
  has(name: string): boolean;
  readonly names: readonly string[];
}

/**
 * Names are indexed case-sensitively and trimmed. Two elements whose names
 * differ only by surrounding whitespace are the same element to a reader, so
 * they must not both be addressable.
 */
export function buildDesignElementIndex(
  design: StructuredDesign,
): DesignElementIndex {
  const kinds = new Map<string, DesignElementKind>();

  for (const definition of design.classes) {
    const name = definition.name.trim();
    if (name.length > 0 && !kinds.has(name)) {
      kinds.set(name, "CLASS");
    }
  }
  for (const definition of design.interfaces) {
    const name = definition.name.trim();
    if (name.length > 0 && !kinds.has(name)) {
      kinds.set(name, "INTERFACE");
    }
  }

  return {
    kindOf: (name) => kinds.get(name.trim()),
    has: (name) => kinds.has(name.trim()),
    names: [...kinds.keys()],
  };
}
