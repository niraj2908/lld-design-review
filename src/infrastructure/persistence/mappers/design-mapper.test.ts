import { describe, expect, it } from "vitest";
import { validParkingLotDesign } from "@/testing/fixtures";
import type { StructuredDesign } from "@/domain/design/structured-design";
import { PersistenceMappingError } from "../persistence-errors";
import { toDesignCreateData, toStructuredDesign } from "./design-mapper";
import type { DesignRow } from "./rows";

/**
 * Turns the write payload the repository sends to Prisma back into the row shape
 * a read returns, so a round trip can be asserted without a database.
 */
function asRow(design: StructuredDesign): DesignRow {
  const data = toDesignCreateData(design);
  return {
    id: "dsn_1",
    classes: data.classes.create.map((entry) => ({ ...entry })),
    interfaces: data.interfaces.create.map((entry) => ({ ...entry })),
    relationships: data.relationships.create.map((entry) => ({ ...entry })),
    decisions: data.decisions.create.map((entry) => ({ ...entry })),
    edgeCases: data.edgeCases.create.map((entry) => ({ ...entry })),
    requirementMappings: data.requirementMappings.create.map((entry) => ({
      requirementId: entry.requirement.connect.id,
      note: entry.note,
      position: entry.position,
      references: entry.references.create.map((reference) => ({ ...reference })),
    })),
  };
}

describe("design mapper", () => {
  it("round-trips a full design unchanged", () => {
    const design = validParkingLotDesign();

    expect(toStructuredDesign(asRow(design))).toEqual(design);
  });

  it("assigns a position to every ordered child", () => {
    const data = toDesignCreateData(validParkingLotDesign());

    expect(data.classes.create.map((entry) => entry.position)).toEqual([0, 1, 2]);
    expect(data.relationships.create.map((entry) => entry.position)).toEqual([
      0, 1, 2,
    ]);
    expect(
      data.requirementMappings.create[0]?.references.create[0]?.position,
    ).toBe(0);
  });

  it("rebuilds children in stored position order, not row order", () => {
    const design = validParkingLotDesign();
    const row = asRow(design);
    const shuffled: DesignRow = {
      ...row,
      classes: row.classes.toReversed(),
      relationships: row.relationships.toReversed(),
    };

    expect(toStructuredDesign(shuffled)).toEqual(design);
  });

  it("stores optional fields as null and restores them as absent properties", () => {
    const design: StructuredDesign = {
      ...validParkingLotDesign(),
      relationships: [
        { source: "ParkingLot", target: "Ticket", type: "COMPOSITION" },
      ],
    };
    const data = toDesignCreateData(design);

    expect(data.relationships.create[0]?.cardinality).toBeNull();
    expect(data.relationships.create[0]?.rationale).toBeNull();

    const restored = toStructuredDesign(asRow(design));
    expect("cardinality" in restored.relationships[0]!).toBe(false);
    expect(restored.relationships[0]).toEqual({
      source: "ParkingLot",
      target: "Ticket",
      type: "COMPOSITION",
    });
  });

  it("keeps a relationship's cardinality and rationale when present", () => {
    const design: StructuredDesign = {
      ...validParkingLotDesign(),
      relationships: [
        {
          source: "ParkingLot",
          target: "Ticket",
          type: "COMPOSITION",
          cardinality: "1..*",
          rationale: "A lot issues many tickets over its life.",
        },
      ],
    };

    expect(toStructuredDesign(asRow(design)).relationships[0]).toEqual(
      design.relationships[0],
    );
  });

  it("connects a requirement mapping rather than writing a raw key", () => {
    const data = toDesignCreateData(validParkingLotDesign());

    expect(data.requirementMappings.create[0]?.requirement).toEqual({
      connect: { id: "req_pl_01" },
    });
  });

  it("flattens attributes and methods into JSON records with no undefined values", () => {
    const data = toDesignCreateData(validParkingLotDesign());
    const parkingLot = data.classes.create[0]!;

    expect(parkingLot.attributes).toEqual([{ name: "levels", type: "Level[]" }]);
    expect(parkingLot.methods[0]).toEqual({
      name: "park",
      signature: "park(vehicle: Vehicle): Ticket",
    });
    for (const method of parkingLot.methods) {
      expect(Object.values(method)).not.toContain(undefined);
    }
  });

  it("rejects a stored JSON column that is not an array of objects", () => {
    const row = asRow(validParkingLotDesign());
    const corrupt: DesignRow = {
      ...row,
      classes: [{ ...row.classes[0]!, methods: "not-json" }],
    };

    expect(() => toStructuredDesign(corrupt)).toThrow(PersistenceMappingError);
  });

  it("rejects a stored method with no name", () => {
    const row = asRow(validParkingLotDesign());
    const corrupt: DesignRow = {
      ...row,
      classes: [{ ...row.classes[0]!, methods: [{ signature: "x()" }] }],
    };

    expect(() => toStructuredDesign(corrupt)).toThrow(/missing its name/);
  });

  it("maps an empty design without inventing rows", () => {
    const data = toDesignCreateData({
      classes: [],
      interfaces: [],
      relationships: [],
      decisions: [],
      edgeCases: [],
      requirementMappings: [],
    });

    expect(data.classes.create).toEqual([]);
    expect(data.requirementMappings.create).toEqual([]);
  });
});
