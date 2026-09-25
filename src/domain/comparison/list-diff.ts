import type { MethodDefinition } from "../design/structured-design";
import type { ChangeKind } from "./change-kind";
import { identityKey } from "./identity";

/** Shared by the class and interface comparators: a class and an interface both hold methods, compared the same way. */
export interface MethodChange {
  readonly kind: ChangeKind;
  readonly name: string;
  readonly before?: MethodDefinition;
  readonly after?: MethodDefinition;
}

export function compareMethods(
  before: readonly MethodDefinition[],
  after: readonly MethodDefinition[],
): readonly MethodChange[] {
  const beforeByName = new Map(
    before.map((method) => [identityKey(method.name), method]),
  );
  const afterByName = new Map(
    after.map((method) => [identityKey(method.name), method]),
  );

  return orderedUnion(
    before.map((method) => identityKey(method.name)),
    after.map((method) => identityKey(method.name)),
  ).map((name) => {
    const previous = beforeByName.get(name);
    const current = afterByName.get(name);

    if (previous === undefined) {
      // The union guarantees at least one side is defined for this name.
      return { kind: "ADDED", name, after: current as MethodDefinition };
    }
    if (current === undefined) {
      return { kind: "REMOVED", name, before: previous };
    }
    // Method identity is the name; the signature and description are the part of
    // the method that can change without it becoming a different method.
    const changed =
      (previous.signature ?? "").trim() !== (current.signature ?? "").trim() ||
      (previous.description ?? "").trim() !== (current.description ?? "").trim();
    return {
      kind: changed ? "MODIFIED" : "UNCHANGED",
      name,
      before: previous,
      after: current,
    };
  });
}

/** Preserves first-seen order across both lists, without duplicates. */
export function orderedUnion(
  before: readonly string[],
  after: readonly string[],
): readonly string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const name of [...before, ...after]) {
    if (!seen.has(name)) {
      seen.add(name);
      ordered.push(name);
    }
  }
  return ordered;
}
