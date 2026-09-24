import { describe, expect, it } from "vitest";
import { InvalidRelationshipError } from "../shared/errors";
import {
  RELATIONSHIP_TYPES,
  assertRelationshipType,
  isRelationshipType,
} from "./relationship-type";

describe("relationship types", () => {
  it("supports exactly the six UML relationships the submission format allows", () => {
    expect([...RELATIONSHIP_TYPES]).toEqual([
      "ASSOCIATION",
      "AGGREGATION",
      "COMPOSITION",
      "INHERITANCE",
      "IMPLEMENTATION",
      "DEPENDENCY",
    ]);
  });

  it.each(RELATIONSHIP_TYPES)("recognises %s", (type) => {
    expect(isRelationshipType(type)).toBe(true);
    expect(assertRelationshipType(type, "relationships[0].type")).toBe(type);
  });

  it.each(["association", "USES", "", null, undefined, 7])(
    "rejects %s",
    (value) => {
      expect(isRelationshipType(value)).toBe(false);
    },
  );

  it("names the offending path when asserting", () => {
    expect(() => assertRelationshipType("USES", "relationships[2].type")).toThrow(
      InvalidRelationshipError,
    );
    expect(() =>
      assertRelationshipType("USES", "relationships[2].type"),
    ).toThrow(/relationships\[2\]\.type/);
  });
});
