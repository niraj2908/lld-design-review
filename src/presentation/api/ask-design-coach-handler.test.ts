import { describe, expect, it } from "vitest";
import { designForProblem, parkingLotProblem } from "@/testing/fixtures";
import {
  createApiHarness,
  jsonRequest,
  readBody,
} from "@/testing/api-harness";
import type { ApiHarness } from "@/testing/api-harness";
import { FakeDesignCoach, fakeCoachAnswer } from "@/testing/fake-coach";
import {
  handleAskDesignCoach,
  handleStartAttempt,
  handleSubmitAttempt,
} from "./handlers";
import type { CoachAnswerResponse } from "./coach-dto";

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

describe("handleAskDesignCoach", () => {
  it("returns 503 when no coach is configured, rather than a generic 500", async () => {
    const harness = createApiHarness({ problems: [problem] }); // no coach option
    const attemptId = await startedAttempt(harness);

    const response = await handleAskDesignCoach(
      harness.services,
      attemptId,
      jsonRequest({ question: "Why is this coupled?" }),
    );
    const body = await readBody<{ error: { code: string } }>(response);

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("COACH_NOT_CONFIGURED");
  });

  it("returns a 200 grounded answer for a valid request", async () => {
    const coach = FakeDesignCoach.answering(
      fakeCoachAnswer({ answer: "PaymentService couples allocation to payment." }),
    );
    const harness = createApiHarness({ problems: [problem], coach });
    const attemptId = await submittedAttempt(harness);

    const response = await handleAskDesignCoach(
      harness.services,
      attemptId,
      jsonRequest({ question: "Why is PaymentService coupled?" }),
    );
    const body = await readBody<CoachAnswerResponse>(response);

    expect(response.status).toBe(200);
    expect(body.answer).toBe("PaymentService couples allocation to payment.");
    expect(body.attemptId).toBe(attemptId);
  });

  it("answers 400 for an empty question", async () => {
    const coach = FakeDesignCoach.answering(fakeCoachAnswer());
    const harness = createApiHarness({ problems: [problem], coach });
    const attemptId = await startedAttempt(harness);

    const response = await handleAskDesignCoach(
      harness.services,
      attemptId,
      jsonRequest({ question: "" }),
    );
    const body = await readBody<{ error: { code: string } }>(response);

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  it("answers 400 for an oversized question", async () => {
    const coach = FakeDesignCoach.answering(fakeCoachAnswer());
    const harness = createApiHarness({ problems: [problem], coach });
    const attemptId = await startedAttempt(harness);

    const response = await handleAskDesignCoach(
      harness.services,
      attemptId,
      jsonRequest({ question: "x".repeat(5000) }),
    );

    expect(response.status).toBe(400);
  });

  it("answers 400 for a missing question field", async () => {
    const coach = FakeDesignCoach.answering(fakeCoachAnswer());
    const harness = createApiHarness({ problems: [problem], coach });
    const attemptId = await startedAttempt(harness);

    const response = await handleAskDesignCoach(
      harness.services,
      attemptId,
      jsonRequest({}),
    );

    expect(response.status).toBe(400);
  });

  it("answers 400 for a malformed attempt id", async () => {
    const coach = FakeDesignCoach.answering(fakeCoachAnswer());
    const harness = createApiHarness({ problems: [problem], coach });

    const response = await handleAskDesignCoach(
      harness.services,
      "../../etc/passwd",
      jsonRequest({ question: "Why is this coupled?" }),
    );

    expect(response.status).toBe(400);
  });

  it("answers 404 for a missing attempt", async () => {
    const coach = FakeDesignCoach.answering(fakeCoachAnswer());
    const harness = createApiHarness({ problems: [problem], coach });

    const response = await handleAskDesignCoach(
      harness.services,
      "att_missing",
      jsonRequest({ question: "Why is this coupled?" }),
    );
    const body = await readBody<{ error: { code: string } }>(response);

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("ATTEMPT_NOT_FOUND");
  });

  it("answers 404 for another learner's attempt, never 403", async () => {
    const coach = FakeDesignCoach.answering(fakeCoachAnswer());
    const harness = createApiHarness({
      problems: [problem],
      coach,
      learnerId: "learner_me",
    });
    const { attemptId: theirAttempt } = await harness.services.startAttempt.execute({
      problemId: problem.id,
      learnerId: "learner_them",
    });

    const response = await handleAskDesignCoach(
      harness.services,
      theirAttempt,
      jsonRequest({ question: "Why is this coupled?" }),
    );
    const body = await readBody<{ error: { code: string } }>(response);

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("ATTEMPT_NOT_FOUND");
  });

  it("answers 502 when the provider fails, without leaking the underlying cause", async () => {
    const coach = FakeDesignCoach.failing(new Error("secret internal detail"));
    const harness = createApiHarness({ problems: [problem], coach });
    const attemptId = await startedAttempt(harness);

    const response = await handleAskDesignCoach(
      harness.services,
      attemptId,
      jsonRequest({ question: "Why is this coupled?" }),
    );
    const text = await response.text();

    expect(response.status).toBe(502);
    expect(text).not.toContain("secret internal detail");
  });

  it("never returns a raw Prisma-shaped or internal error for a valid request", async () => {
    const coach = FakeDesignCoach.answering(fakeCoachAnswer());
    const harness = createApiHarness({ problems: [problem], coach });
    const attemptId = await submittedAttempt(harness);

    const response = await handleAskDesignCoach(
      harness.services,
      attemptId,
      jsonRequest({ question: "Why is this coupled?" }),
    );
    const text = await response.text();

    expect(text).not.toMatch(/prisma/iu);
    expect(text).not.toContain("at ");
  });

  it("does not expose knowledge passage text, only citation titles", async () => {
    const coach = FakeDesignCoach.answering(
      fakeCoachAnswer({
        knowledgeCitations: [
          {
            ref: "K1",
            rank: 1,
            chunkId: "chk_1",
            documentId: "doc_1",
            title: "Dependency inversion",
            source: "knowledge base",
            topic: "SOLID",
            documentVersion: "v1",
            score: 0.9,
            embeddingModel: "fake",
          },
        ],
      }),
    );
    const harness = createApiHarness({ problems: [problem], coach });
    const attemptId = await startedAttempt(harness);

    const response = await handleAskDesignCoach(
      harness.services,
      attemptId,
      jsonRequest({ question: "Why is this coupled?" }),
    );
    const body = await readBody<CoachAnswerResponse>(response);

    expect(body.knowledgeCitations).toEqual([
      { ref: "K1", title: "Dependency inversion", source: "knowledge base", topic: "SOLID" },
    ]);
  });

  it("answers 200 even when the attempt has never been evaluated", async () => {
    const coach = FakeDesignCoach.answering(
      fakeCoachAnswer({ answer: "I can answer from your design alone." }),
    );
    const harness = createApiHarness({ problems: [problem], coach });
    const attemptId = await startedAttempt(harness);

    const response = await handleAskDesignCoach(
      harness.services,
      attemptId,
      jsonRequest({ question: "What should I check next?" }),
    );

    expect(response.status).toBe(200);
    expect(coach.lastContext.evaluation).toBeNull();
  });
});
