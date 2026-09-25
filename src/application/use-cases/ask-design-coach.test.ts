import { describe, expect, it } from "vitest";
import {
  LEARNER_ID,
  PARKING_LOT_PROBLEM_ID,
  designForProblem,
  parkingLotProblem,
} from "@/testing/fixtures";
import { createHarness } from "@/testing/harness";
import type { Harness } from "@/testing/harness";
import { FakeDesignCoach, fakeCoachAnswer } from "@/testing/fake-coach";
import {
  AttemptNotFoundError,
  CoachExecutionError,
  CoachNotAvailableError,
  CoachQuestionInvalidError,
} from "../errors";

const problem = parkingLotProblem();

async function startedAttempt(
  harness: Harness,
  learnerId: string = LEARNER_ID,
): Promise<string> {
  const { attemptId } = await harness.startAttempt.execute({
    problemId: PARKING_LOT_PROBLEM_ID,
    learnerId,
  });
  return attemptId;
}

describe("AskDesignCoach", () => {
  it("fails with a clear, distinct error when no coach is configured", async () => {
    const harness = createHarness(problem); // no coach passed — mirrors no model key
    const attemptId = await startedAttempt(harness);

    await expect(
      harness.askDesignCoach.execute({
        attemptId,
        learnerId: LEARNER_ID,
        question: "Why is this coupled?",
      }),
    ).rejects.toThrow(CoachNotAvailableError);
  });

  it("rejects an empty question", async () => {
    const coach = FakeDesignCoach.answering(fakeCoachAnswer());
    const harness = createHarness(problem, undefined, coach);
    const attemptId = await startedAttempt(harness);

    await expect(
      harness.askDesignCoach.execute({ attemptId, learnerId: LEARNER_ID, question: "  " }),
    ).rejects.toThrow(CoachQuestionInvalidError);
    expect(coach.contexts).toEqual([]);
  });

  it("rejects an oversized question without ever asking the coach", async () => {
    const coach = FakeDesignCoach.answering(fakeCoachAnswer());
    const harness = createHarness(problem, undefined, coach);
    const attemptId = await startedAttempt(harness);

    await expect(
      harness.askDesignCoach.execute({
        attemptId,
        learnerId: LEARNER_ID,
        question: "x".repeat(5000),
      }),
    ).rejects.toThrow(CoachQuestionInvalidError);
    expect(coach.contexts).toEqual([]);
  });

  it("fails with not-found rather than exposing a nonexistent attempt", async () => {
    const coach = FakeDesignCoach.answering(fakeCoachAnswer());
    const harness = createHarness(problem, undefined, coach);

    await expect(
      harness.askDesignCoach.execute({
        attemptId: "att_missing",
        learnerId: LEARNER_ID,
        question: "Why is this coupled?",
      }),
    ).rejects.toThrow(AttemptNotFoundError);
  });

  it("rejects another learner's attempt without disclosing that it exists", async () => {
    const coach = FakeDesignCoach.answering(fakeCoachAnswer());
    const harness = createHarness(problem, undefined, coach);
    const theirs = await startedAttempt(harness, "learner_other");

    await expect(
      harness.askDesignCoach.execute({
        attemptId: theirs,
        learnerId: LEARNER_ID,
        question: "Why is this coupled?",
      }),
    ).rejects.toThrow(AttemptNotFoundError);
    expect(coach.contexts).toEqual([]);
  });

  it("answers from the draft when the attempt has not been submitted yet", async () => {
    const coach = FakeDesignCoach.answering(fakeCoachAnswer());
    const harness = createHarness(problem, undefined, coach);
    const attemptId = await startedAttempt(harness);
    const design = designForProblem(problem);
    await harness.saveDraft.execute({ attemptId, design });

    const result = await harness.askDesignCoach.execute({
      attemptId,
      learnerId: LEARNER_ID,
      question: "What should I check next?",
    });

    expect(result.attemptId).toBe(attemptId);
    expect(coach.lastContext.isDesignSubmitted).toBe(false);
    expect(coach.lastContext.design.classes.length).toBeGreaterThan(0);
    expect(coach.lastContext.evaluation).toBeNull();
  });

  it("answers from the frozen submission once the attempt has been submitted", async () => {
    const coach = FakeDesignCoach.answering(fakeCoachAnswer());
    const harness = createHarness(problem, undefined, coach);
    const attemptId = await startedAttempt(harness);
    await harness.submitAttempt.execute({
      attemptId,
      design: designForProblem(problem),
    });

    await harness.askDesignCoach.execute({
      attemptId,
      learnerId: LEARNER_ID,
      question: "What should I check next?",
    });

    expect(coach.lastContext.isDesignSubmitted).toBe(true);
  });

  it("does not crash and still answers when nothing has been drafted or submitted", async () => {
    const coach = FakeDesignCoach.answering(fakeCoachAnswer());
    const harness = createHarness(problem, undefined, coach);
    const attemptId = await startedAttempt(harness);

    const result = await harness.askDesignCoach.execute({
      attemptId,
      learnerId: LEARNER_ID,
      question: "Where should I start?",
    });

    expect(result.answer).toBeDefined();
    expect(coach.lastContext.design.classes).toEqual([]);
  });

  it("passes the current evaluation's outcome only when it has completed", async () => {
    const coach = FakeDesignCoach.answering(fakeCoachAnswer());
    const harness = createHarness(problem, undefined, coach);
    const attemptId = await startedAttempt(harness);
    await harness.submitAttempt.execute({
      attemptId,
      design: designForProblem(problem),
    });
    await harness.evaluateAttempt.execute({ attemptId });

    await harness.askDesignCoach.execute({
      attemptId,
      learnerId: LEARNER_ID,
      question: "What did the evaluation say?",
    });

    expect(coach.lastContext.evaluation).not.toBeNull();
    expect(coach.lastContext.evaluation?.criterionResults.length).toBeGreaterThan(0);
  });

  it("summarizes the immediately preceding attempt, never the full earlier design", async () => {
    const coach = FakeDesignCoach.answering(fakeCoachAnswer());
    const harness = createHarness(problem, undefined, coach);

    const first = await startedAttempt(harness);
    await harness.submitAttempt.execute({ attemptId: first, design: designForProblem(problem) });
    await harness.evaluateAttempt.execute({ attemptId: first });

    const second = await startedAttempt(harness);

    await harness.askDesignCoach.execute({
      attemptId: second,
      learnerId: LEARNER_ID,
      question: "How does this compare to before?",
    });

    const previous = coach.lastContext.previousAttempt;
    expect(previous?.attemptNumber).toBe(1);
    expect(previous?.criterionAssessments.length).toBeGreaterThan(0);
    // Only a bounded summary crosses the boundary — never a `design` field.
    expect(previous).not.toHaveProperty("design");
  });

  it("reports no previous attempt for the very first attempt on a problem", async () => {
    const coach = FakeDesignCoach.answering(fakeCoachAnswer());
    const harness = createHarness(problem, undefined, coach);
    const attemptId = await startedAttempt(harness);

    await harness.askDesignCoach.execute({
      attemptId,
      learnerId: LEARNER_ID,
      question: "Anything to learn from before?",
    });

    expect(coach.lastContext.previousAttempt).toBeNull();
  });

  it("wraps a coach failure without leaking the underlying cause, and changes nothing about the attempt", async () => {
    const coach = FakeDesignCoach.failing(new Error("raw provider failure detail"));
    const harness = createHarness(problem, undefined, coach);
    const attemptId = await startedAttempt(harness);

    await expect(
      harness.askDesignCoach.execute({
        attemptId,
        learnerId: LEARNER_ID,
        question: "Why is this coupled?",
      }),
    ).rejects.toThrow(CoachExecutionError);

    const stored = await harness.attempts.findById(attemptId);
    expect(stored?.status).toBe("IN_PROGRESS");
  });

  it("returns the coach's grounded answer on a valid request", async () => {
    const answer = fakeCoachAnswer({ answer: "Here is a grounded explanation." });
    const coach = FakeDesignCoach.answering(answer);
    const harness = createHarness(problem, undefined, coach);
    const attemptId = await startedAttempt(harness);

    const result = await harness.askDesignCoach.execute({
      attemptId,
      learnerId: LEARNER_ID,
      question: "Why is this coupled?",
    });

    expect(result.answer.answer).toBe("Here is a grounded explanation.");
  });
});
