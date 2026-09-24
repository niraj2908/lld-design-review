import { describe, expect, it } from "vitest";
import { natureOf } from "@/domain/evaluation/review-criterion";
import type { DeterministicCriterion } from "@/domain/evaluation/review-criterion";
import type { CriterionResult } from "@/domain/evaluation/criterion-result";
import type { EvaluationOutcome } from "@/domain/evaluation/evaluation-outcome";
import { buildDesignElementIndex } from "@/domain/design/design-element-index";
import type { StructuredDesign } from "@/domain/design/structured-design";
import { isGrounded } from "@/domain/feedback/feedback-item";
import {
  designForProblem,
  parkingLotProblem,
  submissionOf,
} from "@/testing/fixtures";
import { RULE_EVALUATOR_VERSION, RuleBasedEvaluator } from "./rule-based-evaluator";

const problem = parkingLotProblem();
const evaluator = new RuleBasedEvaluator();

function coveredDesign(): StructuredDesign {
  return designForProblem(problem);
}

async function evaluate(design: StructuredDesign): Promise<EvaluationOutcome> {
  return evaluator.evaluate({ problem, submission: submissionOf(design) });
}

function resultFor(
  outcome: EvaluationOutcome,
  criterion: DeterministicCriterion,
): CriterionResult {
  const result = outcome.criterionResults.find(
    (entry) => entry.criterion === criterion,
  );
  if (result === undefined) {
    throw new Error(`No result for ${criterion}`);
  }
  return result;
}

function codes(outcome: EvaluationOutcome): readonly string[] {
  return outcome.priorityImprovements.map((item) => item.code ?? "");
}

