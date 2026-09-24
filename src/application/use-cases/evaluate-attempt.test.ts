import { describe, expect, it } from "vitest";
import { Attempt } from "@/domain/attempt/attempt";
import type { DesignEvaluator } from "../ports/evaluator";
import type { EvaluationContext } from "../ports/evaluator";
import type { EvaluationOutcome } from "@/domain/evaluation/evaluation-outcome";
import { NOT_APPLICABLE_VERSION } from "@/domain/evaluation/evaluation-versions";
import { InvalidAttemptStateError } from "@/domain/shared/errors";
import {
  LEARNER_ID,
  PARKING_LOT_PROBLEM_ID,
  designForProblem,
  parkingLotProblem,
} from "@/testing/fixtures";
import { createHarness } from "@/testing/harness";
import type { Harness } from "@/testing/harness";
import {
  AttemptNotFoundError,
  EvaluationExecutionError,
  SubmissionNotFoundError,
} from "../errors";

const problem = parkingLotProblem();

async function submittedAttempt(harness: Harness): Promise<string> {
  const { attemptId } = await harness.startAttempt.execute({
    problemId: PARKING_LOT_PROBLEM_ID,
    learnerId: LEARNER_ID,
  });
  await harness.submitAttempt.execute({
    attemptId,
    design: designForProblem(problem),
  });
  return attemptId;
}

class RecordingEvaluator implements DesignEvaluator {
  readonly version = "recording-v1";
  readonly seen: EvaluationContext[] = [];

  async evaluate(context: EvaluationContext): Promise<EvaluationOutcome> {
    this.seen.push(context);
    return {
      criterionResults: [],
      strengths: [],
      priorityImprovements: [],
      summary: "recorded",
    };
  }
}

class ThrowingEvaluator implements DesignEvaluator {
  readonly version = "throwing-v1";

  async evaluate(): Promise<EvaluationOutcome> {
    throw new Error("evaluator exploded");
  }
}

