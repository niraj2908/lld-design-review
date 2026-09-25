import { describe, expect, it } from "vitest";
import type { FeedbackItem } from "../feedback/feedback-item";
import { emptyStructuredDesign } from "../design/structured-design";
import type { StructuredDesign } from "../design/structured-design";
import { resolveFeedback } from "./feedback-resolution";

function feedback(overrides: Partial<FeedbackItem> = {}): FeedbackItem {
  return {
    id: "fdb_1",
    priority: "P0",
    criterion: "RESPONSIBILITY",
    what: "ParkingLot has too many responsibilities.",
    where: [
      {
        entity: "ParkingLot",
        field: "methods",
        value: "allocateSpot()\nprocessPayment()\nissueTicket()",
      },
    ],
    why: "One class owning allocation, payment and ticketing has three reasons to change.",
    ...overrides,
  };
}

function designWithClass(
  name: string,
  methods: readonly { readonly name: string }[] = [],
): StructuredDesign {
  return {
    ...emptyStructuredDesign(),
    classes: [
      {
        id: "cls_1",
        name,
        responsibility: "Something.",
        attributes: [],
        methods,
      },
    ],
  };
}

describe("resolveFeedback", () => {
  it("marks a finding with no evidence as not comparable", () => {
    const [resolution] = resolveFeedback([feedback({ where: [] })], emptyStructuredDesign());

    expect(resolution?.status).toBe("NOT_COMPARABLE");
  });

  it("marks a finding still present when the exact quoted text is unchanged", () => {
    const stillOverloaded = feedback({
      where: [
        {
          entity: "ParkingLot",
          field: "responsibility",
          value: "allocates parking spots, processes payments and issues tickets",
        },
      ],
    });
    const laterDesign: StructuredDesign = {
      ...emptyStructuredDesign(),
      classes: [
        {
          id: "cls_1",
          name: "ParkingLot",
          responsibility:
            "Allocates parking spots, processes payments and issues tickets.",
          attributes: [],
          methods: [],
        },
      ],
    };

    const [resolution] = resolveFeedback([stillOverloaded], laterDesign);

    expect(resolution?.status).toBe("STILL_PRESENT");
  });

  it("marks a finding likely addressed when every named entity is gone from the later design", () => {
    // The product's own worked example: ParkingLot dissolves into two new classes.
    const laterDesign: StructuredDesign = {
      ...emptyStructuredDesign(),
      classes: [
        { id: "c1", name: "SpotAllocator", responsibility: "Allocates spots.", attributes: [], methods: [] },
        { id: "c2", name: "PaymentService", responsibility: "Processes payment.", attributes: [], methods: [] },
      ],
    };

    const [resolution] = resolveFeedback([feedback()], laterDesign);

    expect(resolution?.status).toBe("ADDRESSED");
    expect(resolution?.entitiesRemoved).toEqual(["ParkingLot"]);
    // The wording must never overclaim: no "fixed" or "solved".
    expect(resolution?.detail.toLowerCase()).not.toContain("fixed");
    expect(resolution?.detail.toLowerCase()).not.toContain("solved");
  });

  it("marks a finding uncertain when the entity remains but its quoted text changed", () => {
    const laterDesign = designWithClass("ParkingLot", [{ name: "coordinate" }]);

    const [resolution] = resolveFeedback([feedback()], laterDesign);

    expect(resolution?.status).toBe("UNCERTAIN");
    expect(resolution?.entitiesStillPresent).toEqual(["ParkingLot"]);
  });

  it("marks a finding uncertain, not addressed, when only some referenced entities disappear", () => {
    const twoEntityFeedback = feedback({
      where: [{ entity: "ParkingLot" }, { entity: "PricingStrategy" }],
    });
    // Only ParkingLot is gone; PricingStrategy is still there under that name.
    const laterDesign: StructuredDesign = {
      ...emptyStructuredDesign(),
      interfaces: [
        {
          id: "i1",
          name: "PricingStrategy",
          responsibility: "Prices a stay.",
          methods: [],
        },
      ],
    };

    const [resolution] = resolveFeedback([twoEntityFeedback], laterDesign);

    expect(resolution?.status).toBe("UNCERTAIN");
  });

  it("never reports a resolution for the same feedback twice, once per item", () => {
    const resolutions = resolveFeedback(
      [feedback({ id: "a" }), feedback({ id: "b", where: [] })],
      emptyStructuredDesign(),
    );

    expect(resolutions.map((resolution) => resolution.feedbackId)).toEqual(["a", "b"]);
  });

  it("checks a method-field quote against the entity's actual methods", () => {
    const methodFeedback = feedback({
      where: [{ entity: "ParkingLot", field: "methods", value: "allocateSpot" }],
    });
    const laterDesign = designWithClass("ParkingLot", [{ name: "allocateSpot" }]);

    const [resolution] = resolveFeedback([methodFeedback], laterDesign);

    expect(resolution?.status).toBe("STILL_PRESENT");
  });

  it("checks a relationship-field quote against the entity's actual relationships", () => {
    const relationshipFeedback = feedback({
      where: [{ entity: "ParkingLot", field: "relationships", value: "DEPENDENCY" }],
    });
    const laterDesign: StructuredDesign = {
      ...designWithClass("ParkingLot"),
      relationships: [{ source: "ParkingLot", target: "PricingStrategy", type: "DEPENDENCY" }],
    };

    const [resolution] = resolveFeedback([relationshipFeedback], laterDesign);

    expect(resolution?.status).toBe("STILL_PRESENT");
  });

  it("pluralizes correctly and lists every entity when more than one disappears", () => {
    const twoEntityFeedback = feedback({
      where: [{ entity: "ParkingLot" }, { entity: "PricingStrategy" }],
    });

    const [resolution] = resolveFeedback([twoEntityFeedback], emptyStructuredDesign());

    expect(resolution?.status).toBe("ADDRESSED");
    expect(resolution?.entitiesRemoved).toEqual(["ParkingLot", "PricingStrategy"]);
    expect(resolution?.detail).toContain("ParkingLot, PricingStrategy");
    expect(resolution?.detail).toContain("no longer appear ");
  });
});
