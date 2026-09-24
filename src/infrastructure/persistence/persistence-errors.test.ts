import { describe, expect, it } from "vitest";
import {
  ForeignKeyConstraintError,
  PersistenceMappingError,
  RecordNotFoundError,
  UniqueConstraintError,
  translatePersistenceError,
  withTranslatedCreateErrors,
  withTranslatedErrors,
} from "./persistence-errors";

function prismaError(code: string, meta?: Record<string, unknown>) {
  return Object.assign(new Error(`Prisma says ${code}`), { code, meta });
}

describe("persistence error translation", () => {
  it("turns a unique violation into a typed error naming the columns", () => {
    expect(() =>
      translatePersistenceError(
        prismaError("P2002", { target: ["learnerId", "problemId"] }),
        "attempt.save",
      ),
    ).toThrow(UniqueConstraintError);

    try {
      translatePersistenceError(
        prismaError("P2002", { target: ["learnerId", "problemId"] }),
        "attempt.save",
      );
    } catch (error) {
      expect((error as UniqueConstraintError).detail.target).toEqual([
        "learnerId",
        "problemId",
      ]);
      expect((error as UniqueConstraintError).message).toContain("learnerId");
    }
  });

  it("turns a foreign-key violation into a typed error", () => {
    expect(() =>
      translatePersistenceError(
        prismaError("P2003", { field_name: "attempts_learnerId_fkey" }),
        "attempt.save",
      ),
    ).toThrow(ForeignKeyConstraintError);
  });

  it("reads an unknown code shape as not-Prisma and rethrows it", () => {
    const original = Object.assign(new Error("boom"), { code: "PG_SOMETHING" });

    expect(() => translatePersistenceError(original, "x")).toThrow(original);
  });

  it("does not re-translate one of our own errors", () => {
    // PersistenceMappingError's code starts with "P", so it must be excluded by
    // type rather than by the shape of its code string.
    const mapping = new PersistenceMappingError("stored row is unusable");

    expect(() => translatePersistenceError(mapping, "attempt.findById")).toThrow(
      mapping,
    );
  });

  it("turns a missing record into a typed error naming the operation", () => {
    expect(() =>
      translatePersistenceError(prismaError("P2025"), "evaluation.update"),
    ).toThrow(RecordNotFoundError);
    expect(() =>
      translatePersistenceError(prismaError("P2025"), "evaluation.update"),
    ).toThrow(/evaluation.update/);
  });

  it("rethrows an unrecognised Prisma code untouched rather than mislabelling it", () => {
    const original = prismaError("P9999");

    expect(() => translatePersistenceError(original, "x")).toThrow(original);
  });

  it("rethrows a plain error untouched", () => {
    const original = new Error("socket closed");

    expect(() => translatePersistenceError(original, "x")).toThrow(original);
  });

  it("keeps the driver error as the cause, so nothing is lost", () => {
    const original = prismaError("P2002", { target: ["slug"] });

    try {
      translatePersistenceError(original, "problem.save");
    } catch (error) {
      expect((error as UniqueConstraintError).cause).toBe(original);
    }
  });

  it("passes a successful result straight through", async () => {
    expect(await withTranslatedErrors("x", async () => 42)).toBe(42);
  });

  it("translates an error thrown inside the wrapped call", async () => {
    await expect(
      withTranslatedErrors("attempt.save", async () => {
        throw prismaError("P2002", { target: ["id"] });
      }),
    ).rejects.toThrow(UniqueConstraintError);
  });

  it("reports an unknown target without inventing a column name", () => {
    try {
      translatePersistenceError(prismaError("P2002"), "x");
    } catch (error) {
      expect((error as UniqueConstraintError).detail.target).toEqual([
        "unknown field",
      ]);
    }
  });
});

