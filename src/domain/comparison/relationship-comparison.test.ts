import { describe, expect, it } from "vitest";
import type { Relationship } from "../design/structured-design";
import { compareRelationships } from "./relationship-comparison";

function rel(overrides: Partial<Relationship> = {}): Relationship {
  return {
    source: "ParkingLot",
    target: "Ticket",
    type: "COMPOSITION",
    ...overrides,
  };
}

describe("compareRelationships", () => {
  it("reports a new relationship as added", () => {
    const [change] = compareRelationships([], [rel()]);

    expect(change).toMatchObject({ kind: "ADDED", source: "ParkingLot", target: "Ticket" });
  });

  it("reports a dropped relationship as removed", () => {
    const [change] = compareRelationships([rel()], []);

    expect(change).toMatchObject({ kind: "REMOVED", source: "ParkingLot", target: "Ticket" });
  });

  it("detects a relationship type change between the same two endpoints", () => {
    const [change] = compareRelationships(
      [rel({ source: "ParkingLot", target: "PricingStrategy", type: "DEPENDENCY" })],
      [rel({ source: "ParkingLot", target: "PricingStrategy", type: "IMPLEMENTATION" })],
    );

    expect(change).toMatchObject({ kind: "MODIFIED", typeChanged: true });
  });

  it("reports an identical relationship as unchanged", () => {
    const [change] = compareRelationships([rel()], [rel()]);

    expect(change?.kind).toBe("UNCHANGED");
  });

  it("treats a relationship whose target moved as removed-and-added, not modified", () => {
    // The worked case: ParkingLot -> PaymentService (dependency) becomes
    // ParkingLot -> PaymentProcessor (implementation). Different target, so it is
    // a different edge, never a false "type changed" claim across two elements
    // that merely happen to share a source.
    const changes = compareRelationships(
      [rel({ source: "ParkingLot", target: "PaymentService", type: "DEPENDENCY" })],
      [rel({ source: "ParkingLot", target: "PaymentProcessor", type: "IMPLEMENTATION" })],
    );

    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "REMOVED",
          source: "ParkingLot",
          target: "PaymentService",
        }),
        expect.objectContaining({
          kind: "ADDED",
          source: "ParkingLot",
          target: "PaymentProcessor",
        }),
      ]),
    );
    expect(changes.some((change) => change.kind === "MODIFIED")).toBe(false);
  });

  it("never confuses two different endpoint pairs whose names would collide if joined by a plain separator", () => {
    // ("A", "B C") and ("A B", "C") must never be treated as the same relationship
    // just because a naive `${source} ${target}` join would produce "A B C" for
    // both — a name is free text, so this has to hold for real, not just usually.
    const before = [
      { source: "A", target: "B C", type: "DEPENDENCY" as const },
    ];
    const after = [
      { source: "A B", target: "C", type: "DEPENDENCY" as const },
    ];

    const changes = compareRelationships(before, after);

    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "REMOVED", source: "A", target: "B C" }),
        expect.objectContaining({ kind: "ADDED", source: "A B", target: "C" }),
      ]),
    );
    expect(changes).toHaveLength(2);
  });

  it("is not fooled into reporting a change purely by the two lists being in a different order", () => {
    const a = rel({ source: "A", target: "B" });
    const b = rel({ source: "C", target: "D" });

    const changes = compareRelationships([a, b], [b, a]);

    expect(changes.every((change) => change.kind === "UNCHANGED")).toBe(true);
  });
});
