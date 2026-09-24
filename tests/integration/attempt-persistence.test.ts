import { afterAll, describe, expect, it } from "vitest";
import { Attempt } from "@/domain/attempt/attempt";
import { emptyStructuredDesign } from "@/domain/design/structured-design";
import { designForProblem } from "@/testing/fixtures";
import type { Problem } from "@/domain/problem/problem";
import { createIntegrationHarness, SEED_LEARNER_ID, seedAndLoadProblem } from "./harness";

const harness = createIntegrationHarness();

afterAll(async () => {
  await harness.prisma.$disconnect();
});

const NOW = new Date("2026-03-01T09:00:00.000Z");

function newAttempt(problem: Problem, attemptNumber = 1): Attempt {
  return Attempt.start({
    id: `att_test_${attemptNumber}`,
    problemId: problem.id,
    learnerId: SEED_LEARNER_ID,
    attemptNumber,
    now: NOW,
  });
}

describe("attempt persistence", () => {
  it("stores and reloads an attempt with its domain timestamps intact", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attempt = newAttempt(problem);

    await harness.repositories.attempts.save(attempt);
    const loaded = await harness.repositories.attempts.findById(attempt.id);

    expect(loaded).toBeInstanceOf(Attempt);
    expect(loaded?.status).toBe("IN_PROGRESS");
    expect(loaded?.attemptNumber).toBe(1);
    expect(loaded?.createdAt).toEqual(NOW);
    expect(loaded?.updatedAt).toEqual(NOW);
    expect(loaded?.draftDesign).toBeNull();
  });

  it("returns null for an unknown attempt", async () => {
    await seedAndLoadProblem(harness);

    expect(await harness.repositories.attempts.findById("att_missing")).toBeNull();
  });

  it("stores a draft design as normalized rows and rebuilds it exactly", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attempt = newAttempt(problem);
    const design = designForProblem(problem);

    await harness.repositories.attempts.save(attempt);
    attempt.saveDraft(design, NOW);
    await harness.repositories.attempts.update(attempt);

    const loaded = await harness.repositories.attempts.findById(attempt.id);

    expect(loaded?.draftDesign).toEqual(design);
    expect(await harness.prisma.designClass.count()).toBe(design.classes.length);
    expect(await harness.prisma.designInterface.count()).toBe(
      design.interfaces.length,
    );
    expect(await harness.prisma.designRelationship.count()).toBe(
      design.relationships.length,
    );
    expect(await harness.prisma.designDecision.count()).toBe(
      design.decisions.length,
    );
    expect(await harness.prisma.designEdgeCase.count()).toBe(
      design.edgeCases.length,
    );
    expect(await harness.prisma.designRequirementMapping.count()).toBe(
      design.requirementMappings.length,
    );
  });

  it("preserves the order of every design collection across a round trip", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attempt = newAttempt(problem);
    const design = designForProblem(problem);

    await harness.repositories.attempts.save(attempt);
    attempt.saveDraft(design, NOW);
    await harness.repositories.attempts.update(attempt);

    const loaded = await harness.repositories.attempts.findById(attempt.id);

    expect(loaded?.draftDesign?.classes.map((entry) => entry.name)).toEqual(
      design.classes.map((entry) => entry.name),
    );
    expect(
      loaded?.draftDesign?.relationships.map((entry) => entry.target),
    ).toEqual(design.relationships.map((entry) => entry.target));
  });

  it("replaces the previous draft instead of accumulating designs", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attempt = newAttempt(problem);
    await harness.repositories.attempts.save(attempt);

    attempt.saveDraft(designForProblem(problem), NOW);
    await harness.repositories.attempts.update(attempt);
    attempt.saveDraft(emptyStructuredDesign(), NOW);
    await harness.repositories.attempts.update(attempt);

    expect(await harness.prisma.design.count()).toBe(1);
    const loaded = await harness.repositories.attempts.findById(attempt.id);
    expect(loaded?.draftDesign).toEqual(emptyStructuredDesign());
  });

  it("keeps the stored draft when a lifecycle transition is persisted", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attempt = newAttempt(problem);
    const design = designForProblem(problem);
    await harness.repositories.attempts.save(attempt);
    attempt.saveDraft(design, NOW);
    await harness.repositories.attempts.update(attempt);

    attempt.markSubmitted("sub_test_1", NOW);
    await harness.repositories.attempts.update(attempt);

    const loaded = await harness.repositories.attempts.findById(attempt.id);
    expect(loaded?.status).toBe("SUBMITTED");
    expect(loaded?.draftDesign).toEqual(design);
    expect(await harness.prisma.design.count()).toBe(1);
  });

  it("persists the whole lifecycle including a failure and a retry", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attempt = newAttempt(problem);
    await harness.repositories.attempts.save(attempt);

    attempt.markSubmitted("sub_test_1", NOW);
    await harness.repositories.attempts.update(attempt);
    attempt.markEvaluating(NOW);
    await harness.repositories.attempts.update(attempt);
    attempt.markFailed(NOW);
    await harness.repositories.attempts.update(attempt);

    const failed = await harness.repositories.attempts.findById(attempt.id);
    expect(failed?.status).toBe("FAILED");
    expect(failed?.currentSubmissionId).toBe("sub_test_1");

    failed!.markEvaluating(NOW);
    await harness.repositories.attempts.update(failed!);

    const retried = await harness.repositories.attempts.findById(attempt.id);
    expect(retried?.status).toBe("EVALUATING");
  });

  it("lists and counts attempts per learner and problem", async () => {
    const problem = await seedAndLoadProblem(harness);
    const other = await harness.repositories.problems.findBySlug("vending-machine");

    await harness.repositories.attempts.save(newAttempt(problem, 1));
    await harness.repositories.attempts.save(newAttempt(problem, 2));
    await harness.repositories.attempts.save(
      Attempt.start({
        id: "att_test_other_problem",
        problemId: other!.id,
        learnerId: SEED_LEARNER_ID,
        attemptNumber: 1,
        now: NOW,
      }),
    );

    const attempts = await harness.repositories.attempts.findManyByLearnerAndProblem(
      SEED_LEARNER_ID,
      problem.id,
    );

    expect(attempts.map((entry) => entry.attemptNumber)).toEqual([1, 2]);
    expect(
      await harness.repositories.attempts.countByLearnerAndProblem(
        SEED_LEARNER_ID,
        problem.id,
      ),
    ).toBe(2);
  });

  it("exposes only domain fields, so no Prisma column leaks out", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attempt = newAttempt(problem);
    attempt.saveDraft(designForProblem(problem), NOW);
    await harness.repositories.attempts.save(attempt);

    const loaded = await harness.repositories.attempts.findById(attempt.id);

    expect(Object.keys(loaded!.toSnapshot()).toSorted()).toEqual([
      "attemptNumber",
      "completedAt",
      "createdAt",
      "currentSubmissionId",
      "draftDesign",
      "learnerId",
      "problemId",
      "status",
      "submittedAt",
      "updatedAt",
      "id",
    ].toSorted());
    expect(Object.keys(loaded!.draftDesign!.classes[0]!).toSorted()).toEqual([
      "attributes",
      "id",
      "methods",
      "name",
      "responsibility",
    ]);
  });
});
