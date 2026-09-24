import { describe, expect, it } from "vitest";
import { validParkingLotDesign } from "@/testing/fixtures";
import { emptyStructuredDesign } from "../design/structured-design";
import { SubmissionValidationError } from "../shared/errors";
import { Submission } from "./submission";
import { STRUCTURED_DESIGN } from "./submission-format-type";

const CREATED_AT = new Date("2026-02-01T10:00:00.000Z");

function createSubmission(
  overrides: Partial<Parameters<typeof Submission.create>[0]> = {},
): Submission {
  return Submission.create({
    id: "sub_001",
    attemptId: "att_001",
    version: 1,
    formatType: STRUCTURED_DESIGN,
    payload: validParkingLotDesign(),
    createdAt: CREATED_AT,
    ...overrides,
  });
}

describe("Submission", () => {
  it("accepts a valid submitted design", () => {
    const submission = createSubmission();

    expect(submission.id).toBe("sub_001");
    expect(submission.version).toBe(1);
    expect(submission.formatType).toBe(STRUCTURED_DESIGN);
    expect(submission.payload.classes).toHaveLength(3);
  });

  it("rejects an empty design", () => {
    expect(() => createSubmission({ payload: emptyStructuredDesign() })).toThrow(
      SubmissionValidationError,
    );
  });

  it.each([0, -3, 2.5])("rejects version %s", (version) => {
    expect(() => createSubmission({ version })).toThrow(
      SubmissionValidationError,
    );
  });

  it("rejects a submission with no attempt", () => {
    expect(() => createSubmission({ attemptId: " " })).toThrow(
      SubmissionValidationError,
    );
  });

  it("rejects a submission with no id", () => {
    expect(() => createSubmission({ id: "" })).toThrow(
      SubmissionValidationError,
    );
  });

  it("freezes the payload so a submitted design cannot be edited afterwards", () => {
    const submission = createSubmission();

    expect(Object.isFrozen(submission.payload)).toBe(true);
    expect(Object.isFrozen(submission.payload.classes)).toBe(true);
    expect(Object.isFrozen(submission.payload.classes[0])).toBe(true);
  });

  it("silently ignores a mutation attempt instead of changing the record", () => {
    const submission = createSubmission();

    expect(() => {
      (submission.payload.classes as { length: number }).length = 0;
    }).toThrow(TypeError);
    expect(submission.payload.classes).toHaveLength(3);
  });

  it("exposes no setter that could change the version", () => {
    const submission = createSubmission();
    const descriptor = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(submission) as object,
      "version",
    );

    expect(descriptor?.set).toBeUndefined();
  });

  it("round-trips through a snapshot", () => {
    const submission = createSubmission();

    const restored = Submission.restore(submission.toSnapshot());

    expect(restored.toSnapshot()).toEqual(submission.toSnapshot());
    expect(Object.isFrozen(restored.payload)).toBe(true);
  });
});
