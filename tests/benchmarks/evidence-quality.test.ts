import { describe, expect, it } from "vitest";
import { validateEvidence } from "@/domain/evaluation/evidence-validation";
import { AIDesignEvaluator } from "@/evaluation-engine/ai/ai-design-evaluator";
import { submissionOf } from "@/testing/fixtures";
import { FakeLLMProvider } from "@/testing/fake-llm-provider";
import { benchmarkCase } from "./fixtures";

/**
 * Section 9 of the M10 benchmark: every meaningful concern should be traceable
 * to something real in the design — a class, an interface, a relationship, a
 * requirement mapping, a decision, or an edge case — and evidence that cannot be
 * traced must never become trusted evidence.
 */
describe("evidence quality benchmark", () => {
  it("accepts evidence pointing at a class, an interface, a relationship, a requirement, a decision and an edge case", () => {
    const strong = benchmarkCase("strong-design").design;
    const overEngineered = benchmarkCase("over-engineered-design").design;
    const edgeHeavy = benchmarkCase("edge-case-heavy-design").design;

    const { verified, rejected } = validateEvidence(
      [
        { entity: "ParkingLot", field: "responsibility", value: "Owns levels" }, // class
        { entity: "PricingStrategy", field: "methods", value: "calculateFee" }, // interface
        { entity: "ParkingLot", field: "relationships", value: "SizeBasedPricing" }, // relationship, from the edge-heavy variant
        { entity: "PricingStrategy", field: "requirementMappings", value: "req_pl_02" }, // requirement
        { entity: "ParkingLotService", field: "decisions", value: "Introduce a factory" }, // decision, from the over-engineered design
        { entity: "ParkingLot", field: "edgeCases", value: "Two vehicles arrive" }, // edge case, from the edge-heavy variant
      ],
      // The relationship and edge-case items are only present on the edge-heavy
      // variant; the rest are shared with the strong design's own classes and
      // interface. Evidence is checked one design at a time in production, so
      // this benchmark checks each item against the design that actually has it.
      strong,
    );

    // Only the items that exist on `strong` verify here — the relationship, the
    // decision text and one edge-case wording live on the other two designs.
    expect(verified.map((e) => e.entity)).toEqual(
      expect.arrayContaining(["ParkingLot", "PricingStrategy"]),
    );
    expect(rejected.length).toBeGreaterThan(0);

    const { verified: verifiedOnEdgeHeavy } = validateEvidence(
      [
        { entity: "ParkingLot", field: "relationships", value: "SizeBasedPricing" },
        { entity: "ParkingLot", field: "edgeCases", value: "Two vehicles arrive" },
      ],
      edgeHeavy,
    );
    expect(verifiedOnEdgeHeavy).toHaveLength(2);

    const { verified: verifiedOnOverEngineered } = validateEvidence(
      [{ entity: "ParkingLotService", field: "decisions", value: "Introduce a factory" }],
      overEngineered,
    );
    expect(verifiedOnOverEngineered).toHaveLength(1);
  });

  it("rejects an entity that does not exist in the design (hallucinated element)", () => {
    const { verified, rejected } = validateEvidence(
      [{ entity: "PaymentGateway", field: "responsibility", value: "Anything" }],
      benchmarkCase("strong-design").design,
    );

    expect(verified).toEqual([]);
    expect(rejected).toEqual([
      { evidence: { entity: "PaymentGateway", field: "responsibility", value: "Anything" }, reason: "UNKNOWN_ENTITY" },
    ]);
  });

  it("rejects a field the submission format does not have", () => {
    const { rejected } = validateEvidence(
      [{ entity: "ParkingLot", field: "score" as never, value: "anything" }],
      benchmarkCase("strong-design").design,
    );

    expect(rejected[0]?.reason).toBe("UNKNOWN_FIELD");
  });

  it("rejects a real entity and field with a value that never appears there", () => {
    const { rejected } = validateEvidence(
      [{ entity: "ParkingLot", field: "responsibility", value: "Processes credit card refunds" }],
      benchmarkCase("strong-design").design,
    );

    expect(rejected[0]?.reason).toBe("VALUE_NOT_FOUND");
  });

  it("end to end: a judge answer mixing real and hallucinated evidence keeps only the real half and reports the rest as unverified", async () => {
    const testCase = benchmarkCase("weak-design");
    const llm = FakeLLMProvider.answering({
      criteria: [
        {
          criterion: "COUPLING",
          assessment: "NEEDS_IMPROVEMENT",
          evidence: [
            // Real:
            { entity: "ParkingLotManager", field: "relationships", value: "SqlDatabase" },
            // Hallucinated — no such class exists in this design:
            { entity: "PaymentGateway", field: "relationships", value: "SqlDatabase" },
          ],
          concern: "Direct coupling to infrastructure.",
          confidence: 0.6,
        },
      ],
      strengths: [],
      priorityImprovements: [],
      summary: "One real coupling concern, and one that could not be confirmed.",
    });

    const outcome = await new AIDesignEvaluator(llm).evaluate({
      problem: testCase.problem,
      submission: submissionOf(testCase.design),
    });

    const coupling = outcome.criterionResults.find((r) => r.criterion === "COUPLING");
    expect(coupling?.evidence).toEqual([
      { entity: "ParkingLotManager", field: "relationships", value: "SqlDatabase" },
    ]);
    expect(coupling?.unverifiedEvidenceCount).toBe(1);
    // The hallucinated entity name never reaches the outcome.
    expect(JSON.stringify(outcome)).not.toContain("PaymentGateway");
  });
});
