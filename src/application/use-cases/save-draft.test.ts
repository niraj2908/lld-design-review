import { describe, expect, it } from "vitest";
import {
  LEARNER_ID,
  PARKING_LOT_PROBLEM_ID,
  validParkingLotDesign,
} from "@/testing/fixtures";
import { createHarness } from "@/testing/harness";
import { InvalidAttemptStateError } from "@/domain/shared/errors";
import { AttemptNotFoundError } from "../errors";

async function startedAttempt() {
  const harness = createHarness();
  const { attemptId } = await harness.startAttempt.execute({
    problemId: PARKING_LOT_PROBLEM_ID,
    learnerId: LEARNER_ID,
  });
  return { harness, attemptId };
}

describe("SaveDraft", () => {
  it("stores a normalized draft on the attempt", async () => {
    const { harness, attemptId } = await startedAttempt();

    const result = await harness.saveDraft.execute({
      attemptId,
      design: validParkingLotDesign(),
    });

    expect(result.issues).toEqual([]);
    const stored = await harness.attempts.findById(attemptId);
    expect(stored?.draftDesign?.classes).toHaveLength(3);
  });

  it("accepts an incomplete draft and reports the issues instead of rejecting", async () => {
    const { harness, attemptId } = await startedAttempt();

    const result = await harness.saveDraft.execute({
      attemptId,
      design: { classes: [{ name: "ParkingLot" }] },
    });

    expect(
      result.issues.map((issue) => issue.code),
    ).toContain("CLASS_RESPONSIBILITY_REQUIRED");
    const stored = await harness.attempts.findById(attemptId);
    expect(stored?.draftDesign?.classes).toHaveLength(1);
  });

  it("fails when the attempt does not exist", async () => {
    const harness = createHarness();

    await expect(
      harness.saveDraft.execute({
        attemptId: "att_missing",
        design: validParkingLotDesign(),
      }),
    ).rejects.toThrow(AttemptNotFoundError);
  });

  it("refuses to change a draft after submission", async () => {
    const { harness, attemptId } = await startedAttempt();
    await harness.submitAttempt.execute({
      attemptId,
      design: validParkingLotDesign(),
    });

    await expect(
      harness.saveDraft.execute({
        attemptId,
        design: validParkingLotDesign(),
      }),
    ).rejects.toThrow(InvalidAttemptStateError);
  });
});
