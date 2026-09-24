import { describe, expect, it } from "vitest";
import { designForProblem, parkingLotProblem } from "@/testing/fixtures";
import {
  createApiHarness,
  jsonRequest,
  rawRequest,
  readBody,
} from "@/testing/api-harness";
import type { ApiHarness } from "@/testing/api-harness";
import {
  handleEvaluateAttempt,
  handleGetAttempt,
  handleGetEvaluation,
  handleGetProblem,
  handleListAttempts,
  handleListProblems,
  handleRetryEvaluation,
  handleSaveDraft,
  handleStartAttempt,
  handleSubmitAttempt,
} from "./handlers";
import { toErrorResponse } from "./http-error";

const problem = parkingLotProblem();

async function startedAttempt(harness: ApiHarness): Promise<string> {
  const response = await handleStartAttempt(harness.services, problem.slug);
  const body = await readBody<{ attempt: { id: string } }>(response);
  return body.attempt.id;
}

async function submittedAttempt(harness: ApiHarness): Promise<string> {
  const attemptId = await startedAttempt(harness);
  await handleSubmitAttempt(
    harness.services,
    attemptId,
    jsonRequest({ design: designForProblem(problem) }),
  );
  return attemptId;
}

describe("problem endpoints", () => {
  it("lists the problems with their requirement counts", async () => {
    const harness = createApiHarness();

    const response = await handleListProblems(harness.services);
    const body = await readBody<{ problems: { title: string; requirementCount: number }[] }>(
      response,
    );

    expect(response.status).toBe(200);
    expect(body.problems).toHaveLength(1);
    expect(body.problems[0]?.title).toBe("Parking Lot");
    expect(body.problems[0]?.requirementCount).toBe(2);
  });

  it("returns a problem by slug and by id", async () => {
    const harness = createApiHarness();

    for (const ref of [problem.slug, problem.id]) {
      const response = await handleGetProblem(harness.services, ref);
      const body = await readBody<{ problem: { id: string; requirements: unknown[] } }>(
        response,
      );

      expect(response.status).toBe(200);
      expect(body.problem.id).toBe(problem.id);
      expect(body.problem.requirements).toHaveLength(2);
    }
  });

  it("does not publish the rubric, which is how the evaluator reads a design", async () => {
    const harness = createApiHarness();

    const response = await handleGetProblem(harness.services, problem.slug);
    const text = JSON.stringify(await response.json());

    expect(text).not.toContain("rubric");
    expect(text).not.toContain("weight");
    expect(text).not.toContain(problem.rubric.criteria[0]!.guidance);
  });

  it("answers 404 for a problem that does not exist", async () => {
    const harness = createApiHarness();

    const response = await handleGetProblem(harness.services, "prb_missing");
    const body = await readBody<{ error: { code: string } }>(response);

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("PROBLEM_NOT_FOUND");
  });

  it("answers 400 for a reference that is not an identifier", async () => {
    const harness = createApiHarness();

    const response = await handleGetProblem(harness.services, "not a valid ref!");

    expect(response.status).toBe(400);
  });
});

describe("attempt creation", () => {
  it("creates an attempt and returns it", async () => {
    const harness = createApiHarness();

    const response = await handleStartAttempt(harness.services, problem.slug);
    const body = await readBody<{ attempt: { status: string; attemptNumber: number } }>(
      response,
    );

    expect(response.status).toBe(201);
    expect(body.attempt.status).toBe("IN_PROGRESS");
    expect(body.attempt.attemptNumber).toBe(1);
  });

  it("numbers a second attempt without touching the first", async () => {
    const harness = createApiHarness();
    const first = await startedAttempt(harness);

    const response = await handleStartAttempt(harness.services, problem.slug);
    const body = await readBody<{ attempt: { id: string; attemptNumber: number } }>(
      response,
    );

    expect(body.attempt.attemptNumber).toBe(2);
    expect(body.attempt.id).not.toBe(first);
    expect(await harness.attempts.countByLearnerAndProblem(
      harness.services.learnerId,
      problem.id,
    )).toBe(2);
  });

  it("answers 404 when the problem does not exist", async () => {
    const harness = createApiHarness();

    const response = await handleStartAttempt(harness.services, "prb_nope");

    expect(response.status).toBe(404);
  });
});

