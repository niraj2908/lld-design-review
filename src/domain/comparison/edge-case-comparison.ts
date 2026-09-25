import type { EdgeCase } from "../design/structured-design";
import type { ChangeKind } from "./change-kind";
import { identityKey } from "./identity";
import { orderedUnion } from "./list-diff";

export interface EdgeCaseChange {
  readonly kind: ChangeKind;
  /** The situation described, which is this element's only identity. */
  readonly description: string;
  readonly before?: EdgeCase;
  readonly after?: EdgeCase;
  /** Only meaningful when `kind` is `MODIFIED`; `false` otherwise. */
  readonly expectedBehaviorChanged: boolean;
}

/**
 * Compares two lists of edge cases by the situation described, the same
 * identity rule `compareDecisions` uses and for the same reason: an edge case is
 * free text with no other handle, so identity is the described situation, exactly
 * matched. A newly identified edge case is `ADDED`; the same situation with
 * different expected handling is `MODIFIED` — which is exactly the "newly
 * addressed edge case" signal design evolution is meant to surface.
 */
export function compareEdgeCases(
  before: readonly EdgeCase[],
  after: readonly EdgeCase[],
): readonly EdgeCaseChange[] {
  const beforeByDescription = new Map(
    before.map((edgeCase) => [identityKey(edgeCase.description), edgeCase]),
  );
  const afterByDescription = new Map(
    after.map((edgeCase) => [identityKey(edgeCase.description), edgeCase]),
  );
  const descriptions = orderedUnion(
    before.map((edgeCase) => identityKey(edgeCase.description)),
    after.map((edgeCase) => identityKey(edgeCase.description)),
  );

  return descriptions.map((description) => {
    const previous = beforeByDescription.get(description);
    const current = afterByDescription.get(description);

    if (previous === undefined && current !== undefined) {
      return {
        kind: "ADDED",
        description,
        after: current,
        expectedBehaviorChanged: false,
      };
    }
    if (previous !== undefined && current === undefined) {
      return {
        kind: "REMOVED",
        description,
        before: previous,
        expectedBehaviorChanged: false,
      };
    }
    const edgeCaseBefore = previous as EdgeCase;
    const edgeCaseAfter = current as EdgeCase;
    const expectedBehaviorChanged =
      edgeCaseBefore.expectedBehavior.trim() !==
      edgeCaseAfter.expectedBehavior.trim();

    return {
      kind: expectedBehaviorChanged ? "MODIFIED" : "UNCHANGED",
      description,
      before: edgeCaseBefore,
      after: edgeCaseAfter,
      expectedBehaviorChanged,
    };
  });
}
