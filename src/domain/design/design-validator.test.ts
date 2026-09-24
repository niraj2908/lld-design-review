import { describe, expect, it } from "vitest";
import {
  PARKING_LOT_REQUIREMENTS,
  validParkingLotDesign,
} from "@/testing/fixtures";
import { hasIssueCode, isValid } from "../shared/validation";
import type { ValidationIssueCode } from "../shared/validation";
import { DEFAULT_DESIGN_LIMITS } from "./design-limits";
import { validateStructuredDesign } from "./design-validator";
import { emptyStructuredDesign } from "./structured-design";
import type { StructuredDesign } from "./structured-design";

const REQUIREMENT_IDS = PARKING_LOT_REQUIREMENTS.map(
  (requirement) => requirement.id,
);

function validate(design: StructuredDesign) {
  return validateStructuredDesign(design, { requirementIds: REQUIREMENT_IDS });
}

function expectIssue(
  design: StructuredDesign,
  code: ValidationIssueCode,
): void {
  const result = validate(design);
  expect(hasIssueCode(result, code)).toBe(true);
  expect(isValid(result)).toBe(false);
}

describe("validateStructuredDesign", () => {
  it("accepts a complete valid design", () => {
    const result = validate(validParkingLotDesign());

    expect(result.issues).toEqual([]);
    expect(isValid(result)).toBe(true);
  });

  it("rejects an empty design", () => {
    expectIssue(emptyStructuredDesign(), "DESIGN_EMPTY");
  });

  it("stops at DESIGN_EMPTY instead of reporting downstream noise", () => {
    const result = validate(emptyStructuredDesign());

    expect(result.issues).toHaveLength(1);
  });

  it("rejects duplicate class names", () => {
    const design = validParkingLotDesign();
    const duplicated: StructuredDesign = {
      ...design,
      classes: [...design.classes, { ...design.classes[0]!, id: "cls_dupe" }],
    };

    expectIssue(duplicated, "DUPLICATE_CLASS_NAME");
  });

  it("rejects duplicate interface names", () => {
    const design = validParkingLotDesign();
    const duplicated: StructuredDesign = {
      ...design,
      interfaces: [
        ...design.interfaces,
        { ...design.interfaces[0]!, id: "itf_dupe" },
      ],
    };

    expectIssue(duplicated, "DUPLICATE_INTERFACE_NAME");
  });

  it("rejects a class and an interface sharing a name", () => {
    const design = validParkingLotDesign();
    const collided: StructuredDesign = {
      ...design,
      interfaces: [
        ...design.interfaces,
        {
          id: "itf_collide",
          name: "ParkingLot",
          responsibility: "Collides with the class name.",
          methods: [{ name: "park" }],
        },
      ],
    };

    expectIssue(collided, "ELEMENT_NAME_COLLISION");
  });

  it.each([
    ["name", "CLASS_NAME_REQUIRED"],
    ["responsibility", "CLASS_RESPONSIBILITY_REQUIRED"],
  ] as const)("rejects a blank class %s", (field, code) => {
    const design = validParkingLotDesign();
    const broken: StructuredDesign = {
      ...design,
      classes: [{ ...design.classes[0]!, [field]: "  " }, ...design.classes.slice(1)],
    };

    expectIssue(broken, code);
  });

  it.each([
    ["name", "INTERFACE_NAME_REQUIRED"],
    ["responsibility", "INTERFACE_RESPONSIBILITY_REQUIRED"],
  ] as const)("rejects a blank interface %s", (field, code) => {
    const design = validParkingLotDesign();
    const broken: StructuredDesign = {
      ...design,
      interfaces: [{ ...design.interfaces[0]!, [field]: "" }],
      relationships: design.relationships.filter(
        (relationship) => relationship.type !== "IMPLEMENTATION",
      ),
    };

    expectIssue(broken, code);
  });

  it("rejects a blank attribute name", () => {
    const design = validParkingLotDesign();
    const broken: StructuredDesign = {
      ...design,
      classes: [
        { ...design.classes[0]!, attributes: [{ name: " " }] },
        ...design.classes.slice(1),
      ],
    };

    expectIssue(broken, "CLASS_ATTRIBUTE_NAME_REQUIRED");
  });

  it("rejects a blank method name", () => {
    const design = validParkingLotDesign();
    const broken: StructuredDesign = {
      ...design,
      classes: [
        { ...design.classes[0]!, methods: [{ name: "" }] },
        ...design.classes.slice(1),
      ],
    };

    expectIssue(broken, "CLASS_METHOD_NAME_REQUIRED");
  });

  it("rejects an unknown relationship source", () => {
    const design = validParkingLotDesign();
    const broken: StructuredDesign = {
      ...design,
      relationships: [
        { source: "GarageDoor", target: "Ticket", type: "ASSOCIATION" },
      ],
    };

    expectIssue(broken, "UNKNOWN_RELATIONSHIP_SOURCE");
  });

  it("rejects an unknown relationship target", () => {
    const design = validParkingLotDesign();
    const broken: StructuredDesign = {
      ...design,
      relationships: [
        { source: "ParkingLot", target: "GarageDoor", type: "ASSOCIATION" },
      ],
    };

    expectIssue(broken, "UNKNOWN_RELATIONSHIP_TARGET");
  });

  it.each([
    ["source", "RELATIONSHIP_SOURCE_REQUIRED"],
    ["target", "RELATIONSHIP_TARGET_REQUIRED"],
  ] as const)("rejects a missing relationship %s", (field, code) => {
    const design = validParkingLotDesign();
    const broken: StructuredDesign = {
      ...design,
      relationships: [
        {
          source: "ParkingLot",
          target: "Ticket",
          type: "ASSOCIATION",
          [field]: "",
        },
      ],
    };

    expectIssue(broken, code);
  });

  it("rejects an unsupported relationship type", () => {
    const design = validParkingLotDesign();
    const broken = {
      ...design,
      relationships: [
        { source: "ParkingLot", target: "Ticket", type: "USES_SOMEHOW" },
      ],
    } as unknown as StructuredDesign;

    expectIssue(broken, "UNSUPPORTED_RELATIONSHIP_TYPE");
  });

  it("rejects an IMPLEMENTATION that targets a class", () => {
    const design = validParkingLotDesign();
    const broken: StructuredDesign = {
      ...design,
      relationships: [
        {
          source: "SizeBasedPricing",
          target: "Ticket",
          type: "IMPLEMENTATION",
        },
      ],
    };

    expectIssue(broken, "INVALID_IMPLEMENTATION_TARGET");
  });

  it("rejects INHERITANCE between a class and an interface", () => {
    const design = validParkingLotDesign();
    const broken: StructuredDesign = {
      ...design,
      relationships: [
        {
          source: "SizeBasedPricing",
          target: "PricingStrategy",
          type: "INHERITANCE",
        },
      ],
    };

    expectIssue(broken, "INVALID_INHERITANCE_ENDPOINT");
  });

  it("rejects a class inheriting from itself", () => {
    const design = validParkingLotDesign();
    const broken: StructuredDesign = {
      ...design,
      relationships: [
        { source: "ParkingLot", target: "ParkingLot", type: "INHERITANCE" },
      ],
    };

    expectIssue(broken, "INVALID_SELF_RELATIONSHIP");
  });

  it("allows a self-referencing composition, which models a composite", () => {
    const design = validParkingLotDesign();
    const composite: StructuredDesign = {
      ...design,
      relationships: [
        ...design.relationships,
        { source: "Ticket", target: "Ticket", type: "COMPOSITION" },
      ],
    };

    expect(isValid(validate(composite))).toBe(true);
  });

  it("rejects the same relationship declared twice", () => {
    const design = validParkingLotDesign();
    const duplicated: StructuredDesign = {
      ...design,
      relationships: [...design.relationships, design.relationships[0]!],
    };

    expectIssue(duplicated, "DUPLICATE_RELATIONSHIP");
  });

  it.each(["decision", "rationale", "tradeoff"] as const)(
    "rejects a decision with no %s",
    (field) => {
      const design = validParkingLotDesign();
      const broken: StructuredDesign = {
        ...design,
        decisions: [{ ...design.decisions[0]!, [field]: " " }],
      };

      expectIssue(broken, "DECISION_FIELD_REQUIRED");
    },
  );

  it.each(["description", "expectedBehavior"] as const)(
    "rejects an edge case with no %s",
    (field) => {
      const design = validParkingLotDesign();
      const broken: StructuredDesign = {
        ...design,
        edgeCases: [{ ...design.edgeCases[0]!, [field]: "" }],
      };

      expectIssue(broken, "EDGE_CASE_FIELD_REQUIRED");
    },
  );

  it("accepts a requirement mapping that points at a real requirement", () => {
    const result = validate(validParkingLotDesign());

    expect(hasIssueCode(result, "UNKNOWN_REQUIREMENT")).toBe(false);
  });

  it("rejects a mapping to a requirement from another problem", () => {
    const design = validParkingLotDesign();
    const broken: StructuredDesign = {
      ...design,
      requirementMappings: [
        {
          requirementId: "req_vending_01",
          references: [{ entity: "ParkingLot" }],
        },
      ],
    };

    expectIssue(broken, "UNKNOWN_REQUIREMENT");
  });

  it("rejects a mapping with no design reference", () => {
    const design = validParkingLotDesign();
    const broken: StructuredDesign = {
      ...design,
      requirementMappings: [
        { requirementId: "req_pl_01", references: [] },
      ],
    };

    expectIssue(broken, "REQUIREMENT_MAPPING_REFERENCE_REQUIRED");
  });

  it("rejects a mapping that references an element the design does not contain", () => {
    const design = validParkingLotDesign();
    const broken: StructuredDesign = {
      ...design,
      requirementMappings: [
        {
          requirementId: "req_pl_01",
          references: [{ entity: "FeeCalculator" }],
        },
      ],
    };

    expectIssue(broken, "UNKNOWN_EVIDENCE_ENTITY");
  });

  it("reports a collection that exceeds its limit", () => {
    const design = validParkingLotDesign();
    const oversized: StructuredDesign = {
      ...design,
      edgeCases: Array.from(
        { length: DEFAULT_DESIGN_LIMITS.maxEdgeCases + 1 },
        (_unused, index) => ({
          description: `Edge case ${index}`,
          expectedBehavior: "Handled.",
        }),
      ),
    };

    expectIssue(oversized, "COLLECTION_LIMIT_EXCEEDED");
  });

  it("reports a name that exceeds the length limit", () => {
    const design = validParkingLotDesign();
    const oversized: StructuredDesign = {
      ...design,
      classes: [
        {
          ...design.classes[0]!,
          name: "A".repeat(DEFAULT_DESIGN_LIMITS.maxNameLength + 1),
        },
        ...design.classes.slice(1),
      ],
      relationships: [],
      requirementMappings: [],
    };

    expectIssue(oversized, "NAME_TOO_LONG");
  });

  it("does not require interfaces, decisions or patterns, so alternative designs pass", () => {
    const minimal: StructuredDesign = {
      classes: [
        {
          id: "cls_machine",
          name: "ParkingLotService",
          responsibility:
            "Handles parking and exit in one place, which is acceptable while policies are fixed.",
          attributes: [],
          methods: [{ name: "park" }, { name: "exit" }, { name: "calculateFee" }],
        },
      ],
      interfaces: [],
      relationships: [],
      decisions: [],
      edgeCases: [],
      requirementMappings: [],
    };

    expect(isValid(validate(minimal))).toBe(true);
  });
});
