import { describe, expect, it } from "vitest";
import { Evaluation } from "@/domain/evaluation/evaluation";
import type { EvaluationOutcome } from "@/domain/evaluation/evaluation-outcome";
import { PersistenceMappingError } from "../persistence-errors";
import {
  toEvaluation,
  toEvaluationChildrenData,
  toEvaluationWriteData,
} from "./evaluation-mapper";
import type { EvaluationRow } from "./rows";

const NOW = new Date("2026-03-01T09:00:00.000Z");

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
      evidence: [{ entity: "ParkingLot", field: "methods", value: "exit" }],
      concern: "Exit also prices the stay.",
      suggestion: "Consider delegating the amount owed.",
      confidence: 0.7,
    },
  ],
  strengths: ["Pricing is a contract, not a branch."],
  priorityImprovements: [
    {
      id: "fbk_1",
      priority: "P1",
      criterion: "RESPONSIBILITY",
      what: "Fee calculation sits on the lot.",
      where: [{ entity: "ParkingLot" }],
      why: "Tariffs change independently.",
      reconsider: "Could the lot delegate this?",
    },
  ],
  summary: "One boundary is worth review.",
  confidence: 0.7,
};

function pendingEvaluation(): Evaluation {
  return Evaluation.request({
    id: "evl_1",
    submissionId: "sub_1",
    versions: VERSIONS,
    idempotencyKey: "att_1:v1:hybrid-v1",
    now: NOW,
  });
}

function rowFrom(evaluation: Evaluation): EvaluationRow {
  const write = toEvaluationWriteData(evaluation);
  const children = toEvaluationChildrenData(evaluation);
  return {
    id: evaluation.id,
    submissionId: evaluation.submissionId,
    ...write,
    criterionResults: children.criterionResults.map((entry) => ({
      ...entry,
      evidence: entry.evidence.create.map((evidence) => ({ ...evidence })),
    })),
    feedbackItems: children.feedbackItems.map((entry) => ({
      ...entry,
      evidence: entry.evidence.create.map((evidence) => ({ ...evidence })),
    })),
  };
}

describe("evaluation mapper", () => {
  it("writes no outcome columns while the evaluation is pending", () => {
    const write = toEvaluationWriteData(pendingEvaluation());

    expect(write.status).toBe("PENDING");
    expect(write.summary).toBeNull();
    expect(write.confidence).toBeNull();
    expect(write.strengths).toEqual([]);
    expect(write.failureCode).toBeNull();
  });

  it("flattens the four versions into their own columns", () => {
    const write = toEvaluationWriteData(pendingEvaluation());

    expect(write.evaluatorVersion).toBe("hybrid-v1");
    expect(write.rubricVersion).toBe("parking-lot-v1");
    expect(write.promptVersion).toBe("design-review-v1");
    expect(write.knowledgeVersion).toBe("lld-kb-v1");
  });

  it("round-trips a completed evaluation with its outcome", () => {
    const evaluation = pendingEvaluation();
    evaluation.start(NOW);
    evaluation.complete(OUTCOME, NOW);

    const restored = toEvaluation(rowFrom(evaluation));

    expect(restored.status).toBe("COMPLETED");
    expect(restored.outcome).toEqual(OUTCOME);
    expect(restored.attemptCount).toBe(1);
  });

  it("round-trips a failure", () => {
    const evaluation = pendingEvaluation();
    evaluation.start(NOW);
    evaluation.fail({ code: "LLM_TIMEOUT", message: "Timed out." }, NOW);

    const restored = toEvaluation(rowFrom(evaluation));

    expect(restored.status).toBe("FAILED");
    expect(restored.failure).toEqual({
      code: "LLM_TIMEOUT",
      message: "Timed out.",
    });
    expect(restored.outcome).toBeNull();
  });

  it("writes no children while there is no outcome", () => {
    const children = toEvaluationChildrenData(pendingEvaluation());

    expect(children.criterionResults).toEqual([]);
    expect(children.feedbackItems).toEqual([]);
  });

  it("positions criterion results, feedback items and their evidence", () => {
    const evaluation = pendingEvaluation();
    evaluation.start(NOW);
    evaluation.complete(OUTCOME, NOW);

    const children = toEvaluationChildrenData(evaluation);

    expect(children.criterionResults[0]?.position).toBe(0);
    expect(children.criterionResults[0]?.evidence.create[0]?.position).toBe(0);
    expect(children.feedbackItems[0]?.position).toBe(0);
    expect(children.feedbackItems[0]?.id).toBe("fbk_1");
  });

  it("restores an outcome with no confidence as an absent property", () => {
    const evaluation = pendingEvaluation();
    evaluation.start(NOW);
    evaluation.complete(
      {
        criterionResults: [],
        strengths: [],
        priorityImprovements: [],
        summary: "No confidence reported.",
      },
      NOW,
    );

    const restored = toEvaluation(rowFrom(evaluation));

    expect("confidence" in restored.outcome!).toBe(false);
  });

  it("refuses a COMPLETED row that stores no summary", () => {
    const evaluation = pendingEvaluation();
    evaluation.start(NOW);
    evaluation.complete(OUTCOME, NOW);
    const corrupt: EvaluationRow = { ...rowFrom(evaluation), summary: null };

    expect(() => toEvaluation(corrupt)).toThrow(PersistenceMappingError);
  });

  it("ignores outcome columns on a row that is not COMPLETED", () => {
    const evaluation = pendingEvaluation();
    evaluation.start(NOW);
    evaluation.complete(OUTCOME, NOW);
    const stale: EvaluationRow = { ...rowFrom(evaluation), status: "EVALUATING" };

    expect(toEvaluation(stale).outcome).toBeNull();
  });
});
