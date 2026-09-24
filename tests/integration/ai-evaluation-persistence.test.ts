import { afterAll, describe, expect, it } from "vitest";
import { EvaluateAttempt } from "@/application/use-cases/evaluate-attempt";
import { AIDesignEvaluator } from "@/evaluation-engine/ai/ai-design-evaluator";
import { HybridEvaluator } from "@/evaluation-engine/hybrid-evaluator";
import { RuleBasedEvaluator } from "@/evaluation-engine/rule-based-evaluator";
import { natureOf } from "@/domain/evaluation/review-criterion";
import { designForProblem } from "@/testing/fixtures";
import { FakeLLMProvider } from "@/testing/fake-llm-provider";
import type { Problem } from "@/domain/problem/problem";
import {
  createIntegrationHarness,
  SEED_LEARNER_ID,
  seedAndLoadProblem,
} from "./harness";

const harness = createIntegrationHarness();

afterAll(async () => {
  await harness.prisma.$disconnect();
});

/**
 * The real hybrid evaluator against real PostgreSQL, with only the provider
 * faked. No API key is involved.
 */
const review = {
  criteria: [
    {
      criterion: "RESPONSIBILITY",
      assessment: "NEEDS_IMPROVEMENT",
      evidence: [
        { entity: "ParkingLot", field: "methods", value: "exit" },
        { entity: "NotInTheDesign", field: "methods" },
      ],
      concern: "Exit settlement sits on the lot.",
      suggestion: "Consider delegating the amount owed.",
      confidence: 0.71,
    },
  ],
  strengths: ["The pricing contract is explicit."],
  priorityImprovements: [
    {
      criterion: "RESPONSIBILITY",
      priority: "P2",
      what: "Fee calculation sits on the lot.",
      where: [{ entity: "ParkingLot", field: "methods", value: "exit" }],
      why: "Tariffs change independently of allocation.",
      reconsider: "Could the lot delegate this?",
    },
  ],
  summary: "A sound decomposition with one boundary worth review.",
};

function useCaseWith(provider: FakeLLMProvider): EvaluateAttempt {
  return new EvaluateAttempt({
    attempts: harness.repositories.attempts,
    problems: harness.repositories.problems,
    submissions: harness.repositories.submissions,
    evaluations: harness.repositories.evaluations,
    evaluator: new HybridEvaluator(
      new RuleBasedEvaluator(),
      new AIDesignEvaluator(provider),
    ),
    ids: { generate: (prefix) => `${prefix}_ai_test` },
    clock: { now: () => new Date("2026-03-01T09:00:00.000Z") },
  });
}

async function submittedAttempt(problem: Problem): Promise<string> {
  const started = await harness.useCases.startAttempt.execute({
    problemId: problem.id,
    learnerId: SEED_LEARNER_ID,
  });
  await harness.useCases.submitAttempt.execute({
    attemptId: started.attemptId,
    design: designForProblem(problem),
  });
  return started.attemptId;
}

describe("hybrid evaluation against PostgreSQL", () => {
  it("persists deterministic and semantic criteria side by side", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attemptId = await submittedAttempt(problem);

    const result = await useCaseWith(
      FakeLLMProvider.answering(review, "some-model-id"),
    ).execute({ attemptId });

    expect(result.evaluationStatus).toBe("COMPLETED");

    const rows = await harness.prisma.evaluationCriterionResult.findMany({
      orderBy: { position: "asc" },
      select: { criterion: true, confidence: true, unverifiedEvidenceCount: true },
    });

    expect(rows).toHaveLength(6);
    expect(rows.filter((row) => natureOf(row.criterion) === "FACTUAL")).toHaveLength(5);
    expect(rows.filter((row) => natureOf(row.criterion) === "SEMANTIC")).toHaveLength(1);
  });

  it("records the provider and model, and no credential", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attemptId = await submittedAttempt(problem);

    await useCaseWith(
      FakeLLMProvider.answering(review, "some-model-id"),
    ).execute({ attemptId });

    const row = await harness.prisma.evaluation.findFirstOrThrow();

    expect(row.provider).toBe("fake");
    expect(row.model).toBe("some-model-id");
    expect(row.promptVersion).toBe("ai-review-v1");
    expect(row.evaluatorVersion).toBe("hybrid-v1");
    expect(JSON.stringify(row)).not.toMatch(/api[_-]?key/i);
  });

  it("stores confidence for the judgement and none for the facts", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attemptId = await submittedAttempt(problem);

    await useCaseWith(FakeLLMProvider.answering(review)).execute({ attemptId });

    const semantic = await harness.prisma.evaluationCriterionResult.findFirstOrThrow({
      where: { criterion: "RESPONSIBILITY" },
    });
    const factual = await harness.prisma.evaluationCriterionResult.findFirstOrThrow({
      where: { criterion: "STRUCTURAL_VALIDITY" },
    });

    expect(semantic.confidence).toBeCloseTo(0.71, 5);
    expect(factual.confidence).toBeNull();
  });

  it("records how much of the model's evidence could not be verified", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attemptId = await submittedAttempt(problem);

    await useCaseWith(FakeLLMProvider.answering(review)).execute({ attemptId });

    const semantic = await harness.prisma.evaluationCriterionResult.findFirstOrThrow({
      where: { criterion: "RESPONSIBILITY" },
      include: { evidence: true },
    });

    expect(semantic.unverifiedEvidenceCount).toBe(1);
    expect(semantic.evidence).toHaveLength(1);
    expect(semantic.evidence[0]?.entity).toBe("ParkingLot");
  });

  it("rebuilds the stored outcome with both kinds of finding intact", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attemptId = await submittedAttempt(problem);

    const result = await useCaseWith(
      FakeLLMProvider.answering(review),
    ).execute({ attemptId });
    const stored = await harness.repositories.evaluations.findById(
      result.evaluationId,
    );

    expect(stored?.outcome?.criterionResults).toHaveLength(6);
    const codes = stored!.outcome!.priorityImprovements.map((item) => item.code);
    expect(codes).toContain("AI_SEMANTIC_FINDING");
    expect(stored?.versions.model).toBeDefined();
  });

  it("keeps the submission and records the failure when the model call fails", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attemptId = await submittedAttempt(problem);

    await expect(
      useCaseWith(FakeLLMProvider.timingOut(1_000)).execute({ attemptId }),
    ).rejects.toThrow(/can be retried/);

    expect(await harness.prisma.submission.count()).toBe(1);
    const row = await harness.prisma.evaluation.findFirstOrThrow();
    expect(row.status).toBe("FAILED");
    expect(row.failureCode).toBe("EVALUATOR_FAILED");
    expect(row.summary).toBeNull();
    // No half-written review survives the failure.
    expect(await harness.prisma.evaluationCriterionResult.count()).toBe(0);
  });
});
