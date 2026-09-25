import { describe, expect, it } from "vitest";
import type { EdgeCase } from "../design/structured-design";
import { compareEdgeCases } from "./edge-case-comparison";

function edgeCase(overrides: Partial<EdgeCase> = {}): EdgeCase {
  return {
    description: "No parking spot is available.",
    expectedBehavior: "Entry is refused without issuing a ticket.",
    ...overrides,
  };
}

describe("compareEdgeCases", () => {
  it("reports a newly identified edge case as added", () => {
    const [change] = compareEdgeCases([], [edgeCase()]);

    expect(change).toMatchObject({ kind: "ADDED", description: edgeCase().description });
  });

  it("reports a dropped edge case as removed", () => {
    const [change] = compareEdgeCases([edgeCase()], []);

    expect(change).toMatchObject({ kind: "REMOVED" });
  });

  it("detects newly addressed handling for the same situation", () => {
    const [change] = compareEdgeCases(
      [edgeCase({ expectedBehavior: "Undefined." })],
      [edgeCase({ expectedBehavior: "Return an allocation failure without creating a ticket." })],
    );

    expect(change).toMatchObject({ kind: "MODIFIED", expectedBehaviorChanged: true });
  });

  it("reports an identical edge case as unchanged", () => {
    const [change] = compareEdgeCases([edgeCase()], [edgeCase()]);

    expect(change?.kind).toBe("UNCHANGED");
  });

  it("does not merge two differently described situations into one changed edge case", () => {
    const changes = compareEdgeCases(
      [edgeCase({ description: "No parking spot is available." })],
      [edgeCase({ description: "The lot is completely full." })],
    );

    expect(changes.some((change) => change.kind === "MODIFIED")).toBe(false);
  });

  it("is not fooled into reporting a change purely by the two lists being in a different order", () => {
    const a = edgeCase({ description: "Situation A." });
    const b = edgeCase({ description: "Situation B." });

    const changes = compareEdgeCases([a, b], [b, a]);

    expect(changes.every((change) => change.kind === "UNCHANGED")).toBe(true);
  });
});
