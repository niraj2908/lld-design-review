import { describe, expect, it } from "vitest";
import { buildDesignElementIndex } from "@/domain/design/design-element-index";
import type { StructuredDesign } from "@/domain/design/structured-design";
import type { ValidationIssue } from "@/domain/shared/validation";
import type { ValidationIssueCode } from "@/domain/shared/validation";
import { validParkingLotDesign } from "@/testing/fixtures";
import { evidenceForIssue } from "./issue-evidence";

function issue(path: string, code: ValidationIssueCode): ValidationIssue {
  return { code, path, message: "irrelevant", severity: "ERROR" };
}

function resolve(design: StructuredDesign, path: string, code: ValidationIssueCode) {
  return evidenceForIssue(
    issue(path, code),
    design,
    buildDesignElementIndex(design),
  );
}

describe("evidence for a validation issue", () => {
  const design = validParkingLotDesign();

  it("points at the class the issue concerns", () => {
    expect(resolve(design, "classes[0].responsibility", "CLASS_RESPONSIBILITY_REQUIRED")).toEqual([
      { entity: "ParkingLot", field: "responsibility", value: "classes" },
    ]);
  });

  it("points at the interface the issue concerns", () => {
    expect(resolve(design, "interfaces[0].name", "INTERFACE_NAME_REQUIRED")).toEqual([
      { entity: "PricingStrategy", field: "name", value: "interfaces" },
    ]);
  });

  it("names the collection when the issue is about the element as a whole", () => {
    expect(resolve(design, "classes[1]", "DUPLICATE_CLASS_NAME")).toEqual([
      { entity: "Ticket", field: "classes" },
    ]);
  });

  it("describes a relationship through whichever endpoint exists", () => {
    const broken: StructuredDesign = {
      ...design,
      relationships: [
        { source: "Ghost", target: "Ticket", type: "ASSOCIATION" },
      ],
    };

    expect(resolve(broken, "relationships[0].source", "UNKNOWN_RELATIONSHIP_SOURCE")).toEqual([
      {
        entity: "Ticket",
        field: "relationships",
        value: "Ghost -> Ticket (ASSOCIATION)",
      },
    ]);
  });

  it("gives no evidence when neither relationship endpoint exists", () => {
    const broken: StructuredDesign = {
      ...design,
      relationships: [{ source: "Ghost", target: "Phantom", type: "ASSOCIATION" }],
    };

    expect(resolve(broken, "relationships[0]", "UNKNOWN_RELATIONSHIP_SOURCE")).toEqual(
      [],
    );
  });

  it("gives no evidence for a class that has no name to point at", () => {
    const broken: StructuredDesign = {
      ...design,
      classes: [{ ...design.classes[0]!, name: "   " }],
    };

    expect(resolve(broken, "classes[0].name", "CLASS_NAME_REQUIRED")).toEqual([]);
  });

  it("points a requirement mapping at its first reference that resolves", () => {
    const mapped: StructuredDesign = {
      ...design,
      requirementMappings: [
        {
          requirementId: "req_pl_01",
          references: [{ entity: "Ghost" }, { entity: "Ticket" }],
        },
      ],
    };

    expect(resolve(mapped, "requirementMappings[0].references[0].entity", "UNKNOWN_EVIDENCE_ENTITY")).toEqual([
      { entity: "Ticket", field: "requirementMappings", value: "req_pl_01" },
    ]);
  });

  it("gives no evidence for a mapping whose references all dangle", () => {
    const mapped: StructuredDesign = {
      ...design,
      requirementMappings: [
        { requirementId: "req_pl_01", references: [{ entity: "Ghost" }] },
      ],
    };

    expect(resolve(mapped, "requirementMappings[0]", "UNKNOWN_EVIDENCE_ENTITY")).toEqual(
      [],
    );
  });

  it.each([
    ["decisions[0].rationale", "DECISION_FIELD_REQUIRED"],
    ["edgeCases[0].description", "EDGE_CASE_FIELD_REQUIRED"],
  ] as const)(
    "gives no evidence for %s, which is not a design element",
    (path, code) => {
      expect(resolve(design, path, code)).toEqual([]);
    },
  );

  it.each(["design", "classes", "classes[abc].name", ""])(
    "gives no evidence for the unparseable path %s",
    (path) => {
      expect(resolve(design, path, "DESIGN_EMPTY")).toEqual([]);
    },
  );

  it.each([
    "classes[99].name",
    "interfaces[99].name",
    "relationships[99]",
    "requirementMappings[99]",
  ])("gives no evidence for the out-of-range path %s", (path) => {
    expect(resolve(design, path, "DESIGN_EMPTY")).toEqual([]);
  });
});
