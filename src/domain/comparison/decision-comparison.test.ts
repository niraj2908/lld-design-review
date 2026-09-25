import { describe, expect, it } from "vitest";
import type { DesignDecision } from "../design/structured-design";
import { compareDecisions } from "./decision-comparison";

function decision(overrides: Partial<DesignDecision> = {}): DesignDecision {
  return {
    decision: "Use a strategy abstraction for payment methods.",
    rationale: "New payment methods should not require touching the core flow.",
    tradeoff: "One extra indirection to read.",
    ...overrides,
  };
}

describe("compareDecisions", () => {
  it("reports a new decision as added", () => {
    const [change] = compareDecisions([], [decision()]);

    expect(change).toMatchObject({ kind: "ADDED", decision: decision().decision });
  });

  it("reports a dropped decision as removed", () => {
    const [change] = compareDecisions([decision()], []);

    expect(change).toMatchObject({ kind: "REMOVED" });
  });

  it("detects a rationale change on the same decision statement", () => {
    const [change] = compareDecisions(
      [decision({ rationale: "Direct conditionals were simplest to start with." })],
      [decision({ rationale: "Allows new payment methods without touching the core flow." })],
    );

    expect(change).toMatchObject({ kind: "MODIFIED", rationaleChanged: true, tradeoffChanged: false });
  });

  it("detects a trade-off change independently of the rationale", () => {
    const [change] = compareDecisions(
      [decision({ tradeoff: "None noticed yet." })],
      [decision({ tradeoff: "One extra indirection to read." })],
    );

    expect(change).toMatchObject({ kind: "MODIFIED", tradeoffChanged: true, rationaleChanged: false });
  });

  it("does not claim a reworded decision is the same decision changed", () => {
    // No id, no name — only the statement itself, so a different statement is a
    // different decision: one removed, one added, never inferred as "modified".
    const changes = compareDecisions(
      [decision({ decision: "Use direct conditionals for payment methods." })],
      [decision({ decision: "Use a strategy abstraction for payment methods." })],
    );

    expect(changes.some((change) => change.kind === "MODIFIED")).toBe(false);
    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "REMOVED" }),
        expect.objectContaining({ kind: "ADDED" }),
      ]),
    );
  });

  it("reports an identical decision as unchanged", () => {
    const [change] = compareDecisions([decision()], [decision()]);

    expect(change?.kind).toBe("UNCHANGED");
  });

  it("is not fooled into reporting a change purely by the two lists being in a different order", () => {
    const a = decision({ decision: "Decision A." });
    const b = decision({ decision: "Decision B." });

    const changes = compareDecisions([a, b], [b, a]);

    expect(changes.every((change) => change.kind === "UNCHANGED")).toBe(true);
  });
});
