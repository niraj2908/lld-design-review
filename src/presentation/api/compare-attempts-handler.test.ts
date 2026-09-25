import { describe, expect, it } from "vitest";
import { emptyStructuredDesign } from "@/domain/design/structured-design";
import { designForProblem, parkingLotProblem } from "@/testing/fixtures";
import {
  createApiHarness,
  jsonRequest,
  readBody,
} from "@/testing/api-harness";
import type { ApiHarness } from "@/testing/api-harness";
import {
  handleCompareAttempts,
  handleStartAttempt,
  handleSubmitAttempt,
} from "./handlers";
import type { AttemptComparisonResponse } from "./comparison-dto";

const problem = parkingLotProblem();

async function startedAttempt(
  harness: ApiHarness,
  problemRef: string = problem.slug,
): Promise<string> {
  const response = await handleStartAttempt(harness.services, problemRef);
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

describe("handleCompareAttempts", () => {
  it("returns a 200 comparison for two of the learner's own attempts on the same problem", async () => {
    const harness = createApiHarness({ problems: [problem] });
    const a = await submittedAttempt(harness);
    const b = await submittedAttempt(harness);

    const response = await handleCompareAttempts(harness.services, a, b);
    const body = await readBody<AttemptComparisonResponse>(response);

    expect(response.status).toBe(200);
    expect(body.problem.slug).toBe(problem.slug);
    expect(body.earlier.attemptId).toBe(a);
    expect(body.later.attemptId).toBe(b);
    expect(body.summary.totalStructuralChanges).toBe(0);
  });

  it("never returns a raw Prisma-shaped or internal error for a valid comparison", async () => {
    const harness = createApiHarness({ problems: [problem] });
    const a = await submittedAttempt(harness);
    const b = await submittedAttempt(harness);

    const response = await handleCompareAttempts(harness.services, a, b);
    const text = await response.text();

    expect(text).not.toMatch(/prisma/iu);
    expect(text).not.toContain("at ");
  });

  it("answers 400 for a malformed attempt id", async () => {
    const harness = createApiHarness({ problems: [problem] });
    const a = await submittedAttempt(harness);

    const response = await handleCompareAttempts(
      harness.services,
      a,
      "../../etc/passwd",
    );
    const body = await readBody<{ error: { code: string } }>(response);

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  it("answers 404 for a missing attempt", async () => {
    const harness = createApiHarness({ problems: [problem] });
    const a = await submittedAttempt(harness);

    const response = await handleCompareAttempts(
      harness.services,
      a,
      "att_missing",
    );
    const body = await readBody<{ error: { code: string } }>(response);

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("ATTEMPT_NOT_FOUND");
  });

  it("answers 409 for comparing an attempt with itself", async () => {
    const harness = createApiHarness({ problems: [problem] });
    const a = await submittedAttempt(harness);

    const response = await handleCompareAttempts(harness.services, a, a);
    const body = await readBody<{ error: { code: string } }>(response);

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("COMPARISON_INVALID");
  });

  it("answers 409 for comparing attempts on different problems", async () => {
    const otherProblem = parkingLotProblem({
      id: "prb_other",
      slug: "other-problem",
      requirements: problem.requirements.map((requirement) => ({
        ...requirement,
        problemId: "prb_other",
      })),
    });
    const harness = createApiHarness({ problems: [problem, otherProblem] });
    const a = await submittedAttempt(harness);
    const b = await startedAttempt(harness, otherProblem.slug);
    await handleSubmitAttempt(
      harness.services,
      b,
      jsonRequest({ design: designForProblem(otherProblem) }),
    );

    const response = await handleCompareAttempts(harness.services, a, b);
    const body = await readBody<{ error: { code: string } }>(response);

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("COMPARISON_INVALID");
  });

  it("answers 404 for another learner's attempt, never 403", async () => {
    // 403 would confirm the attempt exists; this API never discloses that. The
    // harness's single seeded learner is who the handler always acts as, so a
    // second learner's attempt is started directly through the use case, the way
    // a second real learner's row would exist in the same database.
    const harness = createApiHarness({ problems: [problem], learnerId: "learner_me" });
    const mine = await submittedAttempt(harness);
    const { attemptId: theirAttempt } = await harness.services.startAttempt.execute(
      { problemId: problem.id, learnerId: "learner_them" },
    );
    await harness.services.submitAttempt.execute({
      attemptId: theirAttempt,
      design: designForProblem(problem),
    });

    const response = await handleCompareAttempts(harness.services, mine, theirAttempt);
    const body = await readBody<{ error: { code: string } }>(response);

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("ATTEMPT_NOT_FOUND");
  });

  it("does not crash when an attempt has no submission, and says so in the response", async () => {
    const harness = createApiHarness({ problems: [problem] });
    const submitted = await submittedAttempt(harness);
    const draftOnly = await startedAttempt(harness);

    const response = await handleCompareAttempts(
      harness.services,
      submitted,
      draftOnly,
    );
    const body = await readBody<AttemptComparisonResponse>(response);

    expect(response.status).toBe(200);
    expect(body.later.hasSubmission).toBe(false);
  });

  it("produces a valid comparison for two attempts neither evaluated", async () => {
    const harness = createApiHarness({ problems: [problem] });
    const a = await submittedAttempt(harness);
    const b = await submittedAttempt(harness);

    const response = await handleCompareAttempts(harness.services, a, b);
    const body = await readBody<AttemptComparisonResponse>(response);

    expect(response.status).toBe(200);
    expect(body.criterionEvolutions).toEqual([]);
    expect(body.feedbackEvolution).toEqual([]);
  });

  it("never sends the evaluation's rubric or knowledge passage text", async () => {
    const harness = createApiHarness({ problems: [problem] });
    const a = await submittedAttempt(harness);
    const b = await submittedAttempt(harness);
    await handleCompareAttempts(harness.services, a, b);

    const response = await handleCompareAttempts(harness.services, a, b);
    const text = await response.text();

    expect(text).not.toContain("rubric");
  });

  it("reports the requirement coverage transitions using the current problem's own requirements only", async () => {
    const harness = createApiHarness({ problems: [problem] });
    const uncovered = await startedAttempt(harness);
    await handleSubmitAttempt(
      harness.services,
      uncovered,
      jsonRequest({
        design: {
          ...emptyStructuredDesign(),
          classes: [
            {
              id: "cls_1",
              name: "Placeholder",
              responsibility: "Not yet mapped.",
              attributes: [],
              methods: [],
            },
          ],
        },
      }),
    );
    const covered = await submittedAttempt(harness);

    const response = await handleCompareAttempts(
      harness.services,
      uncovered,
      covered,
    );
    const body = await readBody<AttemptComparisonResponse>(response);

    const validIds = new Set(problem.requirements.map((requirement) => requirement.id));
    for (const change of body.requirementCoverage) {
      expect(validIds.has(change.requirementId)).toBe(true);
    }
  });
});