describe("what a missing record means per operation", () => {
  /** Exactly what Prisma 7.10 reports for a nested connect that matched nothing. */
  const NESTED_CONNECT_META = {
    modelName: "Attempt",
    model: "Learner",
    relation: "AttemptToLearner",
    relationType: "one-to-many",
    operation: "a nested connect",
    neededFor: "inline the relation on 'Attempt' record(s)",
  };

  it("means the target is gone for an update or delete", () => {
    expect(() =>
      translatePersistenceError(
        prismaError("P2025", { modelName: "Attempt" }),
        "attempt.update",
        "MISSING_TARGET",
      ),
    ).toThrow(RecordNotFoundError);
  });

  it("defaults to the target being gone when no meaning is given", () => {
    expect(() =>
      translatePersistenceError(prismaError("P2025"), "evaluation.update"),
    ).toThrow(RecordNotFoundError);
  });

  it("means a broken reference for a create, whose nested connect found nothing", () => {
    expect(() =>
      translatePersistenceError(
        prismaError("P2025", NESTED_CONNECT_META),
        "attempt.save",
        "BROKEN_REFERENCE",
      ),
    ).toThrow(ForeignKeyConstraintError);
  });

  it("names the missing related model, not the model being written", () => {
    try {
      translatePersistenceError(
        prismaError("P2025", NESTED_CONNECT_META),
        "attempt.save",
        "BROKEN_REFERENCE",
      );
    } catch (error) {
      expect((error as ForeignKeyConstraintError).detail.field).toBe("Learner");
      expect((error as ForeignKeyConstraintError).message).toContain("Learner");
      expect((error as ForeignKeyConstraintError).message).not.toContain(
        "Attempt",
      );
    }
  });

  it("falls back to the relation name when no related model is reported", () => {
    try {
      translatePersistenceError(
        prismaError("P2025", { relation: "SubmissionToAttempt" }),
        "submission.save",
        "BROKEN_REFERENCE",
      );
    } catch (error) {
      expect((error as ForeignKeyConstraintError).detail.field).toBe(
        "SubmissionToAttempt",
      );
    }
  });

  it("falls back to the operation when the driver reports neither", () => {
    try {
      translatePersistenceError(
        prismaError("P2025"),
        "submission.save",
        "BROKEN_REFERENCE",
      );
    } catch (error) {
      expect((error as ForeignKeyConstraintError).detail.field).toBe(
        "submission.save",
      );
    }
  });

  it("keeps a real foreign-key violation a foreign-key error in a create", () => {
    expect(() =>
      translatePersistenceError(
        prismaError("P2003", { field_name: "attempts_learnerId_fkey" }),
        "attempt.save",
        "BROKEN_REFERENCE",
      ),
    ).toThrow(ForeignKeyConstraintError);
  });

  it("still reports a unique violation as such in a create", () => {
    expect(() =>
      translatePersistenceError(
        prismaError("P2002", { target: ["id"] }),
        "attempt.save",
        "BROKEN_REFERENCE",
      ),
    ).toThrow(UniqueConstraintError);
  });

  it("still rethrows an unrecognised code from a create", () => {
    const original = prismaError("P9999");

    expect(() =>
      translatePersistenceError(original, "attempt.save", "BROKEN_REFERENCE"),
    ).toThrow(original);
  });

  it("wraps a create so a missing connect surfaces as a foreign-key error", async () => {
    await expect(
      withTranslatedCreateErrors("attempt.save", async () => {
        throw prismaError("P2025", NESTED_CONNECT_META);
      }),
    ).rejects.toThrow(ForeignKeyConstraintError);
  });

  it("wraps an update so a missing target surfaces as a not-found error", async () => {
    await expect(
      withTranslatedErrors("evaluation.update", async () => {
        throw prismaError("P2025");
      }),
    ).rejects.toThrow(RecordNotFoundError);
  });

  it("passes a create's result through untouched", async () => {
    expect(await withTranslatedCreateErrors("x", async () => "ok")).toBe("ok");
  });

  it("does not re-translate a create error caught by an enclosing update wrapper", async () => {
    // attempt.update nests a design create; the inner wrapper has already decided
    // what the failure was, and the outer one must not relabel it.
    await expect(
      withTranslatedErrors("attempt.update", () =>
        withTranslatedCreateErrors("attempt.update:draftDesign", async () => {
          throw prismaError("P2025", { model: "Requirement" });
        }),
      ),
    ).rejects.toThrow(ForeignKeyConstraintError);
  });
});
