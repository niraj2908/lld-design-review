import { describe, expect, it } from "vitest";
import {
  PARKING_LOT_REQUIREMENTS,
  validParkingLotDesign,
} from "@/testing/fixtures";
import { isValid } from "../shared/validation";
import { structuredDesignFormat } from "./structured-design-format";
import { STRUCTURED_DESIGN } from "./submission-format-type";

const CONTEXT = {
  requirementIds: PARKING_LOT_REQUIREMENTS.map((requirement) => requirement.id),
};

describe("structuredDesignFormat", () => {
  it("declares the MVP format type", () => {
    expect(structuredDesignFormat.type).toBe(STRUCTURED_DESIGN);
  });

  it("normalizes a valid design without changing its meaning", () => {
    const design = validParkingLotDesign();

    const normalized = structuredDesignFormat.normalize(design);

    expect(normalized).toEqual(design);
    expect(isValid(structuredDesignFormat.validate(normalized, CONTEXT))).toBe(
      true,
    );
  });

  it.each([null, undefined, 42, "a design", []])(
    "turns unusable input (%s) into an empty design rather than throwing",
    (input) => {
      const normalized = structuredDesignFormat.normalize(input);

      expect(normalized.classes).toEqual([]);
      expect(normalized.interfaces).toEqual([]);
      expect(normalized.requirementMappings).toEqual([]);
    },
  );

  it("trims text and drops unknown keys", () => {
    const normalized = structuredDesignFormat.normalize({
      classes: [
        {
          name: "  ParkingLot  ",
          responsibility: " Owns levels. ",
          colour: "red",
        },
      ],
      unexpected: true,
    });

    expect(normalized.classes[0]).toEqual({
      id: "class-1",
      name: "ParkingLot",
      responsibility: "Owns levels.",
      attributes: [],
      methods: [],
    });
  });

  it("keeps an unsupported relationship type so validation can report it", () => {
    const normalized = structuredDesignFormat.normalize({
      classes: [{ name: "A", responsibility: "Something." }],
      relationships: [{ source: "A", target: "A", type: "TELEPATHY" }],
    });

    expect(normalized.relationships[0]?.type).toBe("TELEPATHY");
    expect(isValid(structuredDesignFormat.validate(normalized, CONTEXT))).toBe(
      false,
    );
  });

  it("assigns stable fallback ids when the learner sends none", () => {
    const normalized = structuredDesignFormat.normalize({
      classes: [{ name: "A" }, { name: "B" }],
      interfaces: [{ name: "C" }],
    });

    expect(normalized.classes.map((entry) => entry.id)).toEqual([
      "class-1",
      "class-2",
    ]);
    expect(normalized.interfaces[0]?.id).toBe("interface-1");
  });
});
