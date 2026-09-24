import { describe, expect, it } from "vitest";
import {
  LEARNER_ID,
  PARKING_LOT_PROBLEM_ID,
  validParkingLotDesign,
} from "@/testing/fixtures";
import { createHarness } from "@/testing/harness";
import type { Harness } from "@/testing/harness";
import { Evaluation } from "@/domain/evaluation/evaluation";
import { buildEvaluationIdempotencyKey } from "@/domain/evaluation/evaluation-versions";
import { AttemptNotFoundError, ProblemNotFoundError } from "../errors";

const VERSIONS = {
  evaluatorVersion: "hybrid-v1",
  rubricVersion: "parking-lot-v1",
  promptVersion: "design-review-v1",
  knowledgeVersion: "lld-kb-v1",
};

async function submittedAttempt(harness: Harness) {
  const { attemptId } = await harness.startAttempt.execute({
    problemId: PARKING_LOT_PROBLEM_ID,
    learnerId: LEARNER_ID,
  });
  const submission = await harness.submitAttempt.execute({
    attemptId,
    design: validParkingLotDesign(),
  });
  return { attemptId, submission };
}

async function recordFailedEvaluation(
  harness: Harness,
  attemptId: string,
  submissionId: string,
  submissionVersion: number,
): Promise<Evaluation> {
  const evaluation = Evaluation.request({
    id: harness.ids.generate("evl"),
    submissionId,
    versions: VERSIONS,
    idempotencyKey: buildEvaluationIdempotencyKey({
      attemptId,
      submissionVersion,
      evaluatorVersion: VERSIONS.evaluatorVersion,
    }),
    now: harness.clock.now(),
  });
  evaluation.start(harness.clock.now());
  evaluation.fail(
    { code: "LLM_TIMEOUT", message: "Provider timed out." },
    harness.clock.now(),
  );
  await harness.evaluations.save(evaluation);

  const attempt = await harness.attempts.findById(attemptId);
  attempt?.markEvaluating(harness.clock.now());
  attempt?.markFailed(harness.clock.now());
  if (attempt !== null && attempt !== undefined) {
    await harness.attempts.update(attempt);
  }

  return evaluation;
}

describe("GetAttempt", () => {
  it("returns the attempt with its problem requirements", async () => {
    const harness = createHarness();
    const { attemptId } = await submittedAttempt(harness);

    const result = await harness.getAttempt.execute({ attemptId });

    expect(result.attempt.status).toBe("SUBMITTED");
    expect(result.problem.slug).toBe("parking-lot");
    expect(result.problem.requirements).toHaveLength(2);
  });

  it("returns the latest submission and no evaluation before one exists", async () => {
    const harness = createHarness();
    const { attemptId, submission } = await submittedAttempt(harness);

    const result = await harness.getAttempt.execute({ attemptId });

    expect(result.latestSubmission?.id).toBe(submission.submissionId);
    expect(result.latestEvaluation).toBeNull();
  });

  it("returns the latest evaluation once one exists", async () => {
    const harness = createHarness();
    const { attemptId, submission } = await submittedAttempt(harness);
    await recordFailedEvaluation(
      harness,
      attemptId,
      submission.submissionId,
      submission.submissionVersion,
    );

    const result = await harness.getAttempt.execute({ attemptId });

    expect(result.latestEvaluation?.status).toBe("FAILED");
    expect(result.latestEvaluation?.failure?.code).toBe("LLM_TIMEOUT");
  });

  it("returns no submission for an attempt still in progress", async () => {
    const harness = createHarness();
    const { attemptId } = await harness.startAttempt.execute({
      problemId: PARKING_LOT_PROBLEM_ID,
      learnerId: LEARNER_ID,
    });

    const result = await harness.getAttempt.execute({ attemptId });

    expect(result.latestSubmission).toBeNull();
  });

  it("fails for an unknown attempt", async () => {
    const harness = createHarness();

    await expect(
      harness.getAttempt.execute({ attemptId: "att_missing" }),
    ).rejects.toThrow(AttemptNotFoundError);
  });
});