describe("attempt reads", () => {
  it("returns the attempt with its problem and requirements", async () => {
    const harness = createApiHarness();
    const attemptId = await startedAttempt(harness);

    const response = await handleGetAttempt(harness.services, attemptId);
    const body = await readBody<{
      attempt: { id: string };
      problem: { requirements: unknown[] };
      design: unknown;
    }>(response);

    expect(response.status).toBe(200);
    expect(body.attempt.id).toBe(attemptId);
    expect(body.problem.requirements).toHaveLength(2);
    expect(body.design).toBeNull();
  });

  it("answers 404 for an attempt that belongs to someone else", async () => {
    const harness = createApiHarness();
    const attemptId = await startedAttempt(harness);
    const otherLearner = createApiHarness({ learnerId: "lrn_someone_else" });

    // Same repositories are not shared, so use the first harness's id against a
    // service configured for a different learner.
    const response = await handleGetAttempt(
      { ...harness.services, learnerId: "lrn_someone_else" },
      attemptId,
    );

    expect(response.status).toBe(404);
    expect(otherLearner.services.learnerId).toBe("lrn_someone_else");
  });

  it("lists attempts with problem titles and statuses", async () => {
    const harness = createApiHarness();
    await submittedAttempt(harness);
    await startedAttempt(harness);

    const response = await handleListAttempts(harness.services);
    const body = await readBody<{
      attempts: { problemTitle: string; status: string; submissionVersion: number | null }[];
    }>(response);

    expect(response.status).toBe(200);
    expect(body.attempts).toHaveLength(2);
    expect(body.attempts.every((entry) => entry.problemTitle === "Parking Lot")).toBe(
      true,
    );
    expect(body.attempts.map((entry) => entry.status).toSorted()).toEqual([
      "IN_PROGRESS",
      "SUBMITTED",
    ]);
  });

  it("returns an empty list when nothing has been started", async () => {
    const harness = createApiHarness();

    const body = await readBody<{ attempts: unknown[] }>(
      await handleListAttempts(harness.services),
    );

    expect(body.attempts).toEqual([]);
  });
});

describe("draft saving", () => {
  it("saves a draft and reports advisory issues", async () => {
    const harness = createApiHarness();
    const attemptId = await startedAttempt(harness);

    const response = await handleSaveDraft(
      harness.services,
      attemptId,
      jsonRequest({ design: designForProblem(problem) }, "PUT"),
    );
    const body = await readBody<{ design: { classes: unknown[] }; issues: unknown[] }>(
      response,
    );

    expect(response.status).toBe(200);
    expect(body.design.classes).toHaveLength(3);
    expect(body.issues).toEqual([]);
  });

  it("accepts an incomplete draft and says what would block a submission", async () => {
    const harness = createApiHarness();
    const attemptId = await startedAttempt(harness);

    const response = await handleSaveDraft(
      harness.services,
      attemptId,
      jsonRequest(
        { design: { classes: [{ name: "ParkingLot", responsibility: "" }] } },
        "PUT",
      ),
    );
    const body = await readBody<{ issues: { code: string }[] }>(response);

    expect(response.status).toBe(200);
    expect(body.issues.map((issue) => issue.code)).toContain(
      "CLASS_RESPONSIBILITY_REQUIRED",
    );
  });

  it("answers 400 for a body that is not the expected shape", async () => {
    const harness = createApiHarness();
    const attemptId = await startedAttempt(harness);

    const response = await handleSaveDraft(
      harness.services,
      attemptId,
      jsonRequest({ design: { classes: "not an array" } }, "PUT"),
    );
    const body = await readBody<{ error: { code: string; issues: unknown[] } }>(
      response,
    );

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_REQUEST");
    expect(body.error.issues.length).toBeGreaterThan(0);
  });

  it("answers 400 for a body that is not JSON", async () => {
    const harness = createApiHarness();
    const attemptId = await startedAttempt(harness);

    const response = await handleSaveDraft(
      harness.services,
      attemptId,
      rawRequest("{oops", "PUT"),
    );

    expect(response.status).toBe(400);
  });

  it("answers 409 once the attempt has been submitted", async () => {
    const harness = createApiHarness();
    const attemptId = await submittedAttempt(harness);

    const response = await handleSaveDraft(
      harness.services,
      attemptId,
      jsonRequest({ design: designForProblem(problem) }, "PUT"),
    );
    const body = await readBody<{ error: { code: string } }>(response);

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("ATTEMPT_INVALID_STATE");
  });

  it("answers 404 for an unknown attempt", async () => {
    const harness = createApiHarness();

    const response = await handleSaveDraft(
      harness.services,
      "att_missing",
      jsonRequest({ design: designForProblem(problem) }, "PUT"),
    );

    expect(response.status).toBe(404);
  });
});

