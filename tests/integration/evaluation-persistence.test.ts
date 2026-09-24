import { afterAll, describe, expect, it } from "vitest";
import { Attempt } from "@/domain/attempt/attempt";
import { natureOf } from "@/domain/evaluation/review-criterion";
import { NOT_APPLICABLE_VERSION } from "@/domain/evaluation/evaluation-versions";
import {
  RULE_EVALUATOR_VERSION,
  RuleBasedEvaluator,
} from "@/evaluation-engine/rule-based-evaluator";
import { EvaluateAttempt } from "@/application/use-cases/evaluate-attempt";
import { designForProblem } from "@/testing/fixtures";
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

describe("deterministic evaluation against PostgreSQL", () => {
  it("evaluates a stored submission and persists the whole outcome", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attemptId = await submittedAttempt(problem);

    const result = await harness.useCases.evaluateAttempt.execute({ attemptId });

    expect(result.evaluationStatus).toBe("COMPLETED");
    expect(result.attemptStatus).toBe("COMPLETED");

    const stored = await harness.repositories.evaluations.findById(
      result.evaluationId,
    );
    expect(stored?.outcome?.criterionResults).toHaveLength(5);
    expect(stored?.versions.evaluatorVersion).toBe(RULE_EVALUATOR_VERSION);
    expect(stored?.versions.promptVersion).toBe(NOT_APPLICABLE_VERSION);
    expect(await harness.prisma.evaluationCriterionResult.count()).toBe(5);
  });

  it("stores the deterministic criteria the widened enum now accepts", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attemptId = await submittedAttempt(problem);

    await harness.useCases.evaluateAttempt.execute({ attemptId });

    const rows = await harness.prisma.evaluationCriterionResult.findMany({
      orderBy: { position: "asc" },
      select: { criterion: true, confidence: true },
    });

    expect(rows.map((row) => row.criterion)).toEqual([
      "STRUCTURAL_VALIDITY",
      "REQUIREMENT_COVERAGE",
      "DESIGN_COMPLETENESS",
      "EDGE_CASE_COVERAGE",
      "DESIGN_DECISIONS",
    ]);
    for (const row of rows) {
      expect(natureOf(row.criterion)).toBe("FACTUAL");
      expect(row.confidence).toBeNull();
    }
  });

  it("round-trips a rebuilt outcome equal to what the evaluator produced", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attemptId = await submittedAttempt(problem);
    const submission = await harness.repositories.submissions.findLatestByAttemptId(
      attemptId,
    );
    const expected = await harness.useCases.evaluateAttempt.execute({ attemptId });

    const direct = await new RuleBasedEvaluator().evaluate({
      problem,
      submission: submission!,
    });
    const stored = await harness.repositories.evaluations.findById(
      expected.evaluationId,
    );

    expect(stored?.outcome).toEqual(direct);
  });

  it("persists feedback codes for findings so a benchmark can count them", async () => {
    const problem = await seedAndLoadProblem(harness);
    const started = await harness.useCases.startAttempt.execute({
      problemId: problem.id,
      learnerId: SEED_LEARNER_ID,
    });
    // A design that maps nothing: every requirement becomes a finding.
    await harness.useCases.submitAttempt.execute({
      attemptId: started.attemptId,
      design: {
        classes: [
          {
            name: "Lot",
            responsibility: "Handles everything about parking.",
            methods: [{ name: "park" }],
          },
        ],
      },
    });

    await harness.useCases.evaluateAttempt.execute({
      attemptId: started.attemptId,
    });

    const rows = await harness.prisma.evaluationFeedbackItem.findMany({
      select: { code: true, criterion: true, priority: true },
    });

    expect(rows.length).toBe(problem.requirements.length + 2);
    expect(rows.map((row) => row.code)).toContain("REQUIREMENT_NOT_COVERED");
    expect(rows.map((row) => row.code)).toContain("NO_EDGE_CASES_RECORDED");
    expect(rows.map((row) => row.code)).toContain(
      "NO_DESIGN_DECISIONS_RECORDED",
    );
    expect(rows.map((row) => row.criterion)).toContain("REQUIREMENT_COVERAGE");
  });

  it("returns the stored evaluation instead of writing a second one", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attemptId = await submittedAttempt(problem);
    const first = await harness.useCases.evaluateAttempt.execute({ attemptId });

    const attempt = await harness.repositories.attempts.findById(attemptId);
    await harness.repositories.attempts.update(
      Attempt.restore({ ...attempt!.toSnapshot(), status: "EVALUATING" }),
    );

    const second = await harness.useCases.evaluateAttempt.execute({ attemptId });

    expect(second.reused).toBe(true);
    expect(second.evaluationId).toBe(first.evaluationId);
    expect(await harness.prisma.evaluation.count()).toBe(1);
    expect(await harness.prisma.evaluationCriterionResult.count()).toBe(5);
  });

  it("keeps the submission when the evaluator fails, and records the failure", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attemptId = await submittedAttempt(problem);
    const failing = createIntegrationHarness();
    const useCase = new EvaluateAttempt({
      attempts: failing.repositories.attempts,
      problems: failing.repositories.problems,
      submissions: failing.repositories.submissions,
      evaluations: failing.repositories.evaluations,
      evaluator: {
        version: "exploding-v1",
        evaluate: () => Promise.reject(new Error("evaluator exploded")),
      },
      ids: { generate: (prefix) => `${prefix}_failing` },
      clock: { now: () => new Date("2026-03-01T09:00:00.000Z") },
    });

    await expect(useCase.execute({ attemptId })).rejects.toThrow(
      /can be retried/,
    );

    expect(await failing.prisma.submission.count()).toBe(1);
    const evaluation = await failing.prisma.evaluation.findFirst();
    expect(evaluation?.status).toBe("FAILED");
    expect(evaluation?.failureCode).toBe("EVALUATOR_FAILED");
    expect(evaluation?.summary).toBeNull();
    expect(await failing.prisma.evaluationCriterionResult.count()).toBe(0);

    const attempt = await failing.repositories.attempts.findById(attemptId);
    expect(attempt?.status).toBe("FAILED");
    await failing.prisma.$disconnect();
  });
});
