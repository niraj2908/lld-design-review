import type { DesignDecision } from "../design/structured-design";
import type { ChangeKind } from "./change-kind";
import { identityKey } from "./identity";
import { orderedUnion } from "./list-diff";

export interface DecisionChange {
  readonly kind: ChangeKind;
  /** The decision statement itself, which is this element's only identity. */
  readonly decision: string;
  readonly before?: DesignDecision;
  readonly after?: DesignDecision;
  /** Only meaningful when `kind` is `MODIFIED`; `false` otherwise. */
  readonly rationaleChanged: boolean;
  readonly tradeoffChanged: boolean;
}

/**
 * Compares two lists of design decisions.
 *
 * A decision has no name and no id — only a `decision` statement, a `rationale`
 * and a `tradeoff`, all free text. The statement is the closest thing to an
 * identity a decision has, so two decisions are "the same decision" only when
 * their statement matches exactly; a decision restated in different words is
 * reported as one removed and one added, never guessed at as the same decision
 * reworded, because nothing in the stored data can tell the two apart from a
 * genuine change of mind. When the statement does match, a difference in its
 * rationale or trade-off is real design evolution worth surfacing on its own —
 * "design improvement is not only structural."
 */
export function compareDecisions(
  before: readonly DesignDecision[],
  after: readonly DesignDecision[],
): readonly DecisionChange[] {
  const beforeByStatement = new Map(
    before.map((decision) => [identityKey(decision.decision), decision]),
  );
  const afterByStatement = new Map(
    after.map((decision) => [identityKey(decision.decision), decision]),
  );
  const statements = orderedUnion(
    before.map((decision) => identityKey(decision.decision)),
    after.map((decision) => identityKey(decision.decision)),
  );

  return statements.map((statement) => {
    const previous = beforeByStatement.get(statement);
    const current = afterByStatement.get(statement);

    if (previous === undefined && current !== undefined) {
      return {
        kind: "ADDED",
        decision: statement,
        after: current,
        rationaleChanged: false,
        tradeoffChanged: false,
      };
    }
    if (previous !== undefined && current === undefined) {
      return {
        kind: "REMOVED",
        decision: statement,
        before: previous,
        rationaleChanged: false,
        tradeoffChanged: false,
      };
    }
    const decisionBefore = previous as DesignDecision;
    const decisionAfter = current as DesignDecision;
    const rationaleChanged =
      decisionBefore.rationale.trim() !== decisionAfter.rationale.trim();
    const tradeoffChanged =
      decisionBefore.tradeoff.trim() !== decisionAfter.tradeoff.trim();

    return {
      kind: rationaleChanged || tradeoffChanged ? "MODIFIED" : "UNCHANGED",
      decision: statement,
      before: decisionBefore,
      after: decisionAfter,
      rationaleChanged,
      tradeoffChanged,
    };
  });
}
