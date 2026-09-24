import { describe, expect, it } from "vitest";
import { emptyStructuredDesign } from "../design/structured-design";
import {
  InvalidAttemptError,
  InvalidAttemptStateError,
} from "../shared/errors";
import { Attempt } from "./attempt";

const NOW = new Date("2026-02-01T10:00:00.000Z");
const LATER = new Date("2026-02-01T11:00:00.000Z");

function startAttempt(): Attempt {
  return Attempt.start({
    id: "att_001",
    problemId: "prb_parking_lot",
    learnerId: "learner_seed",
    attemptNumber: 1,
    now: NOW,
  });
}

describe("Attempt", () => {
  it("starts IN_PROGRESS with no submission", () => {
    const attempt = startAttempt();

    expect(attempt.status).toBe("IN_PROGRESS");
    expect(attempt.currentSubmissionId).toBeNull();
    expect(attempt.submittedAt).toBeNull();
    expect(attempt.completedAt).toBeNull();
    expect(attempt.createdAt).toEqual(NOW);
  });

  it.each([
    ["id", { id: " " }],
    ["problemId", { problemId: "" }],
    ["learnerId", { learnerId: "   " }],
  ])("rejects a blank %s", (_field, override) => {
    expect(() =>
      Attempt.start({
        id: "att_001",
        problemId: "prb_parking_lot",
        learnerId: "learner_seed",
        attemptNumber: 1,
        now: NOW,
        ...override,
      }),
    ).toThrow(InvalidAttemptError);
  });

  it.each([0, -1, 1.5])("rejects attempt number %s", (attemptNumber) => {
    expect(() =>
      Attempt.start({
        id: "att_001",
        problemId: "prb_parking_lot",
        learnerId: "learner_seed",
        attemptNumber,
        now: NOW,
      }),
    ).toThrow(InvalidAttemptError);
  });

  it("stores a draft while IN_PROGRESS", () => {
    const attempt = startAttempt();
    const design = emptyStructuredDesign();

    attempt.saveDraft(design, LATER);

    expect(attempt.draftDesign).toBe(design);
    expect(attempt.updatedAt).toEqual(LATER);
    expect(attempt.status).toBe("IN_PROGRESS");
  });

  it("refuses a draft once submitted", () => {
    const attempt = startAttempt();
    attempt.markSubmitted("sub_001", LATER);

    expect(() => attempt.saveDraft(emptyStructuredDesign(), LATER)).toThrow(
      InvalidAttemptStateError,
    );
  });

  it("records the submission and timestamp on submit", () => {
    const attempt = startAttempt();

    attempt.markSubmitted("sub_001", LATER);

    expect(attempt.status).toBe("SUBMITTED");
    expect(attempt.currentSubmissionId).toBe("sub_001");
    expect(attempt.submittedAt).toEqual(LATER);
  });

  it("walks the full happy lifecycle", () => {
    const attempt = startAttempt();

    attempt.markSubmitted("sub_001", LATER);
    attempt.markEvaluating(LATER);
    attempt.markCompleted(LATER);

    expect(attempt.status).toBe("COMPLETED");
    expect(attempt.completedAt).toEqual(LATER);
  });

  it("can be retried after a failed evaluation", () => {
    const attempt = startAttempt();
    attempt.markSubmitted("sub_001", LATER);
    attempt.markEvaluating(LATER);
    attempt.markFailed(LATER);

    expect(attempt.status).toBe("FAILED");
    expect(attempt.currentSubmissionId).toBe("sub_001");

    attempt.markEvaluating(LATER);

    expect(attempt.status).toBe("EVALUATING");
  });

  it("keeps the submission reference when evaluation fails", () => {
    const attempt = startAttempt();
    attempt.markSubmitted("sub_001", LATER);
    attempt.markEvaluating(LATER);
    attempt.markFailed(LATER);

    expect(attempt.toSnapshot().currentSubmissionId).toBe("sub_001");
  });

  it("rejects completing an attempt that was never evaluated", () => {
    const attempt = startAttempt();

    expect(() => attempt.markCompleted(LATER)).toThrow(
      InvalidAttemptStateError,
    );
  });

  it("round-trips through a snapshot", () => {
    const attempt = startAttempt();
    attempt.markSubmitted("sub_001", LATER);

    const restored = Attempt.restore(attempt.toSnapshot());

    expect(restored.toSnapshot()).toEqual(attempt.toSnapshot());
  });

  it("does not expose mutable internal state through the snapshot", () => {
    const attempt = startAttempt();
    const snapshot = attempt.toSnapshot();

    (snapshot as { status: string }).status = "COMPLETED";

    expect(attempt.status).toBe("IN_PROGRESS");
  });
});