describe("submission", () => {
  it("submits a design and moves the attempt on", async () => {
    const harness = createApiHarness();
    const attemptId = await startedAttempt(harness);

    const response = await handleSubmitAttempt(
      harness.services,
      attemptId,
      jsonRequest({ design: designForProblem(problem) }),
    );
    const body = await readBody<{
      submission: { version: number };
      attemptStatus: string;
    }>(response);

    expect(response.status).toBe(201);
    expect(body.submission.version).toBe(1);
    expect(body.attemptStatus).toBe("SUBMITTED");
  });

  it("submits the stored draft when no design is sent", async () => {
    const harness = createApiHarness();
    const attemptId = await startedAttempt(harness);
    await handleSaveDraft(
      harness.services,
      attemptId,
      jsonRequest({ design: designForProblem(problem) }, "PUT"),
    );

    const response = await handleSubmitAttempt(
      harness.services,
      attemptId,
      jsonRequest({}),
    );

    expect(response.status).toBe(201);
  });

  it("answers 422 for a design the domain refuses", async () => {
    const harness = createApiHarness();
    const attemptId = await startedAttempt(harness);

    const response = await handleSubmitAttempt(
      harness.services,
      attemptId,
      jsonRequest({
        design: {
          classes: [{ name: "ParkingLot", responsibility: "Owns levels." }],
          relationships: [
            { source: "ParkingLot", target: "Ghost", type: "ASSOCIATION" },
          ],
        },
      }),
    );
    const body = await readBody<{ error: { code: string; issues: { path: string }[] } }>(
      response,
    );

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("DESIGN_INVALID");
    expect(body.error.issues.length).toBeGreaterThan(0);
  });

  it("answers 409 on a second submission of the same attempt", async () => {
    const harness = createApiHarness();
    const attemptId = await submittedAttempt(harness);

    const response = await handleSubmitAttempt(
      harness.services,
      attemptId,
      jsonRequest({ design: designForProblem(problem) }),
    );

    expect(response.status).toBe(409);
    expect(await harness.submissions.countByAttemptId(attemptId)).toBe(1);
  });
});

describe("evaluation", () => {
  it("evaluates a submitted attempt and returns the outcome", async () => {
    const harness = createApiHarness();
    const attemptId = await submittedAttempt(harness);

    const response = await handleEvaluateAttempt(harness.services, attemptId);
    const body = await readBody<{
      status: string;
      reused: boolean;
      evaluation: { outcome: { criterionResults: unknown[] } };
    }>(response);

    expect(response.status).toBe(201);
    expect(body.status).toBe("COMPLETED");
    expect(body.reused).toBe(false);
    expect(body.evaluation.outcome.criterionResults).toHaveLength(5);
  });

  it("answers 409 when the attempt has not been submitted", async () => {
    const harness = createApiHarness();
    const attemptId = await startedAttempt(harness);

    const response = await handleEvaluateAttempt(harness.services, attemptId);

    expect(response.status).toBe(409);
  });

  it("returns the evaluation, with its structural and semantic results separated", async () => {
    const harness = createApiHarness();
    const attemptId = await submittedAttempt(harness);
    await handleEvaluateAttempt(harness.services, attemptId);

    const response = await handleGetEvaluation(harness.services, attemptId);
    const body = await readBody<{
      evaluation: {
        status: string;
        outcome: { criterionResults: { nature: string }[] };
      };
    }>(response);

    expect(response.status).toBe(200);
    expect(body.evaluation.status).toBe("COMPLETED");
    expect(
      body.evaluation.outcome.criterionResults.every(
        (result) => result.nature === "FACTUAL",
      ),
    ).toBe(true);
  });

  it("reports no evaluation before one has run", async () => {
    const harness = createApiHarness();
    const attemptId = await submittedAttempt(harness);

    const body = await readBody<{ evaluation: null; attemptStatus: string }>(
      await handleGetEvaluation(harness.services, attemptId),
    );

    expect(body.evaluation).toBeNull();
    expect(body.attemptStatus).toBe("SUBMITTED");
  });

  it("does not publish the prompt, the embeddings or a provider key", async () => {
    const harness = createApiHarness();
    const attemptId = await submittedAttempt(harness);
    await handleEvaluateAttempt(harness.services, attemptId);

    const text = JSON.stringify(
      await (await handleGetEvaluation(harness.services, attemptId)).json(),
    );

    expect(text).not.toMatch(/api[_-]?key/i);
    expect(text).not.toContain("embedding");
    expect(text).not.toContain("ROLE\n");
    expect(text).not.toContain("system");
  });

  it("answers 409 when there is nothing to retry", async () => {
    const harness = createApiHarness();
    const attemptId = await submittedAttempt(harness);

    const response = await handleRetryEvaluation(harness.services, attemptId);

    expect(response.status).toBe(409);
  });
});