describe("RuleBasedEvaluator", () => {
  it("reports its version", () => {
    expect(evaluator.version).toBe(RULE_EVALUATOR_VERSION);
    expect(RULE_EVALUATOR_VERSION).toBe("rules-v1");
  });

  it("reports on exactly the five deterministic criteria", async () => {
    const outcome = await evaluate(coveredDesign());

    expect(outcome.criterionResults.map((entry) => entry.criterion)).toEqual([
      "STRUCTURAL_VALIDITY",
      "REQUIREMENT_COVERAGE",
      "DESIGN_COMPLETENESS",
      "EDGE_CASE_COVERAGE",
      "DESIGN_DECISIONS",
    ]);
  });

  it("marks every result it produces as a factual finding", async () => {
    const outcome = await evaluate(coveredDesign());

    for (const result of outcome.criterionResults) {
      expect(natureOf(result.criterion)).toBe("FACTUAL");
    }
  });

  it("never claims a design is STRONG, which would be a judgement", async () => {
    for (const design of [
      coveredDesign(),
      { ...coveredDesign(), requirementMappings: [] },
      { ...coveredDesign(), decisions: [], edgeCases: [] },
    ]) {
      const outcome = await evaluate(design);
      expect(
        outcome.criterionResults.map((entry) => entry.assessment),
      ).not.toContain("STRONG");
    }
  });

  it("attaches no confidence, because everything it reports is checkable", async () => {
    const outcome = await evaluate(coveredDesign());

    expect(outcome.confidence).toBeUndefined();
    for (const result of outcome.criterionResults) {
      expect(result.confidence).toBeUndefined();
    }
  });

  it("raises no improvement for a design that maps every requirement", async () => {
    const outcome = await evaluate(coveredDesign());

    expect(outcome.priorityImprovements).toEqual([]);
    expect(resultFor(outcome, "STRUCTURAL_VALIDITY").assessment).toBe("ADEQUATE");
    expect(resultFor(outcome, "DESIGN_COMPLETENESS").assessment).toBe("ADEQUATE");
  });

  it("is deterministic: the same submission produces the same result", async () => {
    const design = coveredDesign();

    const first = await evaluate(design);
    const second = await evaluate(design);

    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  describe("requirement coverage", () => {
    it("covers a requirement whose mapping resolves to a real element", async () => {
      const outcome = await evaluate(coveredDesign());
      const result = resultFor(outcome, "REQUIREMENT_COVERAGE");

      expect(result.assessment).toBe("ADEQUATE");
      expect(result.evidence).toEqual([
        { entity: "ParkingLot", field: "requirementMappings", value: "PL-REQ-01" },
        {
          entity: "PricingStrategy",
          field: "requirementMappings",
          value: "PL-REQ-02",
        },
      ]);
    });

    it("reports a requirement with no mapping at all", async () => {
      const design = coveredDesign();
      const outcome = await evaluate({
        ...design,
        requirementMappings: design.requirementMappings.slice(0, 1),
      });

      expect(codes(outcome)).toContain("REQUIREMENT_NOT_COVERED");
      expect(resultFor(outcome, "REQUIREMENT_COVERAGE").assessment).toBe(
        "NEEDS_IMPROVEMENT",
      );
      const item = outcome.priorityImprovements[0]!;
      expect(item.what).toContain("PL-REQ-02");
      expect(item.why).toContain("fee");
    });

    it("prioritises an unmapped MUST requirement above an unmapped SHOULD", async () => {
      const outcome = await evaluate({
        ...coveredDesign(),
        requirementMappings: [],
      });

      expect(outcome.priorityImprovements[0]?.priority).toBe("P0");
      expect(
        outcome.priorityImprovements.every((item) =>
          ["P0", "P2"].includes(item.priority),
        ),
      ).toBe(true);
    });

    it("reports a requirement as partially covered when part of its evidence is missing", async () => {
      const design = coveredDesign();
      const outcome = await evaluate({
        ...design,
        requirementMappings: [
          {
            ...design.requirementMappings[0]!,
            references: [
              { entity: "ParkingLot" },
              { entity: "NotInThisDesign" },
            ],
          },
          design.requirementMappings[1]!,
        ],
      });

      expect(codes(outcome)).toContain("REQUIREMENT_PARTIALLY_COVERED");
      const item = outcome.priorityImprovements.find(
        (entry) => entry.code === "REQUIREMENT_PARTIALLY_COVERED",
      )!;
      expect(item.what).toContain("NotInThisDesign");
      expect(item.where).toEqual([
        { entity: "ParkingLot", field: "requirementMappings", value: "PL-REQ-01" },
      ]);
    });

    it("does not infer coverage from a class whose name merely sounds right", async () => {
      const outcome = await evaluate({
        classes: [
          {
            id: "c1",
            name: "PricingStrategyImplementation",
            responsibility: "Prices a parking session by duration.",
            attributes: [],
            methods: [{ name: "calculateFee" }],
          },
        ],
        interfaces: [],
        relationships: [],
        decisions: [],
        edgeCases: [],
        requirementMappings: [],
      });

      expect(resultFor(outcome, "REQUIREMENT_COVERAGE").assessment).toBe(
        "NEEDS_IMPROVEMENT",
      );
      expect(
        codes(outcome).filter((code) => code === "REQUIREMENT_NOT_COVERED"),
      ).toHaveLength(problem.requirements.length);
    });
  });

  describe("structural validity", () => {
    it("reports duplicate class names", async () => {
      const design = coveredDesign();
      const outcome = await evaluate({
        ...design,
        classes: [...design.classes, { ...design.classes[0]!, id: "dupe" }],
      });

      expect(codes(outcome)).toContain("DUPLICATE_CLASS_NAME");
      expect(resultFor(outcome, "STRUCTURAL_VALIDITY").assessment).toBe(
        "NEEDS_IMPROVEMENT",
      );
    });

    it("reports duplicate interface names", async () => {
      const design = coveredDesign();
      const outcome = await evaluate({
        ...design,
        interfaces: [...design.interfaces, { ...design.interfaces[0]!, id: "d" }],
      });

      expect(codes(outcome)).toContain("DUPLICATE_INTERFACE_NAME");
    });

    it("reports a class and an interface sharing a name", async () => {
      const design = coveredDesign();
      const outcome = await evaluate({
        ...design,
        interfaces: [
          ...design.interfaces,
          {
            id: "itf_clash",
            name: "ParkingLot",
            responsibility: "Clashes with the class.",
            methods: [{ name: "park" }],
          },
        ],
      });

      expect(codes(outcome)).toContain("ELEMENT_NAME_COLLISION");
    });

    it("reports an invalid implementation target", async () => {
      const design = coveredDesign();
      const outcome = await evaluate({
        ...design,
        relationships: [
          { source: "SizeBasedPricing", target: "Ticket", type: "IMPLEMENTATION" },
        ],
      });

      expect(codes(outcome)).toContain("INVALID_IMPLEMENTATION_TARGET");
    });

    it("reports inheritance between a class and an interface", async () => {
      const design = coveredDesign();
      const outcome = await evaluate({
        ...design,
        relationships: [
          {
            source: "SizeBasedPricing",
            target: "PricingStrategy",
            type: "INHERITANCE",
          },
        ],
      });

      expect(codes(outcome)).toContain("INVALID_INHERITANCE_ENDPOINT");
    });

    it("reports a class inheriting from itself", async () => {
      const design = coveredDesign();
      const outcome = await evaluate({
        ...design,
        relationships: [
          { source: "ParkingLot", target: "ParkingLot", type: "INHERITANCE" },
        ],
      });

      expect(codes(outcome)).toContain("INVALID_SELF_RELATIONSHIP");
    });
  });

  describe("design completeness", () => {
    it("reports a relationship endpoint that does not exist", async () => {
      const design = coveredDesign();
      const outcome = await evaluate({
        ...design,
        relationships: [
          { source: "ParkingLot", target: "GarageDoor", type: "ASSOCIATION" },
        ],
      });

      expect(codes(outcome)).toContain("UNKNOWN_RELATIONSHIP_TARGET");
      expect(resultFor(outcome, "DESIGN_COMPLETENESS").assessment).toBe(
        "NEEDS_IMPROVEMENT",
      );
    });

    it("reports a class with no responsibility", async () => {
      const design = coveredDesign();
      const outcome = await evaluate({
        ...design,
        classes: [
          { ...design.classes[0]!, responsibility: "  " },
          ...design.classes.slice(1),
        ],
      });

      expect(codes(outcome)).toContain("CLASS_RESPONSIBILITY_REQUIRED");
    });

    it("invents no completeness complaint for a design that is merely small", async () => {
      const outcome = await evaluate({
        classes: [
          {
            id: "c1",
            name: "Lot",
            responsibility: "Holds vehicles.",
            attributes: [],
            methods: [],
          },
        ],
        interfaces: [],
        relationships: [],
        decisions: [],
        edgeCases: [],
        requirementMappings: [],
      });

      expect(resultFor(outcome, "DESIGN_COMPLETENESS").assessment).toBe(
        "ADEQUATE",
      );
    });

    it("never has to report an empty design, because a submission cannot hold one", () => {
      // The DESIGN_EMPTY branch is covered directly in the rule's own test; it is
      // unreachable through a Submission, which is the only thing the evaluator
      // is given.
      expect(() =>
        submissionOf({
          classes: [],
          interfaces: [],
          relationships: [],
          decisions: [],
          edgeCases: [],
          requirementMappings: [],
        }),
      ).toThrow(/at least one class or interface/);
    });
  });

  describe("edge cases and decisions", () => {
    it("records edge cases as present without judging them", async () => {
      const result = resultFor(
        await evaluate(coveredDesign()),
        "EDGE_CASE_COVERAGE",
      );

      expect(result.assessment).toBe("ADEQUATE");
      expect(result.concern).toBeUndefined();
    });

    it("reports missing edge cases", async () => {
      const outcome = await evaluate({ ...coveredDesign(), edgeCases: [] });

      expect(resultFor(outcome, "EDGE_CASE_COVERAGE").assessment).toBe("MISSING");
      expect(codes(outcome)).toContain("NO_EDGE_CASES_RECORDED");
    });

    it("records design decisions as present", async () => {
      const result = resultFor(
        await evaluate(coveredDesign()),
        "DESIGN_DECISIONS",
      );

      expect(result.assessment).toBe("ADEQUATE");
    });

    it("reports missing design decisions", async () => {
      const outcome = await evaluate({ ...coveredDesign(), decisions: [] });

      expect(resultFor(outcome, "DESIGN_DECISIONS").assessment).toBe("MISSING");
      expect(codes(outcome)).toContain("NO_DESIGN_DECISIONS_RECORDED");
    });
  });

  describe("valid alternatives", () => {
    it("does not penalise a design that uses no interfaces or inheritance", async () => {
      const design: StructuredDesign = {
        classes: [
          {
            id: "c1",
            name: "ParkingLotService",
            responsibility:
              "Admits vehicles, tracks occupancy and settles payment in one place.",
            attributes: [],
            methods: [{ name: "admit" }, { name: "release" }],
          },
        ],
        interfaces: [],
        relationships: [],
        decisions: [
          {
            decision: "Keep everything in one service while the rules are fixed.",
            rationale: "There is no stated variation point yet.",
            tradeoff: "A future pricing change touches this class.",
          },
        ],
        edgeCases: [
          {
            description: "The lot is full.",
            expectedBehavior: "Admission is refused.",
          },
        ],
        requirementMappings: problem.requirements.map((requirement) => ({
          requirementId: requirement.id,
          references: [{ entity: "ParkingLotService" }],
        })),
      };

      const outcome = await evaluate(design);

      expect(outcome.priorityImprovements).toEqual([]);
      for (const result of outcome.criterionResults) {
        expect(result.assessment).toBe("ADEQUATE");
      }
    });

    it("treats a larger and a smaller design that both map everything alike", async () => {
      const small = await evaluate({
        classes: [
          {
            id: "c1",
            name: "Lot",
            responsibility: "Everything about parking.",
            attributes: [],
            methods: [{ name: "park" }],
          },
        ],
        interfaces: [],
        relationships: [],
        decisions: [
          { decision: "One class.", rationale: "Simplest.", tradeoff: "Grows." },
        ],
        edgeCases: [{ description: "Full.", expectedBehavior: "Refuse." }],
        requirementMappings: problem.requirements.map((requirement) => ({
          requirementId: requirement.id,
          references: [{ entity: "Lot" }],
        })),
      });

      expect(small.priorityImprovements).toEqual([]);
    });
  });

  describe("evidence", () => {
    it("points only at elements the learner actually submitted", async () => {
      const design = coveredDesign();
      const outcome = await evaluate(design);
      const elements = buildDesignElementIndex(design);

      const allEvidence = [
        ...outcome.criterionResults.flatMap((result) => result.evidence),
        ...outcome.priorityImprovements.flatMap((item) => item.where),
      ];

      expect(allEvidence.length).toBeGreaterThan(0);
      for (const evidence of allEvidence) {
        expect(elements.has(evidence.entity)).toBe(true);
      }
    });

    it("grounds a structural finding in the element it concerns", async () => {
      const design = coveredDesign();
      const outcome = await evaluate({
        ...design,
        relationships: [
          { source: "ParkingLot", target: "GarageDoor", type: "ASSOCIATION" },
        ],
      });

      const item = outcome.priorityImprovements.find(
        (entry) => entry.code === "UNKNOWN_RELATIONSHIP_TARGET",
      )!;
      expect(isGrounded(item)).toBe(true);
      expect(item.where[0]).toEqual({
        entity: "ParkingLot",
        field: "relationships",
        value: "ParkingLot -> GarageDoor (ASSOCIATION)",
      });
    });

    it("leaves evidence empty rather than inventing it when nothing can be pointed at", async () => {
      const outcome = await evaluate({ ...coveredDesign(), edgeCases: [] });

      const item = outcome.priorityImprovements.find(
        (entry) => entry.code === "NO_EDGE_CASES_RECORDED",
      )!;
      expect(item.where).toEqual([]);
      expect(isGrounded(item)).toBe(false);
    });
  });

  describe("summary", () => {
    it("states the counts and disclaims judging quality", async () => {
      const summary = (await evaluate(coveredDesign())).summary;

      expect(summary).toContain("structurally sound");
      expect(summary).toContain("2 of 2 requirements");
      expect(summary).toContain("makes no judgement about the quality");
    });
  });
});
