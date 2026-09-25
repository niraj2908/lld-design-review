import { describe, expect, it } from "vitest";
import type { ClassDefinition } from "../design/structured-design";
import { compareClasses } from "./class-comparison";

function cls(overrides: Partial<ClassDefinition> = {}): ClassDefinition {
  return {
    id: "cls_1",
    name: "ParkingLot",
    responsibility: "Coordinates parking.",
    attributes: [],
    methods: [],
    ...overrides,
  };
}

describe("compareClasses", () => {
  it("reports a class only in the later design as added", () => {
    const changes = compareClasses([], [cls()]);

    expect(changes).toEqual([
      expect.objectContaining({ kind: "ADDED", name: "ParkingLot" }),
    ]);
  });

  it("reports a class only in the earlier design as removed", () => {
    const changes = compareClasses([cls()], []);

    expect(changes).toEqual([
      expect.objectContaining({ kind: "REMOVED", name: "ParkingLot" }),
    ]);
  });

  it("reports an identical class as unchanged", () => {
    const changes = compareClasses([cls()], [cls()]);

    expect(changes).toEqual([
      expect.objectContaining({ kind: "UNCHANGED", name: "ParkingLot" }),
    ]);
  });

  it("detects a responsibility change", () => {
    const [change] = compareClasses(
      [cls({ responsibility: "Allocates spots and processes payment." })],
      [cls({ responsibility: "Coordinates parking operations." })],
    );

    expect(change).toMatchObject({ kind: "MODIFIED", responsibilityChanged: true });
  });

  it("detects an added and a removed method without flagging unrelated ones", () => {
    const [change] = compareClasses(
      [cls({ methods: [{ name: "park" }, { name: "exit" }] })],
      [cls({ methods: [{ name: "park" }, { name: "release" }] })],
    );

    expect(change?.kind).toBe("MODIFIED");
    expect(change?.methodChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "UNCHANGED", name: "park" }),
        expect.objectContaining({ kind: "REMOVED", name: "exit" }),
        expect.objectContaining({ kind: "ADDED", name: "release" }),
      ]),
    );
  });

  it("detects a method signature change on an otherwise identical method", () => {
    const [change] = compareClasses(
      [cls({ methods: [{ name: "park", signature: "park(v): Ticket" }] })],
      [cls({ methods: [{ name: "park", signature: "park(v, at): Ticket" }] })],
    );

    expect(change?.kind).toBe("MODIFIED");
    expect(change?.methodChanges).toEqual([
      expect.objectContaining({ kind: "MODIFIED", name: "park" }),
    ]);
  });

  it("detects added, removed and changed attributes", () => {
    const [change] = compareClasses(
      [
        cls({
          attributes: [
            { name: "levels", type: "Level[]" },
            { name: "capacity", type: "number" },
          ],
        }),
      ],
      [
        cls({
          attributes: [
            { name: "levels", type: "readonly Level[]" },
            { name: "operator", type: "string" },
          ],
        }),
      ],
    );

    expect(change?.attributeChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "MODIFIED", name: "levels" }),
        expect.objectContaining({ kind: "REMOVED", name: "capacity" }),
        expect.objectContaining({ kind: "ADDED", name: "operator" }),
      ]),
    );
  });

  it("does not treat two unrelated classes with different names as the same class modified", () => {
    // A valid alternative decomposition: the learner used different names, not the
    // same class edited. This must read as remove-and-add, never as one MODIFIED
    // class — collapsing the two would fabricate an identity nothing supports.
    const changes = compareClasses(
      [cls({ name: "ParkingLot" })],
      [cls({ name: "Garage" })],
    );

    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "REMOVED", name: "ParkingLot" }),
        expect.objectContaining({ kind: "ADDED", name: "Garage" }),
      ]),
    );
    expect(changes.some((change) => change.kind === "MODIFIED")).toBe(false);
  });

  it("is order-independent about which side is unchanged first", () => {
    const changes = compareClasses(
      [cls({ name: "A" }), cls({ name: "B" })],
      [cls({ name: "B" }), cls({ name: "A" })],
    );

    expect(changes.every((change) => change.kind === "UNCHANGED")).toBe(true);
  });
});
