import { afterAll, describe, expect, it } from "vitest";
import { Attempt } from "@/domain/attempt/attempt";
import { Evaluation } from "@/domain/evaluation/evaluation";
import { buildEvaluationIdempotencyKey } from "@/domain/evaluation/evaluation-versions";
import type { EvaluationOutcome } from "@/domain/evaluation/evaluation-outcome";
import { Submission } from "@/domain/submission/submission";
import { STRUCTURED_DESIGN } from "@/domain/submission/submission-format-type";
import { designForProblem } from "@/testing/fixtures";
import type { Problem } from "@/domain/problem/problem";
import { createIntegrationHarness, SEED_LEARNER_ID, seedAndLoadProblem } from "./harness";

const harness = createIntegrationHarness();

afterAll(async () => {
  await harness.prisma.$disconnect();
});

const NOW = new Date("2026-03-01T09:00:00.000Z");

const VERSIONS = {
  evaluatorVersion: "hybrid-v1",
  rubricVersion: "parking-lot-v1",
  promptVersion: "design-review-v1",
  knowledgeVersion: "lld-kb-v1",
};

async function storedAttempt(problem: Problem): Promise<Attempt> {
  const attempt = Attempt.start({
    id: "att_test_1",
    problemId: problem.id,
    learnerId: SEED_LEARNER_ID,
    attemptNumber: 1,
    now: NOW,
  });
  await harness.repositories.attempts.save(attempt);
  return attempt;
}

async function storedSubmission(
  problem: Problem,
  attempt: Attempt,
  version = 1,
): Promise<Submission> {
  const submission = Submission.create({
    id: `sub_test_${version}`,
    attemptId: attempt.id,
    version,
    formatType: STRUCTURED_DESIGN,
    payload: designForProblem(problem),
    createdAt: NOW,
  });
  await harness.repositories.submissions.save(submission);
  return submission;
}

function outcomeFor(entity: string): EvaluationOutcome {
  return {
    criterionResults: [
      {
        criterion: "RESPONSIBILITY",
        assessment: "NEEDS_IMPROVEMENT",
        evidence: [{ entity, field: "methods", value: "exit" }],
        concern: "Exit handling also computes the fee.",
        suggestion: "Consider whether pricing varies independently here.",
        confidence: 0.72,
      },
      {
        criterion: "EXTENSIBILITY",
        assessment: "STRONG",
        evidence: [{ entity: "PricingStrategy" }],
      },
    ],
    strengths: [
      "Pricing is expressed as a contract rather than a branch.",
      "Ticket records only what it owns.",
    ],
    priorityImprovements: [
      {
        id: "fbk_test_1",
        priority: "P1",
        criterion: "RESPONSIBILITY",
        what: "Fee calculation sits on the lot itself.",
        where: [{ entity, field: "methods", value: "exit" }],
        why: "The brief says tariffs change independently of allocation.",
        reconsider: "Could the lot delegate the amount owed?",
      },
    ],
    summary: "The core flow is covered; one responsibility boundary is worth review.",
    confidence: 0.7,
  };
}

describe("submission persistence", () => {
  it("stores a submission with its own immutable design", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attempt = await storedAttempt(problem);
    const submission = await storedSubmission(problem, attempt);

    const loaded = await harness.repositories.submissions.findById(submission.id);

    expect(loaded).toBeInstanceOf(Submission);
    expect(loaded?.version).toBe(1);
    expect(loaded?.formatType).toBe(STRUCTURED_DESIGN);
    expect(loaded?.payload).toEqual(designForProblem(problem));
    expect(Object.isFrozen(loaded?.payload)).toBe(true);
  });

  it("does not reuse the attempt's draft row for the submitted design", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attempt = await storedAttempt(problem);
    attempt.saveDraft(designForProblem(problem), NOW);
    await harness.repositories.attempts.update(attempt);

    await storedSubmission(problem, attempt);

    expect(await harness.prisma.design.count()).toBe(2);
  });

  it("orders, counts and finds the latest submission of an attempt", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attempt = await storedAttempt(problem);
    await storedSubmission(problem, attempt, 1);
    await storedSubmission(problem, attempt, 2);

    expect(
      (await harness.repositories.submissions.findByAttemptId(attempt.id)).map(
        (entry) => entry.version,
      ),
    ).toEqual([1, 2]);
    expect(
      (await harness.repositories.submissions.findLatestByAttemptId(attempt.id))
        ?.version,
    ).toBe(2);
    expect(
      await harness.repositories.submissions.countByAttemptId(attempt.id),
    ).toBe(2);
  });

  it("returns null and zero for an attempt with no submission", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attempt = await storedAttempt(problem);

    expect(
      await harness.repositories.submissions.findLatestByAttemptId(attempt.id),
    ).toBeNull();
    expect(
      await harness.repositories.submissions.countByAttemptId(attempt.id),
    ).toBe(0);
  });

  it("exposes only domain fields on the rebuilt submission", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attempt = await storedAttempt(problem);
    const submission = await storedSubmission(problem, attempt);

    const loaded = await harness.repositories.submissions.findById(submission.id);

    expect(Object.keys(loaded!.toSnapshot()).toSorted()).toEqual([
      "attemptId",
      "createdAt",
      "formatType",
      "id",
      "payload",
      "version",
    ]);
  });
});

