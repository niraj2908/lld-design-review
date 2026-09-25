import { describe, expect, it } from "vitest";
import type { InterfaceDefinition } from "../design/structured-design";
import { compareInterfaces } from "./interface-comparison";

function itf(overrides: Partial<InterfaceDefinition> = {}): InterfaceDefinition {
  return {
    id: "itf_1",
    name: "PaymentProcessor",
    responsibility: "Turns a stay into a charge.",
    methods: [{ name: "charge" }],
    ...overrides,
  };
}

describe("compareInterfaces", () => {
  it("reports an added interface", () => {
    const [change] = compareInterfaces([], [itf()]);

    expect(change).toMatchObject({ kind: "ADDED", name: "PaymentProcessor" });
  });

  it("reports a removed interface", () => {
    const [change] = compareInterfaces(
      [itf({ name: "PaymentManager" })],
      [],
    );

    expect(change).toMatchObject({ kind: "REMOVED", name: "PaymentManager" });
  });

  it("treats a renamed interface as removed-and-added, not modified", () => {
    const changes = compareInterfaces(
      [itf({ name: "PaymentManager" })],
      [itf({ name: "PaymentProcessor" })],
    );

    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "REMOVED", name: "PaymentManager" }),
        expect.objectContaining({ kind: "ADDED", name: "PaymentProcessor" }),
      ]),
    );
  });

  it("detects a responsibility change on a matched interface", () => {
    const [change] = compareInterfaces(
      [itf({ responsibility: "Charges a stay." })],
      [itf({ responsibility: "Turns a finished stay into an amount owed." })],
    );

    expect(change).toMatchObject({ kind: "MODIFIED", responsibilityChanged: true });
  });

  it("detects a method added to an interface", () => {
    const [change] = compareInterfaces(
      [itf({ methods: [{ name: "charge" }] })],
      [itf({ methods: [{ name: "charge" }, { name: "refund" }] })],
    );

    expect(change?.kind).toBe("MODIFIED");
    expect(change?.methodChanges).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "ADDED", name: "refund" })]),
    );
  });

  it("reports an untouched interface as unchanged", () => {
    const [change] = compareInterfaces([itf()], [itf()]);

    expect(change?.kind).toBe("UNCHANGED");
  });

  it("is not fooled into reporting a change purely by the two lists being in a different order", () => {
    const a = itf({ name: "A" });
    const b = itf({ name: "B" });

    const changes = compareInterfaces([a, b], [b, a]);

    expect(changes.every((change) => change.kind === "UNCHANGED")).toBe(true);
  });
});