/**
 * A production build may include the same error module in two chunks, so the class a
 * handler throws need not be the class a mapper imported. These are structurally
 * identical strangers: the mapper must still answer correctly, because it keys on the
 * error code rather than on identity.
 */
function stranger(code: string, message: string, extra: object = {}): Error {
  return Object.assign(new Error(message), { code, ...extra });
}

describe("error mapping survives bundling", () => {
  it.each([
    ["PROBLEM_NOT_FOUND", 404],
    ["ATTEMPT_NOT_FOUND", 404],
    ["SUBMISSION_NOT_FOUND", 404],
    ["EVALUATION_NOT_FOUND", 404],
    ["ATTEMPT_INVALID_STATE", 409],
    ["EVALUATION_INVALID_STATE", 409],
    ["DUPLICATE_ENTITY", 409],
    ["DESIGN_INVALID", 422],
    ["SUBMISSION_INVALID", 422],
    ["SUBMISSION_FORMAT_UNSUPPORTED", 422],
    ["EVALUATION_EXECUTION_FAILED", 502],
  ] as const)("maps %s to %i without instanceof", (code, status) => {
    const response = toErrorResponse(stranger(code, "something happened"));

    expect(response.status).toBe(status);
  });

  it("carries design issues through", async () => {
    const response = toErrorResponse(
      stranger("DESIGN_INVALID", "bad design", {
        issues: [
          {
            code: "DESIGN_EMPTY",
            path: "design",
            message: "A design must contain at least one class or interface.",
            severity: "ERROR",
          },
        ],
      }),
    );
    const body = (await response.json()) as {
      error: { message: string; issues: { path: string }[] };
    };

    expect(response.status).toBe(422);
    expect(body.error.message).toBe("The design cannot be submitted yet.");
    expect(body.error.issues[0]?.path).toBe("design");
  });

  it("maps a duck-typed Zod error to 400", async () => {
    const response = toErrorResponse(
      Object.assign(new Error("invalid"), {
        name: "ZodError",
        issues: [{ path: ["design", "classes"], message: "Expected array." }],
      }),
    );
    const body = (await response.json()) as {
      error: { code: string; issues: { path: string }[] };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_REQUEST");
    expect(body.error.issues[0]?.path).toBe("design.classes");
  });

  it.each([
    ["an unknown code", stranger("P2002", "unique constraint")],
    ["no code at all", new Error("boom")],
    ["a thrown string", "boom"],
    ["null", null],
  ])("answers 500 and says nothing revealing for %s", async (_label, error) => {
    const response = toErrorResponse(error);
    const body = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe(
      "Something went wrong while handling the request.",
    );
  });

  it("never leaks a driver message", async () => {
    const response = toErrorResponse(
      stranger("P2003", "Foreign key constraint failed on the field: `learnerId`"),
    );

    expect(await response.text()).not.toContain("learnerId");
  });
});