async function requestedEvaluation(problem: Problem): Promise<Evaluation> {
  const attempt = await storedAttempt(problem);
  const submission = await storedSubmission(problem, attempt);
  const evaluation = Evaluation.request({
    id: "evl_test_1",
    submissionId: submission.id,
    versions: VERSIONS,
    idempotencyKey: buildEvaluationIdempotencyKey({
      attemptId: attempt.id,
      submissionVersion: submission.version,
      evaluatorVersion: VERSIONS.evaluatorVersion,
    }),
    now: NOW,
  });
  await harness.repositories.evaluations.save(evaluation);
  return evaluation;
}

describe("evaluation persistence", () => {
  it("stores a pending evaluation with its versions and idempotency key", async () => {
    const problem = await seedAndLoadProblem(harness);
    const evaluation = await requestedEvaluation(problem);

    const loaded = await harness.repositories.evaluations.findById(evaluation.id);

    expect(loaded).toBeInstanceOf(Evaluation);
    expect(loaded?.status).toBe("PENDING");
    expect(loaded?.versions).toEqual(VERSIONS);
    expect(loaded?.outcome).toBeNull();
    expect(loaded?.failure).toBeNull();
    expect(loaded?.idempotencyKey).toBe(evaluation.idempotencyKey);
  });

  it("finds an evaluation by its idempotency key and by submission", async () => {
    const problem = await seedAndLoadProblem(harness);
    const evaluation = await requestedEvaluation(problem);

    expect(
      (
        await harness.repositories.evaluations.findByIdempotencyKey(
          evaluation.idempotencyKey,
        )
      )?.id,
    ).toBe(evaluation.id);
    expect(
      (
        await harness.repositories.evaluations.findLatestBySubmissionId(
          evaluation.submissionId,
        )
      )?.id,
    ).toBe(evaluation.id);
  });

  it("stores a completed outcome with criterion results, evidence and feedback", async () => {
    const problem = await seedAndLoadProblem(harness);
    const evaluation = await requestedEvaluation(problem);
    const outcome = outcomeFor("ParkingLot");

    evaluation.start(NOW);
    evaluation.complete(outcome, NOW);
    await harness.repositories.evaluations.update(evaluation);

    const loaded = await harness.repositories.evaluations.findById(evaluation.id);

    expect(loaded?.status).toBe("COMPLETED");
    expect(loaded?.outcome).toEqual(outcome);
    expect(await harness.prisma.evaluationCriterionResult.count()).toBe(2);
    expect(await harness.prisma.evaluationCriterionEvidence.count()).toBe(2);
    expect(await harness.prisma.evaluationFeedbackItem.count()).toBe(1);
    expect(await harness.prisma.evaluationFeedbackEvidence.count()).toBe(1);
  });

  it("stores a failure without losing the submission it ran against", async () => {
    const problem = await seedAndLoadProblem(harness);
    const evaluation = await requestedEvaluation(problem);

    evaluation.start(NOW);
    evaluation.fail({ code: "LLM_TIMEOUT", message: "Provider timed out." }, NOW);
    await harness.repositories.evaluations.update(evaluation);

    const loaded = await harness.repositories.evaluations.findById(evaluation.id);

    expect(loaded?.status).toBe("FAILED");
    expect(loaded?.failure).toEqual({
      code: "LLM_TIMEOUT",
      message: "Provider timed out.",
    });
    expect(
      await harness.repositories.submissions.findById(evaluation.submissionId),
    ).not.toBeNull();
  });

  it("replaces the previous run's results when a retry completes", async () => {
    const problem = await seedAndLoadProblem(harness);
    const evaluation = await requestedEvaluation(problem);

    evaluation.start(NOW);
    evaluation.fail({ code: "LLM_TIMEOUT", message: "Provider timed out." }, NOW);
    await harness.repositories.evaluations.update(evaluation);

    const retried = await harness.repositories.evaluations.findById(evaluation.id);
    retried!.start(NOW);
    const secondOutcome = outcomeFor("Ticket");
    retried!.complete(secondOutcome, NOW);
    await harness.repositories.evaluations.update(retried!);

    const loaded = await harness.repositories.evaluations.findById(evaluation.id);

    expect(loaded?.outcome).toEqual(secondOutcome);
    expect(loaded?.attemptCount).toBe(2);
    expect(loaded?.failure).toBeNull();
    // Exactly one run's rows: the failed run left none, this one left two.
    expect(await harness.prisma.evaluationCriterionResult.count()).toBe(2);
    expect(await harness.prisma.evaluationFeedbackItem.count()).toBe(1);
  });

  it("clears the stored failure and counts the run when a retry starts", async () => {
    const problem = await seedAndLoadProblem(harness);
    const evaluation = await requestedEvaluation(problem);

    evaluation.start(NOW);
    evaluation.fail({ code: "LLM_TIMEOUT", message: "Provider timed out." }, NOW);
    await harness.repositories.evaluations.update(evaluation);

    const failed = await harness.repositories.evaluations.findById(evaluation.id);
    failed!.start(NOW);
    await harness.repositories.evaluations.update(failed!);

    const retried = await harness.repositories.evaluations.findById(evaluation.id);
    expect(retried?.status).toBe("EVALUATING");
    expect(retried?.failure).toBeNull();
    expect(retried?.attemptCount).toBe(2);
  });
});
