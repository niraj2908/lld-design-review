import { describe, expect, it } from "vitest";
import {
  LEARNER_ID,
  PARKING_LOT_PROBLEM_ID,
  parkingLotProblem,
  validParkingLotDesign,
} from "@/testing/fixtures";
import { createHarness } from "@/testing/harness";
import {
  InvalidAttemptStateError,
  InvalidDesignError,
  SubmissionValidationError,
} from "@/domain/shared/errors";
import type { StructuredDesign } from "@/domain/design/structured-design";
import { AttemptNotFoundError, UnsupportedSubmissionFormatError } from "../errors";

async function startedAttempt() {
  const harness = createHarness();
  const { attemptId } = await harness.startAttempt.execute({
    problemId: PARKING_LOT_PROBLEM_ID,
    learnerId: LEARNER_ID,
  });
  return { harness, attemptId };
}

describe("SubmitAttempt", () => {
  it("persists an immutable submission and moves the attempt to SUBMITTED", async () => {
    const { harness, attemptId } = await startedAttempt();

    const result = await harness.submitAttempt.execute({
      attemptId,
      design: validParkingLotDesign(),
    });

    expect(result.status).toBe("SUBMITTED");
    expect(result.submissionVersion).toBe(1);

    const submission = await harness.submissions.findById(result.submissionId);
    expect(submission?.attemptId).toBe(attemptId);
    expect(Object.isFrozen(submission?.payload)).toBe(true);
  });

  it("links the submission to the attempt", async () => {
    const { harness, attemptId } = await startedAttempt();

    const result = await harness.submitAttempt.execute({
      attemptId,
      design: validParkingLotDesign(),
    });

    const attempt = await harness.attempts.findById(attemptId);
    expect(attempt?.currentSubmissionId).toBe(result.submissionId);
    expect(attempt?.submittedAt).not.toBeNull();
  });

  it("submits the stored draft when no design is supplied", async () => {
    const { harness, attemptId } = await startedAttempt();
    await harness.saveDraft.execute({
      attemptId,
      design: validParkingLotDesign(),
    });

    const result = await harness.submitAttempt.execute({ attemptId });

    expect(result.status).toBe("SUBMITTED");
  });

  it("refuses to submit when there is neither a design nor a draft", async () => {
    const { harness, attemptId } = await startedAttempt();

    await expect(harness.submitAttempt.execute({ attemptId })).rejects.toThrow(
      SubmissionValidationError,
    );
  });

  it("rejects a design with blocking validation issues", async () => {
    const { harness, attemptId } = await startedAttempt();
    const design = validParkingLotDesign();
    const broken: StructuredDesign = {
      ...design,
      relationships: [
        { source: "ParkingLot", target: "GarageDoor", type: "ASSOCIATION" },
      ],
    };

    await expect(
      harness.submitAttempt.execute({ attemptId, design: broken }),
    ).rejects.toThrow(InvalidDesignError);
  });

  it("stores nothing and leaves the attempt editable when validation fails", async () => {
    const { harness, attemptId } = await startedAttempt();

    await expect(
      harness.submitAttempt.execute({ attemptId, design: { classes: [] } }),
    ).rejects.toThrow(InvalidDesignError);

    expect(await harness.submissions.countByAttemptId(attemptId)).toBe(0);
    const attempt = await harness.attempts.findById(attemptId);
    expect(attempt?.status).toBe("IN_PROGRESS");
  });

  it("reports the blocking issues on the error", async () => {
    const { harness, attemptId } = await startedAttempt();

    const error = await harness.submitAttempt
      .execute({ attemptId, design: { classes: [] } })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(InvalidDesignError);
    expect((error as InvalidDesignError).issues[0]?.code).toBe("DESIGN_EMPTY");
  });

  it("refuses a second submission on the same attempt", async () => {
    const { harness, attemptId } = await startedAttempt();
    await harness.submitAttempt.execute({
      attemptId,
      design: validParkingLotDesign(),
    });

    await expect(
      harness.submitAttempt.execute({
        attemptId,
        design: validParkingLotDesign(),
      }),
    ).rejects.toThrow(InvalidAttemptStateError);
  });

  it("fails when the attempt does not exist", async () => {
    const harness = createHarness();

    await expect(
      harness.submitAttempt.execute({
        attemptId: "att_missing",
        design: validParkingLotDesign(),
      }),
    ).rejects.toThrow(AttemptNotFoundError);
  });

  it("refuses a submission format the problem does not accept", async () => {
    const { harness, attemptId } = await startedAttempt();

    await expect(
      harness.submitAttempt.execute({
        attemptId,
        design: validParkingLotDesign(),
        formatType: "DIAGRAM" as never,
      }),
    ).rejects.toThrow(UnsupportedSubmissionFormatError);
  });

  it("accepts a valid alternative design that uses no interfaces", async () => {
    const { harness, attemptId } = await startedAttempt();

    const result = await harness.submitAttempt.execute({
      attemptId,
      design: {
        classes: [
          {
            name: "ParkingLotService",
            responsibility: "Handles parking, exit and fees in one place.",
            methods: [{ name: "park" }, { name: "exit" }],
          },
        ],
      },
    });

    expect(result.status).toBe("SUBMITTED");
  });

  it("does not depend on a reference design for the problem", async () => {
    const harness = createHarness(parkingLotProblem());

    expect("referenceDesign" in harness.problem).toBe(false);
  });
});
