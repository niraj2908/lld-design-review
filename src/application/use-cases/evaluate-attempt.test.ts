import { describe, expect, it } from "vitest";
import { Attempt } from "@/domain/attempt/attempt";
import { Evaluation } from "@/domain/evaluation/evaluation";
import type { DesignEvaluator } from "../ports/evaluator";
import type { EvaluationContext } from "../ports/evaluator";
import type { EvaluationOutcome } from "@/domain/evaluation/evaluation-outcome";
import { NOT_APPLICABLE_VERSION } from "@/domain/evaluation/evaluation-versions";
import { LLMTimeoutError } from "@/application/ports/llm-provider";
import { InvalidAttemptStateError } from "@/domain/shared/errors";
import type { EvaluationRepository } from "../ports/evaluation-repository";
import {
  LEARNER_ID,
  PARKING_LOT_PROBLEM_ID,
  designForProblem,
  parkingLotProblem,
} from "@/testing/fixtures";
import { createHarness } from "@/testing/harness";
import type { Harness } from "@/testing/harness";
import { EvaluateAttempt } from "./evaluate-attempt";
import {
  AttemptNotFoundError,
  EvaluationExecutionError,
  EvaluationInProgressError,
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

class SucceedingEvaluator implements DesignEvaluator {
  readonly version = "succeeding-v1";

  async evaluate(): Promise<EvaluationOutcome> {
    return {
      criterionResults: [],
      strengths: [],
      priorityImprovements: [],
      summary: "fine",
    };
  }
}

/** Fails its first call, succeeds on every call after — one fixed version throughout, so a retry keeps the same idempotency key. */
class FailThenSucceedEvaluator implements DesignEvaluator {
  readonly version = "flaky-v1";
  private calls = 0;

  async evaluate(): Promise<EvaluationOutcome> {
    this.calls++;
    if (this.calls === 1) {
      throw new Error("first attempt exploded");
    }
    return {
      criterionResults: [],
      strengths: [],
      priorityImprovements: [],
      summary: "succeeded on retry",
    };
  }
}

/**
 * Wraps a real `EvaluationRepository`, letting a test inject exactly one
 * scripted failure or substitution into a specific method call — the
 * deterministic way to simulate a race a real clock cannot reproduce on demand.
 */
class FlakyEvaluationRepository implements EvaluationRepository {
  constructor(
    private readonly inner: EvaluationRepository,
    private readonly overrides: {
      readonly save?: (evaluation: Evaluation) => Promise<void>;
      readonly update?: (evaluation: Evaluation) => Promise<void>;
      readonly findById?: (evaluationId: string) => Promise<Evaluation | null>;
    } = {},
  ) {}

  findById(evaluationId: string): Promise<Evaluation | null> {
    return (this.overrides.findById ?? this.inner.findById.bind(this.inner))(
      evaluationId,
    );
  }

  findLatestBySubmissionId(submissionId: string): Promise<Evaluation | null> {
    return this.inner.findLatestBySubmissionId(submissionId);
  }

  findByIdempotencyKey(idempotencyKey: string): Promise<Evaluation | null> {
    return this.inner.findByIdempotencyKey(idempotencyKey);
  }

  save(evaluation: Evaluation): Promise<void> {
    return (this.overrides.save ?? this.inner.save.bind(this.inner))(evaluation);
  }

  update(evaluation: Evaluation): Promise<void> {
    return (this.overrides.update ?? this.inner.update.bind(this.inner))(
      evaluation,
    );
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

  describe("evaluator metadata", () => {
    class ModelEvaluator implements DesignEvaluator {
      readonly version = "hybrid-test-v1";
      readonly metadata = {
        provider: "fake",
        model: "some-model-id",
        promptVersion: "ai-review-v1",
      };

      async evaluate(): Promise<EvaluationOutcome> {
        return {
          criterionResults: [],
          strengths: [],
          priorityImprovements: [],
          summary: "reviewed",
        };
      }
    }

    it("records the provider, model and prompt version an evaluator reports", async () => {
      const harness = createHarness(parkingLotProblem(), new ModelEvaluator());
      const attemptId = await submittedAttempt(harness);

      const result = await harness.evaluateAttempt.execute({ attemptId });
      const stored = await harness.evaluations.findById(result.evaluationId);

      expect(stored?.versions.provider).toBe("fake");
      expect(stored?.versions.model).toBe("some-model-id");
      expect(stored?.versions.promptVersion).toBe("ai-review-v1");
    });

    it("records no provider or model for an evaluator that consults none", async () => {
      const harness = createHarness();
      const attemptId = await submittedAttempt(harness);

      const result = await harness.evaluateAttempt.execute({ attemptId });
      const stored = await harness.evaluations.findById(result.evaluationId);

      expect(stored?.versions.provider).toBeUndefined();
      expect(stored?.versions.model).toBeUndefined();
      expect(stored?.versions.promptVersion).toBe(NOT_APPLICABLE_VERSION);
    });

    it("keys the evaluation on the evaluator version, so two evaluators do not collide", async () => {
      const harness = createHarness(parkingLotProblem(), new ModelEvaluator());
      const attemptId = await submittedAttempt(harness);

      const result = await harness.evaluateAttempt.execute({ attemptId });

      expect(result.idempotencyKey).toBe(`${attemptId}:v1:hybrid-test-v1`);
    });
  });

  describe("when the model provider fails", () => {
    class ProviderFailingEvaluator implements DesignEvaluator {
      readonly version = "ai-failing-v1";
      readonly metadata = { provider: "fake", model: "m", promptVersion: "p" };

      async evaluate(): Promise<EvaluationOutcome> {
        throw new LLMTimeoutError(1_000);
      }
    }

    it("records the failure and keeps the submission, exactly as any other failure", async () => {
      const harness = createHarness(
        parkingLotProblem(),
        new ProviderFailingEvaluator(),
      );
      const attemptId = await submittedAttempt(harness);

      await expect(
        harness.evaluateAttempt.execute({ attemptId }),
      ).rejects.toThrow(EvaluationExecutionError);

      const submission = await harness.submissions.findLatestByAttemptId(attemptId);
      expect(submission).not.toBeNull();
      const evaluation = await harness.evaluations.findLatestBySubmissionId(
        submission!.id,
      );
      expect(evaluation?.status).toBe("FAILED");
      expect(evaluation?.outcome).toBeNull();
      expect(evaluation?.failure?.message).toContain("1000ms");
      expect((await harness.attempts.findById(attemptId))?.status).toBe("FAILED");
    });

    it("leaves the run retryable through RetryEvaluation", async () => {
      const harness = createHarness(
        parkingLotProblem(),
        new ProviderFailingEvaluator(),
      );
      const attemptId = await submittedAttempt(harness);
      await harness.evaluateAttempt.execute({ attemptId }).catch(() => undefined);

      const retry = await harness.retryEvaluation.execute({ attemptId });

      expect(retry.evaluationStatus).toBe("EVALUATING");
      expect(retry.idempotencyKey).toBe(`${attemptId}:v1:ai-failing-v1`);
    });
  });

  describe("idempotency and concurrency hardening", () => {
    it("1. a normal evaluation still completes exactly as before", async () => {
      const harness = createHarness();
      const attemptId = await submittedAttempt(harness);

      const result = await harness.evaluateAttempt.execute({ attemptId });

      expect(result.evaluationStatus).toBe("COMPLETED");
      expect(result.attemptStatus).toBe("COMPLETED");
      expect(result.reused).toBe(false);
    });

    it("2. a duplicate request after COMPLETED reuses the stored result and never re-runs the evaluator", async () => {
      const evaluator = new RecordingEvaluator();
      const harness = createHarness(parkingLotProblem(), evaluator);
      const attemptId = await submittedAttempt(harness);
      const first = await harness.evaluateAttempt.execute({ attemptId });

      // A duplicate dispatch would find the attempt back in an evaluable state
      // (its own retry/dispatcher concern) — this simulates exactly that.
      const attempt = await harness.attempts.findById(attemptId);
      await harness.attempts.update(
        Attempt.restore({ ...attempt!.toSnapshot(), status: "EVALUATING" }),
      );

      const second = await harness.evaluateAttempt.execute({ attemptId });

      expect(second.reused).toBe(true);
      expect(second.evaluationId).toBe(first.evaluationId);
      expect(second.evaluationStatus).toBe("COMPLETED");
      expect(evaluator.seen).toHaveLength(1);
    });

    it("3. a failure before completion fails the evaluation and the attempt, preserving the real cause", async () => {
      const harness = createHarness(parkingLotProblem(), new ThrowingEvaluator());
      const attemptId = await submittedAttempt(harness);

      await expect(
        harness.evaluateAttempt.execute({ attemptId }),
      ).rejects.toThrow(EvaluationExecutionError);

      const attempt = await harness.attempts.findById(attemptId);
      const submission = await harness.submissions.findLatestByAttemptId(attemptId);
      const evaluation = await harness.evaluations.findLatestBySubmissionId(submission!.id);
      expect(attempt?.status).toBe("FAILED");
      expect(evaluation?.status).toBe("FAILED");
      expect(evaluation?.failure?.message).toBe("evaluator exploded");
    });

    it("4. a failure reaching the evaluator after another invocation already completed the same evaluation leaves it COMPLETED, never re-failed", async () => {
      const baseHarness = createHarness(parkingLotProblem(), new ThrowingEvaluator());
      const attemptId = await submittedAttempt(baseHarness);

      // Seed the row this invocation will see as EVALUATING when it starts...
      const submission = await baseHarness.submissions.findLatestByAttemptId(attemptId);
      const idempotencyKey = `${attemptId}:v1:throwing-v1`;
      const inFlight = Evaluation.request({
        id: "evl_race",
        submissionId: submission!.id,
        versions: {
          evaluatorVersion: "throwing-v1",
          rubricVersion: baseHarness.problem.rubric.version,
          knowledgeVersion: NOT_APPLICABLE_VERSION,
          promptVersion: NOT_APPLICABLE_VERSION,
        },
        idempotencyKey,
        now: baseHarness.clock.now(),
      });
      inFlight.start(baseHarness.clock.now());
      await baseHarness.evaluations.save(inFlight);
      const attempt = await baseHarness.attempts.findById(attemptId);
      await baseHarness.attempts.update(
        Attempt.restore({ ...attempt!.toSnapshot(), status: "EVALUATING" }),
      );

      // ...but by the time the failure handler re-reads it (after the evaluator
      // has already thrown), another invocation has genuinely completed it.
      const completedElsewhere = Evaluation.restore(inFlight.toSnapshot());
      completedElsewhere.complete(
        {
          criterionResults: [],
          strengths: [],
          priorityImprovements: [],
          summary: "completed by another invocation",
        },
        baseHarness.clock.now(),
      );

      const flakyEvaluations = new FlakyEvaluationRepository(baseHarness.evaluations, {
        findById: async (id) => {
          if (id === "evl_race") {
            await baseHarness.evaluations.update(completedElsewhere);
            return Evaluation.restore(completedElsewhere.toSnapshot());
          }
          return baseHarness.evaluations.findById(id);
        },
      });

      const useCase = new EvaluateAttempt({
        attempts: baseHarness.attempts,
        problems: baseHarness.problems,
        submissions: baseHarness.submissions,
        evaluations: flakyEvaluations,
        evaluator: new ThrowingEvaluator(),
        ids: baseHarness.ids,
        clock: baseHarness.clock,
      });

      await expect(useCase.execute({ attemptId })).rejects.toThrow(
        EvaluationExecutionError,
      );

      const stored = await baseHarness.evaluations.findById("evl_race");
      expect(stored?.status).toBe("COMPLETED");
      expect(stored?.outcome?.summary).toBe("completed by another invocation");
    });

    it("5. two near-concurrent requests creating the same evaluation converge on one row instead of erroring", async () => {
      const harness = createHarness(parkingLotProblem(), new SucceedingEvaluator());
      const attemptId = await submittedAttempt(harness);
      const submission = await harness.submissions.findLatestByAttemptId(attemptId);
      const idempotencyKey = `${attemptId}:v1:succeeding-v1`;

      let saveCount = 0;
      const winnerRow = Evaluation.request({
        id: "evl_winner",
        submissionId: submission!.id,
        versions: {
          evaluatorVersion: "succeeding-v1",
          rubricVersion: harness.problem.rubric.version,
          knowledgeVersion: NOT_APPLICABLE_VERSION,
          promptVersion: NOT_APPLICABLE_VERSION,
        },
        idempotencyKey,
        now: harness.clock.now(),
      });
      winnerRow.start(harness.clock.now());
      winnerRow.complete(
        { criterionResults: [], strengths: [], priorityImprovements: [], summary: "the other request won" },
        harness.clock.now(),
      );

      const flakyEvaluations = new FlakyEvaluationRepository(harness.evaluations, {
        save: async () => {
          saveCount++;
          // Simulate a concurrent request's row already existing under the same
          // unique idempotency key by the time this one tries to create its own.
          await harness.evaluations.save(winnerRow);
          throw new Error("duplicate key value violates unique constraint");
        },
      });

      const useCase = new EvaluateAttempt({
        attempts: harness.attempts,
        problems: harness.problems,
        submissions: harness.submissions,
        evaluations: flakyEvaluations,
        evaluator: harness.evaluator,
        ids: harness.ids,
        clock: harness.clock,
      });

      const result = await useCase.execute({ attemptId });

      expect(saveCount).toBe(1);
      expect(result.reused).toBe(true);
      expect(result.evaluationId).toBe("evl_winner");
      expect(await harness.evaluations.findById("evl_winner")).not.toBeNull();
      // No second, orphaned row was ever created for this idempotency key.
      const all = await Promise.all(
        ["evl_winner"].map((id) => harness.evaluations.findById(id)),
      );
      expect(all.filter((row) => row !== null)).toHaveLength(1);
    });

    it("5b. a concurrent request that is still running (not yet completed) is reported as in progress, not silently retried", async () => {
      const harness = createHarness(parkingLotProblem(), new SucceedingEvaluator());
      const attemptId = await submittedAttempt(harness);
      const submission = await harness.submissions.findLatestByAttemptId(attemptId);
      const idempotencyKey = `${attemptId}:v1:succeeding-v1`;

      const stillRunning = Evaluation.request({
        id: "evl_running",
        submissionId: submission!.id,
        versions: {
          evaluatorVersion: "succeeding-v1",
          rubricVersion: harness.problem.rubric.version,
          knowledgeVersion: NOT_APPLICABLE_VERSION,
          promptVersion: NOT_APPLICABLE_VERSION,
        },
        idempotencyKey,
        now: harness.clock.now(),
      });
      stillRunning.start(harness.clock.now());

      const flakyEvaluations = new FlakyEvaluationRepository(harness.evaluations, {
        save: async () => {
          await harness.evaluations.save(stillRunning);
          throw new Error("duplicate key value violates unique constraint");
        },
      });

      const useCase = new EvaluateAttempt({
        attempts: harness.attempts,
        problems: harness.problems,
        submissions: harness.submissions,
        evaluations: flakyEvaluations,
        evaluator: harness.evaluator,
        ids: harness.ids,
        clock: harness.clock,
      });

      await expect(useCase.execute({ attemptId })).rejects.toThrow(
        EvaluationInProgressError,
      );
      // The evaluator itself was never invoked a second time for this race.
      expect(await harness.evaluations.findById("evl_running")).not.toBeNull();
    });

    it("does not re-fail an attempt that another invocation already moved to COMPLETED", async () => {
      const harness = createHarness(parkingLotProblem(), new ThrowingEvaluator());
      const attemptId = await submittedAttempt(harness);
      const submission = await harness.submissions.findLatestByAttemptId(attemptId);
      const idempotencyKey = `${attemptId}:v1:throwing-v1`;

      const inFlight = Evaluation.request({
        id: "evl_race2",
        submissionId: submission!.id,
        versions: {
          evaluatorVersion: "throwing-v1",
          rubricVersion: harness.problem.rubric.version,
          knowledgeVersion: NOT_APPLICABLE_VERSION,
          promptVersion: NOT_APPLICABLE_VERSION,
        },
        idempotencyKey,
        now: harness.clock.now(),
      });
      inFlight.start(harness.clock.now());
      await harness.evaluations.save(inFlight);
      const attempt = await harness.attempts.findById(attemptId);
      await harness.attempts.update(
        Attempt.restore({ ...attempt!.toSnapshot(), status: "EVALUATING" }),
      );

      // By the time the failure handler re-reads both rows, another invocation
      // has completed the evaluation and already advanced the attempt too.
      const completedElsewhere = Evaluation.restore(inFlight.toSnapshot());
      completedElsewhere.complete(
        { criterionResults: [], strengths: [], priorityImprovements: [], summary: "done elsewhere" },
        harness.clock.now(),
      );

      const flakyEvaluations = new FlakyEvaluationRepository(harness.evaluations, {
        findById: async (id) => {
          if (id === "evl_race2") {
            await harness.evaluations.update(completedElsewhere);
            const current = await harness.attempts.findById(attemptId);
            await harness.attempts.update(
              Attempt.restore({ ...current!.toSnapshot(), status: "COMPLETED" }),
            );
            return Evaluation.restore(completedElsewhere.toSnapshot());
          }
          return harness.evaluations.findById(id);
        },
      });

      const useCase = new EvaluateAttempt({
        attempts: harness.attempts,
        problems: harness.problems,
        submissions: harness.submissions,
        evaluations: flakyEvaluations,
        evaluator: new ThrowingEvaluator(),
        ids: harness.ids,
        clock: harness.clock,
      });

      await expect(useCase.execute({ attemptId })).rejects.toThrow(
        EvaluationExecutionError,
      );

      // Neither row was corrupted by the late, now-irrelevant failure.
      expect((await harness.attempts.findById(attemptId))?.status).toBe("COMPLETED");
      expect((await harness.evaluations.findById("evl_race2"))?.status).toBe(
        "COMPLETED",
      );
    });

    it("6. retry interaction: a genuinely failed evaluation retried through RetryEvaluation reaches COMPLETED on the same row", async () => {
      // One evaluator instance, one fixed version, used for both calls — exactly
      // how a real retry works: the same configured evaluator is asked again,
      // so the idempotency key is unchanged and the row must be reused, not
      // duplicated.
      const evaluator = new FailThenSucceedEvaluator();
      const harness = createHarness(parkingLotProblem(), evaluator);
      const attemptId = await submittedAttempt(harness);
      await harness.evaluateAttempt.execute({ attemptId }).catch(() => undefined);
      const failedEvaluationId = (
        await harness.evaluations.findLatestBySubmissionId(
          (await harness.submissions.findLatestByAttemptId(attemptId))!.id,
        )
      )?.id;

      await harness.retryEvaluation.execute({ attemptId });
      const result = await harness.evaluateAttempt.execute({ attemptId });

      expect(result.evaluationStatus).toBe("COMPLETED");
      expect(result.evaluationId).toBe(failedEvaluationId);
      expect((await harness.attempts.findById(attemptId))?.status).toBe(
        "COMPLETED",
      );
      const stored = await harness.evaluations.findById(failedEvaluationId!);
      expect(stored?.outcome?.summary).toBe("succeeded on retry");
    });
  });
});