describe("GetAttemptHistory", () => {
  it("returns an empty history before the learner starts", async () => {
    const harness = createHarness();

    const result = await harness.getAttemptHistory.execute({
      learnerId: LEARNER_ID,
      problemId: PARKING_LOT_PROBLEM_ID,
    });

    expect(result.entries).toEqual([]);
  });

  it("lists attempts in order with their submission and evaluation status", async () => {
    const harness = createHarness();
    const first = await submittedAttempt(harness);
    await recordFailedEvaluation(
      harness,
      first.attemptId,
      first.submission.submissionId,
      first.submission.submissionVersion,
    );
    await submittedAttempt(harness);

    const result = await harness.getAttemptHistory.execute({
      learnerId: LEARNER_ID,
      problemId: PARKING_LOT_PROBLEM_ID,
    });

    expect(result.entries.map((entry) => entry.attemptNumber)).toEqual([1, 2]);
    expect(result.entries[0]?.evaluationStatus).toBe("FAILED");
    expect(result.entries[0]?.submissionVersion).toBe(1);
    expect(result.entries[1]?.evaluationStatus).toBeNull();
  });

  it("does not leak another learner's attempts", async () => {
    const harness = createHarness();
    await submittedAttempt(harness);

    const result = await harness.getAttemptHistory.execute({
      learnerId: "learner_other",
      problemId: PARKING_LOT_PROBLEM_ID,
    });

    expect(result.entries).toEqual([]);
  });

  it("fails for an unknown problem", async () => {
    const harness = createHarness();

    await expect(
      harness.getAttemptHistory.execute({
        learnerId: LEARNER_ID,
        problemId: "prb_missing",
      }),
    ).rejects.toThrow(ProblemNotFoundError);
  });
});

describe("RetryEvaluation", () => {
  it("re-opens the failed evaluation and moves the attempt back to EVALUATING", async () => {
    const harness = createHarness();
    const { attemptId, submission } = await submittedAttempt(harness);
    await recordFailedEvaluation(
      harness,
      attemptId,
      submission.submissionId,
      submission.submissionVersion,
    );

    const result = await harness.retryEvaluation.execute({ attemptId });

    expect(result.attemptStatus).toBe("EVALUATING");
    expect(result.evaluationStatus).toBe("EVALUATING");
    expect(result.submissionId).toBe(submission.submissionId);
  });

  it("keeps the submission untouched, so retry never rewrites learner work", async () => {
    const harness = createHarness();
    const { attemptId, submission } = await submittedAttempt(harness);
    await recordFailedEvaluation(
      harness,
      attemptId,
      submission.submissionId,
      submission.submissionVersion,
    );
    const before = await harness.submissions.findById(submission.submissionId);

    await harness.retryEvaluation.execute({ attemptId });

    const after = await harness.submissions.findById(submission.submissionId);
    expect(after?.toSnapshot()).toEqual(before?.toSnapshot());
    expect(await harness.submissions.countByAttemptId(attemptId)).toBe(1);
  });

  it("is idempotent in its logical identity across retries", async () => {
    const harness = createHarness();
    const { attemptId, submission } = await submittedAttempt(harness);
    const evaluation = await recordFailedEvaluation(
      harness,
      attemptId,
      submission.submissionId,
      submission.submissionVersion,
    );

    const result = await harness.retryEvaluation.execute({ attemptId });

    expect(result.idempotencyKey).toBe(evaluation.idempotencyKey);
    expect(
      (await harness.evaluations.findByIdempotencyKey(result.idempotencyKey))
        ?.id,
    ).toBe(evaluation.id);
  });

  it("counts the retry as a further evaluation run", async () => {
    const harness = createHarness();
    const { attemptId, submission } = await submittedAttempt(harness);
    await recordFailedEvaluation(
      harness,
      attemptId,
      submission.submissionId,
      submission.submissionVersion,
    );

    const result = await harness.retryEvaluation.execute({ attemptId });

    const stored = await harness.evaluations.findById(result.evaluationId);
    expect(stored?.attemptCount).toBe(2);
    expect(stored?.failure).toBeNull();
  });

  it("refuses to retry an attempt that has not failed", async () => {
    const harness = createHarness();
    const { attemptId } = await submittedAttempt(harness);

    await expect(
      harness.retryEvaluation.execute({ attemptId }),
    ).rejects.toThrow(/cannot move from SUBMITTED to EVALUATING/);
  });

  it("fails for an unknown attempt", async () => {
    const harness = createHarness();

    await expect(
      harness.retryEvaluation.execute({ attemptId: "att_missing" }),
    ).rejects.toThrow(AttemptNotFoundError);
  });
});
