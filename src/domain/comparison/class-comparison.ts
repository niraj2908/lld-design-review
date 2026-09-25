import type { AttributeDefinition, ClassDefinition } from "../design/structured-design";
import type { ChangeKind } from "./change-kind";
import { identityKey } from "./identity";
import { compareMethods, orderedUnion } from "./list-diff";
import type { MethodChange } from "./list-diff";

export type { MethodChange } from "./list-diff";

export interface AttributeChange {
  readonly kind: ChangeKind;
  readonly name: string;
  readonly before?: AttributeDefinition;
  readonly after?: AttributeDefinition;
}

export interface ClassChange {
  readonly kind: ChangeKind;
  readonly name: string;
  readonly before?: ClassDefinition;
  readonly after?: ClassDefinition;
  /** Only meaningful when `kind` is `MODIFIED`; `false` otherwise. */
  readonly responsibilityChanged: boolean;
  readonly attributeChanges: readonly AttributeChange[];
  readonly methodChanges: readonly MethodChange[];
}

/**
 * Compares two lists of classes by name (see `identity.ts`), reporting one entry
 * per class that appears in either list.
 *
 * A class present in both is `MODIFIED` when its responsibility text differs, or
 * an attribute or method was added, removed or changed — never inferred from
 * anything the stored data cannot support, such as a similarity score over free
 * text. It is `UNCHANGED` otherwise, still reported so a caller can count or test
 * against the full picture; hiding unchanged elements from a primary view is a
 * presentation decision, not something this function decides.
 */
export function compareClasses(
  before: readonly ClassDefinition[],
  after: readonly ClassDefinition[],
): readonly ClassChange[] {
  const beforeByName = new Map(
    before.map((definition) => [identityKey(definition.name), definition]),
  );
  const afterByName = new Map(
    after.map((definition) => [identityKey(definition.name), definition]),
  );
  const names = orderedUnion(
    before.map((definition) => identityKey(definition.name)),
    after.map((definition) => identityKey(definition.name)),
  );

  return names.map((name) => {
    const previous = beforeByName.get(name);
    const current = afterByName.get(name);

    if (previous === undefined && current !== undefined) {
      return {
        kind: "ADDED",
        name,
        after: current,
        responsibilityChanged: false,
        attributeChanges: [],
        methodChanges: [],
      };
    }
    if (previous !== undefined && current === undefined) {
      return {
        kind: "REMOVED",
        name,
        before: previous,
        responsibilityChanged: false,
        attributeChanges: [],
        methodChanges: [],
      };
    }
    // Both defined: the union guarantees at least one side, and the two branches
    // above cover "only one side", so this is the remaining case.
    const definitionBefore = previous as ClassDefinition;
    const definitionAfter = current as ClassDefinition;

    const responsibilityChanged =
      definitionBefore.responsibility.trim() !==
      definitionAfter.responsibility.trim();
    const attributeChanges = compareAttributes(
      definitionBefore.attributes,
      definitionAfter.attributes,
    );
    const methodChanges = compareMethods(
      definitionBefore.methods,
      definitionAfter.methods,
    );
    const modified =
      responsibilityChanged ||
      attributeChanges.some((change) => change.kind !== "UNCHANGED") ||
      methodChanges.some((change) => change.kind !== "UNCHANGED");

    return {
      kind: modified ? "MODIFIED" : "UNCHANGED",
      name,
      before: definitionBefore,
      after: definitionAfter,
      responsibilityChanged,
      attributeChanges,
      methodChanges,
    };
  });
}

function compareAttributes(
  before: readonly AttributeDefinition[],
  after: readonly AttributeDefinition[],
): readonly AttributeChange[] {
  const beforeByName = new Map(
    before.map((attribute) => [identityKey(attribute.name), attribute]),
  );
  const afterByName = new Map(
    after.map((attribute) => [identityKey(attribute.name), attribute]),
  );
  const names = orderedUnion(
    before.map((attribute) => identityKey(attribute.name)),
    after.map((attribute) => identityKey(attribute.name)),
  );

  return names.map((name) => {
    const previous = beforeByName.get(name);
    const current = afterByName.get(name);

    if (previous === undefined) {
      // The union guarantees at least one side is defined for this name.
      return { kind: "ADDED", name, after: current as AttributeDefinition };
    }
    if (current === undefined) {
      return { kind: "REMOVED", name, before: previous };
    }
    const changed = (previous.type ?? "").trim() !== (current.type ?? "").trim();
    return {
      kind: changed ? "MODIFIED" : "UNCHANGED",
      name,
      before: previous,
      after: current,
    };
  });
}
