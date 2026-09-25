import type { InterfaceDefinition } from "../design/structured-design";
import type { ChangeKind } from "./change-kind";
import { identityKey } from "./identity";
import { compareMethods, orderedUnion } from "./list-diff";
import type { MethodChange } from "./list-diff";

export interface InterfaceChange {
  readonly kind: ChangeKind;
  readonly name: string;
  readonly before?: InterfaceDefinition;
  readonly after?: InterfaceDefinition;
  readonly responsibilityChanged: boolean;
  readonly methodChanges: readonly MethodChange[];
}

/**
 * Compares two lists of interfaces by name, the same way `compareClasses` does —
 * interfaces have no attributes, so this is that comparison minus one dimension
 * rather than a different rule.
 */
export function compareInterfaces(
  before: readonly InterfaceDefinition[],
  after: readonly InterfaceDefinition[],
): readonly InterfaceChange[] {
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
        methodChanges: [],
      };
    }
    if (previous !== undefined && current === undefined) {
      return {
        kind: "REMOVED",
        name,
        before: previous,
        responsibilityChanged: false,
        methodChanges: [],
      };
    }
    const definitionBefore = previous as InterfaceDefinition;
    const definitionAfter = current as InterfaceDefinition;

    const responsibilityChanged =
      definitionBefore.responsibility.trim() !==
      definitionAfter.responsibility.trim();
    const methodChanges = compareMethods(
      definitionBefore.methods,
      definitionAfter.methods,
    );
    const modified =
      responsibilityChanged ||
      methodChanges.some((change) => change.kind !== "UNCHANGED");

    return {
      kind: modified ? "MODIFIED" : "UNCHANGED",
      name,
      before: definitionBefore,
      after: definitionAfter,
      responsibilityChanged,
      methodChanges,
    };
  });
}
