import type { Relationship } from "../design/structured-design";
import type { ChangeKind } from "./change-kind";
import { relationshipKey } from "./identity";

export interface RelationshipChange {
  readonly kind: ChangeKind;
  readonly source: string;
  readonly target: string;
  readonly before?: Relationship;
  readonly after?: Relationship;
  /** Only meaningful when `kind` is `MODIFIED`; `false` otherwise. */
  readonly typeChanged: boolean;
}

/**
 * Compares two lists of relationships by their endpoints (see `relationshipKey`).
 *
 * A relationship whose target moves to a different element is a different edge,
 * not the same edge "modified" — the worked example of `ParkingLot → PaymentService`
 * becoming `ParkingLot → PaymentProcessor` is one relationship removed and one
 * added, both sharing a source, which is exactly what happened and is not the
 * same claim as "this relationship's type changed". Only a pair whose source and
 * target both stayed the same can have its type reported as `MODIFIED`.
 */
export function compareRelationships(
  before: readonly Relationship[],
  after: readonly Relationship[],
): readonly RelationshipChange[] {
  const beforeByKey = new Map(
    before.map((relationship) => [
      relationshipKey(relationship.source, relationship.target),
      relationship,
    ]),
  );
  const afterByKey = new Map(
    after.map((relationship) => [
      relationshipKey(relationship.source, relationship.target),
      relationship,
    ]),
  );

  const seen = new Set<string>();
  const keys: string[] = [];
  for (const relationship of [...before, ...after]) {
    const key = relationshipKey(relationship.source, relationship.target);
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }

  return keys.map((key) => {
    const previous = beforeByKey.get(key);
    const current = afterByKey.get(key);

    if (previous === undefined && current !== undefined) {
      return {
        kind: "ADDED",
        source: current.source,
        target: current.target,
        after: current,
        typeChanged: false,
      };
    }
    if (previous !== undefined && current === undefined) {
      return {
        kind: "REMOVED",
        source: previous.source,
        target: previous.target,
        before: previous,
        typeChanged: false,
      };
    }
    const relationshipBefore = previous as Relationship;
    const relationshipAfter = current as Relationship;
    const typeChanged = relationshipBefore.type !== relationshipAfter.type;

    return {
      kind: typeChanged ? "MODIFIED" : "UNCHANGED",
      source: relationshipAfter.source,
      target: relationshipAfter.target,
      before: relationshipBefore,
      after: relationshipAfter,
      typeChanged,
    };
  });
}
