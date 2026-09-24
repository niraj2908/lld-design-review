import { describe, expect, it } from "vitest";
import { InvalidEvaluationStateError } from "../shared/errors";
import { Evaluation } from "./evaluation";
import type { EvaluationOutcome } from "./evaluation-outcome";
import { EVALUATION_STATUSES, canTransitionEvaluation } from "./evaluation-status";
import type { EvaluationStatus } from "./evaluation-status";
import { buildEvaluationIdempotencyKey } from "./evaluation-versions";

const NOW = new Date("2026-02-01T10:00:00.000Z");
const LATER = new Date("2026-02-01T10:00:30.000Z");

const VERSIONS = {
  evaluatorVersion: "hybrid-v1",
  rubricVersion: "parking-lot-v1",
  promptVersion: "design-review-v1",
  knowledgeVersion: "lld-kb-v1",
};

const OUTCOME: EvaluationOutcome = {
  criterionResults: [
    {
      criterion: "RESPONSIBILITY",
      assessment: "NEEDS_IMPROVEMENT",
      evidence: [
        { entity: "ParkingLot", field: "methods", value: "calculateFee" },
      ],
      concern: "ParkingLot owns pricing logic.",
      suggestion: "Consider isolating pricing policy.",
      confidence: 0.82,
    },
  ],
  strengths: ["Allocation is separated from vehicle modelling."],
  priorityImprovements: [
    {
      id: "fbk_001",
      priority: "P1",
      criterion: "RESPONSIBILITY",
      what: "Pricing logic is concentrated in ParkingLot.",
      where: [{ entity: "ParkingLot", field: "methods", value: "calculateFee" }],
      why: "Pricing rules may vary independently of parking operations.",
      reconsider: "Could pricing sit behind a policy abstraction?",
    },
  ],
  summary: "The core flow is covered; one responsibility boundary is worth review.",
  confidence: 0.8,
};

function requestEvaluation(): Evaluation {
  return Evaluation.request({
    id: "evl_001",
    submissionId: "sub_001",
    versions: VERSIONS,
    idempotencyKey: buildEvaluationIdempotencyKey({
      attemptId: "att_001",
      submissionVersion: 1,
      evaluatorVersion: VERSIONS.evaluatorVersion,
    }),
    now: NOW,
  });
}

describe("Evaluation", () => {
  it("is requested as PENDING with the versions that will produce it", () => {
    const evaluation = requestEvaluation();

    expect(evaluation.status).toBe("PENDING");
    expect(evaluation.versions).toEqual(VERSIONS);
    expect(evaluation.attemptCount).toBe(0);
    expect(evaluation.outcome).toBeNull();
    expect(evaluation.failure).toBeNull();
  });

  it("builds an idempotency key from attempt, submission version and evaluator", () => {
    expect(requestEvaluation().idempotencyKey).toBe("att_001:v1:hybrid-v1");
  });

  it("counts every run, including retries", () => {
    const evaluation = requestEvaluation();

    evaluation.start(LATER);
    evaluation.fail({ code: "LLM_TIMEOUT", message: "Provider timed out." }, LATER);
    evaluation.start(LATER);

    expect(evaluation.attemptCount).toBe(2);
  });

  it("records the outcome on completion", () => {
    const evaluation = requestEvaluation();

    evaluation.start(LATER);
    evaluation.complete(OUTCOME, LATER);

    expect(evaluation.status).toBe("COMPLETED");
    expect(evaluation.outcome?.summary).toBe(OUTCOME.summary);
    expect(evaluation.completedAt).toEqual(LATER);
  });

  it("records why it failed and keeps the submission reference", () => {
    const evaluation = requestEvaluation();

    evaluation.start(LATER);
    evaluation.fail({ code: "LLM_TIMEOUT", message: "Provider timed out." }, LATER);

    expect(evaluation.status).toBe("FAILED");
    expect(evaluation.failure?.code).toBe("LLM_TIMEOUT");
    expect(evaluation.submissionId).toBe("sub_001");
  });

  it("clears the previous failure when a retry starts", () => {
    const evaluation = requestEvaluation();

    evaluation.start(LATER);
    evaluation.fail({ code: "LLM_TIMEOUT", message: "Provider timed out." }, LATER);
    evaluation.start(LATER);

    expect(evaluation.status).toBe("EVALUATING");
    expect(evaluation.failure).toBeNull();
  });

  it("refuses to complete an evaluation that never started", () => {
    const evaluation = requestEvaluation();

    expect(() => evaluation.complete(OUTCOME, LATER)).toThrow(
      InvalidEvaluationStateError,
    );
  });

  it("refuses to retry a completed evaluation", () => {
    const evaluation = requestEvaluation();
    evaluation.start(LATER);
    evaluation.complete(OUTCOME, LATER);

    expect(() => evaluation.start(LATER)).toThrow(InvalidEvaluationStateError);
  });

  const validTransitions: readonly [EvaluationStatus, EvaluationStatus][] = [
    ["PENDING", "EVALUATING"],
    ["EVALUATING", "COMPLETED"],
    ["EVALUATING", "FAILED"],
    ["FAILED", "EVALUATING"],
  ];

  it.each(validTransitions)("allows %s -> %s", (from, to) => {
    expect(canTransitionEvaluation(from, to)).toBe(true);
  });

  const invalidTransitions = EVALUATION_STATUSES.flatMap((from) =>
    EVALUATION_STATUSES.filter(
      (to) =>
        !validTransitions.some(
          ([validFrom, validTo]) => validFrom === from && validTo === to,
        ),
    ).map((to) => [from, to] as const),
  );

  it.each(invalidTransitions)("rejects %s -> %s", (from, to) => {
    expect(canTransitionEvaluation(from, to)).toBe(false);
  });
});
