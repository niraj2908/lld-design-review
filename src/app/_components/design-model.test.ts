import { describe, expect, it } from "vitest";
import { validParkingLotDesign } from "@/testing/fixtures";
import {
  elementNames,
  emptyDraft,
  toDraftState,
  toStructuredDesign,
} from "./design-model";

describe("the editor's draft model", () => {
  it("starts empty when there is no saved design", () => {
    const draft = emptyDraft();

    expect(toStructuredDesign(draft)).toEqual({
      classes: [],
      interfaces: [],
      relationships: [],
      decisions: [],
      edgeCases: [],
      requirementMappings: [],
    });
  });

  it("round-trips a saved design back to the same wire shape", () => {
    const design = validParkingLotDesign();

    const result = toStructuredDesign(toDraftState(design));

    expect(result.classes.map((entry) => entry.name)).toEqual(
      design.classes.map((entry) => entry.name),
    );
    expect(result.interfaces).toHaveLength(design.interfaces.length);
    expect(result.relationships).toEqual(design.relationships);
    expect(result.decisions).toEqual(design.decisions);
    expect(result.edgeCases).toEqual(design.edgeCases);
    expect(result.requirementMappings).toEqual(design.requirementMappings);
  });

  it("omits an optional field the learner left blank rather than sending an empty string", () => {
    const draft = toDraftState(validParkingLotDesign());
    draft.relationships[0]!.rationale = "   ";
    draft.classes[0]!.attributes[0]!.type = "";

    const result = toStructuredDesign(draft);

    expect("rationale" in result.relationships[0]!).toBe(false);
    expect("type" in result.classes[0]!.attributes[0]!).toBe(false);
  });

  it("trims what the learner typed", () => {
    const draft = emptyDraft();
    draft.classes.push({
      key: "k",
      name: "  ParkingLot  ",
      responsibility: "  Owns levels.  ",
      attributes: [],
      methods: [],
    });

    const result = toStructuredDesign(draft);

    expect(result.classes[0]?.name).toBe("ParkingLot");
    expect(result.classes[0]?.responsibility).toBe("Owns levels.");
  });

  it("drops attribute and method rows the learner never filled in", () => {
    const draft = emptyDraft();
    draft.classes.push({
      key: "k",
      name: "Lot",
      responsibility: "r",
      attributes: [
        { key: "a", name: "levels", type: "" },
        { key: "b", name: "  ", type: "int" },
      ],
      methods: [{ key: "c", name: "", signature: "x()" }],
    });

    const result = toStructuredDesign(draft);

    expect(result.classes[0]?.attributes).toEqual([{ name: "levels" }]);
    expect(result.classes[0]?.methods).toEqual([]);
  });

  it("keeps the stored field and value when the learner has not changed the elements", () => {
    const design = validParkingLotDesign();
    const draft = toDraftState(design);

    expect(toStructuredDesign(draft).requirementMappings[0]?.references[0]).toEqual({
      entity: "ParkingLot",
      field: "methods",
      value: "park",
    });
  });

  it("falls back to plain element references once the learner edits the list", () => {
    const draft = toDraftState(validParkingLotDesign());
    draft.mappings[0]!.entities = "ParkingLot, Ticket";

    expect(toStructuredDesign(draft).requirementMappings[0]?.references).toEqual([
      { entity: "ParkingLot" },
      { entity: "Ticket" },
    ]);
  });

  it("splits a comma-separated mapping into element references", () => {
    const draft = emptyDraft();
    draft.mappings.push({
      key: "m",
      requirementId: "req_pl_01",
      entities: "ParkingLot, Ticket ,, ",
      note: "",
      loaded: [],
    });

    expect(toStructuredDesign(draft).requirementMappings[0]).toEqual({
      requirementId: "req_pl_01",
      references: [{ entity: "ParkingLot" }, { entity: "Ticket" }],
    });
  });

  it("drops a mapping with no requirement chosen", () => {
    const draft = emptyDraft();
    draft.mappings.push({
      key: "m",
      requirementId: "  ",
      entities: "Lot",
      note: "",
      loaded: [],
    });

    expect(toStructuredDesign(draft).requirementMappings).toEqual([]);
  });

  it("offers every named element for relationship and mapping autocompletion", () => {
    const draft = toDraftState(validParkingLotDesign());

    expect(elementNames(draft)).toEqual([
      "ParkingLot",
      "Ticket",
      "SizeBasedPricing",
      "PricingStrategy",
    ]);
  });

  it("leaves an unnamed element out of the autocompletion list", () => {
    const draft = emptyDraft();
    draft.classes.push({
      key: "k",
      name: "  ",
      responsibility: "",
      attributes: [],
      methods: [],
    });

    expect(elementNames(draft)).toEqual([]);
  });

  it("derives a stable element id from the name", () => {
    const draft = emptyDraft();
    draft.classes.push({
      key: "k",
      name: "Parking Lot Service",
      responsibility: "r",
      attributes: [],
      methods: [],
    });

    expect(toStructuredDesign(draft).classes[0]?.id).toBe("parking-lot-service");
  });
});
