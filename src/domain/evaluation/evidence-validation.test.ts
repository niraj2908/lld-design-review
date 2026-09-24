import { describe, expect, it } from "vitest";
import { validParkingLotDesign } from "@/testing/fixtures";
import type { Evidence } from "../feedback/evidence";
import { EVIDENCE_FIELDS, isEvidenceField, validateEvidence } from "./evidence-validation";

const design = validParkingLotDesign();

function check(...evidence: Evidence[]) {
  return validateEvidence(evidence, design);
}

describe("validateEvidence", () => {
  it("accepts an entity that exists with a field the format has", () => {
    const result = check({ entity: "ParkingLot", field: "responsibility" });

    expect(result.verified).toHaveLength(1);
    expect(result.rejected).toEqual([]);
  });

  it("accepts an interface as an entity", () => {
    expect(check({ entity: "PricingStrategy", field: "methods" }).verified).toHaveLength(1);
  });

  it("accepts a value that really appears in the named element", () => {
    const result = check({
      entity: "ParkingLot",
      field: "responsibility",
      value: "coordinates parking and exit flows",
    });

    expect(result.verified).toHaveLength(1);
  });

  it("matches a value case-insensitively and across reflowed whitespace", () => {
    const result = check({
      entity: "ParkingLot",
      field: "responsibility",
      value: "  OWNS   levels ",
    });

    expect(result.verified).toHaveLength(1);
  });

  it("rejects an entity the design does not contain", () => {
    const result = check({ entity: "PaymentService", field: "responsibility" });

    expect(result.verified).toEqual([]);
    expect(result.rejected[0]?.reason).toBe("UNKNOWN_ENTITY");
  });

  it("rejects a field the submission format does not have", () => {
    const result = check({ entity: "ParkingLot", field: "privateState" as never });

    expect(result.rejected[0]?.reason).toBe("UNKNOWN_FIELD");
  });

  it("rejects a value that is not in the element it is attributed to", () => {
    const result = check({
      entity: "Ticket",
      field: "responsibility",
      value: "calculates the parking fee",
    });

    expect(result.rejected[0]?.reason).toBe("VALUE_NOT_FOUND");
  });

  it("rejects a value quoted against the wrong element even when it exists elsewhere", () => {
    // "calculateFee" is real, but it belongs to SizeBasedPricing, not Ticket.
    const result = check({
      entity: "Ticket",
      field: "methods",
      value: "calculateFee",
    });

    expect(result.rejected[0]?.reason).toBe("VALUE_NOT_FOUND");
  });

  it("accepts a relationship the design declares", () => {
    const result = check({
      entity: "ParkingLot",
      field: "relationships",
      value: "ParkingLot -> Ticket",
    });

    expect(result.verified).toHaveLength(1);
  });

  it("accepts a relationship quoted by its type and target", () => {
    expect(
      check({
        entity: "SizeBasedPricing",
        field: "relationships",
        value: "IMPLEMENTATION -> PricingStrategy",
      }).verified,
    ).toHaveLength(1);
  });

  it("rejects a fabricated relationship", () => {
    const result = check({
      entity: "Ticket",
      field: "relationships",
      value: "Ticket -> PaymentService",
    });

    expect(result.rejected[0]?.reason).toBe("VALUE_NOT_FOUND");
  });

  it("accepts a requirement mapping the design declares", () => {
    expect(
      check({
        entity: "ParkingLot",
        field: "requirementMappings",
        value: "req_pl_01",
      }).verified,
    ).toHaveLength(1);
  });

  it("rejects a requirement the design never mapped", () => {
    expect(
      check({
        entity: "ParkingLot",
        field: "requirementMappings",
        value: "req_pl_99",
      }).rejected[0]?.reason,
    ).toBe("VALUE_NOT_FOUND");
  });

  it("rejects an empty value rather than treating it as a match", () => {
    expect(
      check({ entity: "ParkingLot", field: "responsibility", value: "   " })
        .rejected[0]?.reason,
    ).toBe("VALUE_NOT_FOUND");
  });

  it("searches everything belonging to the entity when no field is named", () => {
    expect(
      check({ entity: "ParkingLot", value: "park(vehicle: Vehicle): Ticket" })
        .verified,
    ).toHaveLength(1);
  });

  it("partitions a mixed batch without dropping either side", () => {
    const result = check(
      { entity: "ParkingLot", field: "methods", value: "park" },
      { entity: "Nowhere" },
      { entity: "Ticket", field: "attributes", value: "issuedAt" },
    );

    expect(result.verified).toHaveLength(2);
    expect(result.rejected).toHaveLength(1);
  });

  it("returns nothing for an empty batch", () => {
    expect(validateEvidence([], design)).toEqual({ verified: [], rejected: [] });
  });

  it.each(EVIDENCE_FIELDS)("recognises %s as a field", (field) => {
    expect(isEvidenceField(field)).toBe(true);
  });

  it.each(["", "Responsibility", "name", "id"])("does not recognise %s", (field) => {
    expect(isEvidenceField(field)).toBe(false);
  });
});
