import { describe, expect, it } from "vitest";
import { LEARNER_ID, PARKING_LOT_PROBLEM_ID } from "@/testing/fixtures";
import { createHarness } from "@/testing/harness";
import { ProblemNotFoundError } from "../errors";

describe("StartAttempt", () => {
  it("creates an IN_PROGRESS attempt for an existing problem", async () => {
    const harness = createHarness();

    const result = await harness.startAttempt.execute({
      problemId: PARKING_LOT_PROBLEM_ID,
      learnerId: LEARNER_ID,
    });

    expect(result.status).toBe("IN_PROGRESS");
    expect(result.attemptNumber).toBe(1);
    expect(result.problemId).toBe(PARKING_LOT_PROBLEM_ID);
  });

  it("persists the attempt", async () => {
    const harness = createHarness();

    const result = await harness.startAttempt.execute({
      problemId: PARKING_LOT_PROBLEM_ID,
      learnerId: LEARNER_ID,
    });

    const stored = await harness.attempts.findById(result.attemptId);

    expect(stored?.status).toBe("IN_PROGRESS");
    expect(stored?.learnerId).toBe(LEARNER_ID);
  });

  it("numbers each further attempt on the same problem", async () => {
    const harness = createHarness();

    const first = await harness.startAttempt.execute({
      problemId: PARKING_LOT_PROBLEM_ID,
      learnerId: LEARNER_ID,
    });
    const second = await harness.startAttempt.execute({
      problemId: PARKING_LOT_PROBLEM_ID,
      learnerId: LEARNER_ID,
    });

    expect([first.attemptNumber, second.attemptNumber]).toEqual([1, 2]);
  });

  it("numbers attempts per learner", async () => {
    const harness = createHarness();

    await harness.startAttempt.execute({
      problemId: PARKING_LOT_PROBLEM_ID,
      learnerId: "learner_other",
    });
    const result = await harness.startAttempt.execute({
      problemId: PARKING_LOT_PROBLEM_ID,
      learnerId: LEARNER_ID,
    });

    expect(result.attemptNumber).toBe(1);
  });

  it("fails when the problem does not exist", async () => {
    const harness = createHarness();

    await expect(
      harness.startAttempt.execute({
        problemId: "prb_missing",
        learnerId: LEARNER_ID,
      }),
    ).rejects.toThrow(ProblemNotFoundError);
  });

  it("stores nothing when the problem does not exist", async () => {
    const harness = createHarness();

    await expect(
      harness.startAttempt.execute({
        problemId: "prb_missing",
        learnerId: LEARNER_ID,
      }),
    ).rejects.toThrow(ProblemNotFoundError);

    expect(
      await harness.attempts.countByLearnerAndProblem(
        LEARNER_ID,
        "prb_missing",
      ),
    ).toBe(0);
  });
});