describe("EvaluateAttempt", () => {
  it("evaluates the persisted submission and completes the attempt", async () => {
    const harness = createHarness();
    const attemptId = await submittedAttempt(harness);

    const result = await harness.evaluateAttempt.execute({ attemptId });

    expect(result.attemptStatus).toBe("COMPLETED");
    expect(result.evaluationStatus).toBe("COMPLETED");
    expect(result.submissionVersion).toBe(1);
    expect(result.reused).toBe(false);
  });

  it("persists the evaluation with its outcome and versions", async () => {
    const harness = createHarness();
    const attemptId = await submittedAttempt(harness);

    const result = await harness.evaluateAttempt.execute({ attemptId });
    const stored = await harness.evaluations.findById(result.evaluationId);

    expect(stored?.status).toBe("COMPLETED");
    expect(stored?.outcome?.criterionResults).toHaveLength(5);
    expect(stored?.versions.evaluatorVersion).toBe(harness.evaluator.version);
    expect(stored?.versions.rubricVersion).toBe(problem.rubric.version);
    expect(stored?.versions.promptVersion).toBe(NOT_APPLICABLE_VERSION);
    expect(stored?.versions.knowledgeVersion).toBe(NOT_APPLICABLE_VERSION);
    expect(stored?.attemptCount).toBe(1);
  });

  it("moves the attempt SUBMITTED -> EVALUATING -> COMPLETED", async () => {
    const harness = createHarness();
    const attemptId = await submittedAttempt(harness);

    expect((await harness.attempts.findById(attemptId))?.status).toBe(
      "SUBMITTED",
    );
    await harness.evaluateAttempt.execute({ attemptId });

    const attempt = await harness.attempts.findById(attemptId);
    expect(attempt?.status).toBe("COMPLETED");
    expect(attempt?.completedAt).not.toBeNull();
  });

  it("gives the evaluator the problem and the stored submission", async () => {
    const evaluator = new RecordingEvaluator();
    const harness = createHarness(parkingLotProblem(), evaluator);
    const attemptId = await submittedAttempt(harness);

    await harness.evaluateAttempt.execute({ attemptId });

    expect(evaluator.seen).toHaveLength(1);
    const context = evaluator.seen[0]!;
    expect(context.problem.id).toBe(PARKING_LOT_PROBLEM_ID);
    expect(context.problem.requirements).toHaveLength(
      problem.requirements.length,
    );
    expect(context.submission.version).toBe(1);
    expect(context.submission.payload).toEqual(designForProblem(problem));
  });

  it("gives the evaluator a frozen submission it cannot edit", async () => {
    const evaluator = new RecordingEvaluator();
    const harness = createHarness(parkingLotProblem(), evaluator);
    await harness.evaluateAttempt.execute({
      attemptId: await submittedAttempt(harness),
    });

    expect(Object.isFrozen(evaluator.seen[0]?.submission.payload)).toBe(true);
  });

  it("refuses to evaluate an attempt that is still in progress", async () => {
    const harness = createHarness();
    const { attemptId } = await harness.startAttempt.execute({
      problemId: PARKING_LOT_PROBLEM_ID,
      learnerId: LEARNER_ID,
    });

    await expect(
      harness.evaluateAttempt.execute({ attemptId }),
    ).rejects.toThrow(InvalidAttemptStateError);
  });

  it("refuses to evaluate an attempt that already completed", async () => {
    const harness = createHarness();
    const attemptId = await submittedAttempt(harness);
    await harness.evaluateAttempt.execute({ attemptId });

    // A completed attempt is terminal; a new attempt is how a learner iterates.
    const attempt = await harness.attempts.findById(attemptId);
    expect(attempt?.status).toBe("COMPLETED");
  });

  it("fails for an unknown attempt", async () => {
    const harness = createHarness();

    await expect(
      harness.evaluateAttempt.execute({ attemptId: "att_missing" }),
    ).rejects.toThrow(AttemptNotFoundError);
  });

  it("fails when the attempt has no stored submission", async () => {
    const harness = createHarness();
    const { attemptId } = await harness.startAttempt.execute({
      problemId: PARKING_LOT_PROBLEM_ID,
      learnerId: LEARNER_ID,
    });
    const attempt = await harness.attempts.findById(attemptId);
    attempt!.markSubmitted("sub_phantom", harness.clock.now());
    await harness.attempts.update(attempt!);

    await expect(
      harness.evaluateAttempt.execute({ attemptId }),
    ).rejects.toThrow(SubmissionNotFoundError);
  });

  describe("when the evaluator throws", () => {
    it("surfaces a typed application error", async () => {
      const harness = createHarness(parkingLotProblem(), new ThrowingEvaluator());
      const attemptId = await submittedAttempt(harness);

      await expect(
        harness.evaluateAttempt.execute({ attemptId }),
      ).rejects.toThrow(EvaluationExecutionError);
    });

    it("keeps the original failure as the cause", async () => {
      const harness = createHarness(parkingLotProblem(), new ThrowingEvaluator());
      const attemptId = await submittedAttempt(harness);

      const error = await harness.evaluateAttempt
        .execute({ attemptId })
        .catch((caught: unknown) => caught);

      expect((error as EvaluationExecutionError).cause).toBeInstanceOf(Error);
      expect(((error as EvaluationExecutionError).cause as Error).message).toBe(
        "evaluator exploded",
      );
    });

    it("preserves the submission untouched", async () => {
      const harness = createHarness(parkingLotProblem(), new ThrowingEvaluator());
      const attemptId = await submittedAttempt(harness);
      const before = await harness.submissions.findLatestByAttemptId(attemptId);

      await harness.evaluateAttempt
        .execute({ attemptId })
        .catch(() => undefined);

      const after = await harness.submissions.findLatestByAttemptId(attemptId);
      expect(after?.toSnapshot()).toEqual(before?.toSnapshot());
      expect(await harness.submissions.countByAttemptId(attemptId)).toBe(1);
    });

    it("records a FAILED evaluation rather than a false completed one", async () => {
      const harness = createHarness(parkingLotProblem(), new ThrowingEvaluator());
      const attemptId = await submittedAttempt(harness);

      await harness.evaluateAttempt
        .execute({ attemptId })
        .catch(() => undefined);

      const submission = await harness.submissions.findLatestByAttemptId(
        attemptId,
      );
      const evaluation = await harness.evaluations.findLatestBySubmissionId(
        submission!.id,
      );
      expect(evaluation?.status).toBe("FAILED");
      expect(evaluation?.outcome).toBeNull();
      expect(evaluation?.failure?.code).toBe("EVALUATOR_FAILED");
      expect(evaluation?.failure?.message).toBe("evaluator exploded");
    });

    it("leaves the attempt FAILED so it can be retried", async () => {
      const harness = createHarness(parkingLotProblem(), new ThrowingEvaluator());
      const attemptId = await submittedAttempt(harness);

      await harness.evaluateAttempt
        .execute({ attemptId })
        .catch(() => undefined);

      expect((await harness.attempts.findById(attemptId))?.status).toBe("FAILED");
    });

    it("can be retried through RetryEvaluation and then evaluated again", async () => {
      const harness = createHarness(parkingLotProblem(), new ThrowingEvaluator());
      const attemptId = await submittedAttempt(harness);
      await harness.evaluateAttempt
        .execute({ attemptId })
        .catch(() => undefined);

      const retry = await harness.retryEvaluation.execute({ attemptId });

      expect(retry.attemptStatus).toBe("EVALUATING");
      expect(retry.evaluationStatus).toBe("EVALUATING");
      // The same logical evaluation, so the idempotency key is unchanged.
      expect(retry.idempotencyKey).toBe(`${attemptId}:v1:throwing-v1`);
    });
  });

  describe("idempotency", () => {
    it("returns the stored evaluation instead of running a second time", async () => {
      const evaluator = new RecordingEvaluator();
      const harness = createHarness(parkingLotProblem(), evaluator);
      const attemptId = await submittedAttempt(harness);

      const first = await harness.evaluateAttempt.execute({ attemptId });
      // The attempt is COMPLETED now, so reaching the guard requires the caller to
      // ask again for the same attempt, which a dispatcher retry would do.
      const attempt = await harness.attempts.findById(attemptId);
      expect(attempt?.status).toBe("COMPLETED");
      expect(first.reused).toBe(false);
      expect(evaluator.seen).toHaveLength(1);
    });

    it("keys the evaluation on attempt, submission version and evaluator", async () => {
      const harness = createHarness();
      const attemptId = await submittedAttempt(harness);

      const result = await harness.evaluateAttempt.execute({ attemptId });

      expect(result.idempotencyKey).toBe(
        `${attemptId}:v1:${harness.evaluator.version}`,
      );
      expect(
        (await harness.evaluations.findByIdempotencyKey(result.idempotencyKey))
          ?.id,
      ).toBe(result.evaluationId);
    });

    it("reuses a completed evaluation when the same run is requested again", async () => {
      const evaluator = new RecordingEvaluator();
      const harness = createHarness(parkingLotProblem(), evaluator);
      const attemptId = await submittedAttempt(harness);
      const first = await harness.evaluateAttempt.execute({ attemptId });

      // Put the attempt back into an evaluable state, as a duplicate dispatch
      // would, and ask again for the same submission version.
      const attempt = await harness.attempts.findById(attemptId);
      const restored = attempt!.toSnapshot();
      await harness.attempts.update(
        Attempt.restore({ ...restored, status: "EVALUATING" }),
      );

      const second = await harness.evaluateAttempt.execute({ attemptId });

      expect(second.reused).toBe(true);
      expect(second.evaluationId).toBe(first.evaluationId);
      expect(evaluator.seen).toHaveLength(1);
    });

    it("writes exactly one evaluation row for one submission version", async () => {
      const harness = createHarness();
      const attemptId = await submittedAttempt(harness);

      const result = await harness.evaluateAttempt.execute({ attemptId });
      const submission = await harness.submissions.findLatestByAttemptId(
        attemptId,
      );

      expect(
        (await harness.evaluations.findLatestBySubmissionId(submission!.id))?.id,
      ).toBe(result.evaluationId);
    });
  });
});
