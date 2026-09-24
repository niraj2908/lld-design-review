import { afterAll, describe, expect, it } from "vitest";
import { InvalidDesignError } from "@/domain/shared/errors";
import { designForProblem } from "@/testing/fixtures";
import { createIntegrationHarness, SEED_LEARNER_ID, seedAndLoadProblem } from "./harness";

const harness = createIntegrationHarness();

afterAll(async () => {
  await harness.prisma.$disconnect();
});

/**
 * The milestone-1 use cases running unchanged against Prisma. Nothing in
 * `src/application` knows a database exists; only the composition root does.
 */
describe("practice flow against PostgreSQL", () => {
  it("carries a learner from a seeded problem to a persisted submission", async () => {
    const problem = await seedAndLoadProblem(harness);
    const { useCases } = harness;

    const started = await useCases.startAttempt.execute({
      problemId: problem.id,
      learnerId: SEED_LEARNER_ID,
    });
    expect(started.status).toBe("IN_PROGRESS");
    expect(started.attemptNumber).toBe(1);

    const draft = await useCases.saveDraft.execute({
      attemptId: started.attemptId,
      design: designForProblem(problem),
    });
    expect(draft.issues).toEqual([]);

    const submitted = await useCases.submitAttempt.execute({
      attemptId: started.attemptId,
    });
    expect(submitted.status).toBe("SUBMITTED");
    expect(submitted.submissionVersion).toBe(1);

    const stored = await harness.repositories.submissions.findById(
      submitted.submissionId,
    );
    expect(stored?.payload).toEqual(designForProblem(problem));

    const attempt = await useCases.getAttempt.execute({
      attemptId: started.attemptId,
    });
    expect(attempt.attempt.status).toBe("SUBMITTED");
    expect(attempt.attempt.currentSubmissionId).toBe(submitted.submissionId);
    expect(attempt.latestSubmission?.version).toBe(1);
    expect(attempt.latestEvaluation).toBeNull();
    expect(attempt.problem.requirements).toHaveLength(
      problem.requirements.length,
    );
  });

  it("numbers a second attempt and keeps both in history", async () => {
    const problem = await seedAndLoadProblem(harness);
    const { useCases } = harness;

    const first = await useCases.startAttempt.execute({
      problemId: problem.id,
      learnerId: SEED_LEARNER_ID,
    });
    await useCases.submitAttempt.execute({
      attemptId: first.attemptId,
      design: designForProblem(problem),
    });

    const second = await useCases.startAttempt.execute({
      problemId: problem.id,
      learnerId: SEED_LEARNER_ID,
    });
    expect(second.attemptNumber).toBe(2);

    const history = await useCases.getAttemptHistory.execute({
      learnerId: SEED_LEARNER_ID,
      problemId: problem.id,
    });

    expect(history.entries.map((entry) => entry.attemptNumber)).toEqual([1, 2]);
    expect(history.entries[0]?.status).toBe("SUBMITTED");
    expect(history.entries[0]?.submissionVersion).toBe(1);
    expect(history.entries[1]?.status).toBe("IN_PROGRESS");
    expect(history.entries[1]?.submissionId).toBeNull();
  });

  it("writes nothing when the submitted design is invalid", async () => {
    const problem = await seedAndLoadProblem(harness);
    const { useCases } = harness;

    const started = await useCases.startAttempt.execute({
      problemId: problem.id,
      learnerId: SEED_LEARNER_ID,
    });

    await expect(
      useCases.submitAttempt.execute({
        attemptId: started.attemptId,
        design: { classes: [] },
      }),
    ).rejects.toThrow(InvalidDesignError);

    expect(await harness.prisma.submission.count()).toBe(0);
    const attempt = await harness.repositories.attempts.findById(
      started.attemptId,
    );
    expect(attempt?.status).toBe("IN_PROGRESS");
  });

  it("keeps a draft available after a failed submit, so no work is lost", async () => {
    const problem = await seedAndLoadProblem(harness);
    const { useCases } = harness;

    const started = await useCases.startAttempt.execute({
      problemId: problem.id,
      learnerId: SEED_LEARNER_ID,
    });
    await useCases.saveDraft.execute({
      attemptId: started.attemptId,
      design: designForProblem(problem),
    });

    await expect(
      useCases.submitAttempt.execute({
        attemptId: started.attemptId,
        design: { classes: [{ name: "OnlyAName" }] },
      }),
    ).rejects.toThrow(InvalidDesignError);

    const attempt = await harness.repositories.attempts.findById(
      started.attemptId,
    );
    expect(attempt?.draftDesign).toEqual(designForProblem(problem));
  });

  it("accepts a different valid design for the same problem", async () => {
    const problem = await seedAndLoadProblem(harness);
    const { useCases } = harness;

    const started = await useCases.startAttempt.execute({
      problemId: problem.id,
      learnerId: SEED_LEARNER_ID,
    });

    const submitted = await useCases.submitAttempt.execute({
      attemptId: started.attemptId,
      design: {
        classes: [
          {
            name: "ParkingLotService",
            responsibility:
              "Admits vehicles, tracks occupancy and settles payment in one place.",
            methods: [{ name: "admit" }, { name: "release" }],
          },
        ],
      },
    });

    const stored = await harness.repositories.submissions.findById(
      submitted.submissionId,
    );
    expect(stored?.payload.classes).toHaveLength(1);
    expect(stored?.payload.interfaces).toEqual([]);
  });
});
