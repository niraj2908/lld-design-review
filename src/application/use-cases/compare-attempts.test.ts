import { describe, expect, it } from "vitest";
import { validateStructuredDesign } from "@/domain/design/design-validator";
import { emptyStructuredDesign } from "@/domain/design/structured-design";
import type { EvaluationContext, DesignEvaluator } from "../ports/evaluator";
import type { EvaluationOutcome } from "@/domain/evaluation/evaluation-outcome";
import {
  LEARNER_ID,
  PARKING_LOT_PROBLEM_ID,
  PARKING_LOT_REQUIREMENTS,
  designForProblem,
  parkingLotProblem,
} from "@/testing/fixtures";
import { createHarness } from "@/testing/harness";
import type { Harness } from "@/testing/harness";
import {
  InMemoryAttemptRepository,
  InMemoryEvaluationRepository,
  InMemoryProblemRepository,
  InMemorySubmissionRepository,
} from "@/testing/in-memory-repositories";
import { FixedClock } from "@/testing/fixed-clock";
import { SequentialIdGenerator } from "@/testing/sequential-id-generator";
import { StartAttempt } from "./start-attempt";
import { CompareAttempts } from "./compare-attempts";
import { AttemptNotFoundError, InvalidComparisonError } from "../errors";

const problem = parkingLotProblem();

async function startAttempt(
  harness: Harness,
  learnerId: string = LEARNER_ID,
): Promise<string> {
  const { attemptId } = await harness.startAttempt.execute({
    problemId: PARKING_LOT_PROBLEM_ID,
    learnerId,
  });
  return attemptId;
}

/** Evaluates whatever the caller already submitted, with the harness's own evaluator. */
async function evaluate(harness: Harness, attemptId: string): Promise<void> {
  await harness.evaluateAttempt.execute({ attemptId });
}

/** Returns a fixed outcome per attempt id, so a test can script exactly what each attempt was told. */
class ScriptedEvaluator implements DesignEvaluator {
  readonly version = "scripted-v1";
  private readonly byAttemptId = new Map<string, EvaluationOutcome>();

  script(attemptId: string, outcome: EvaluationOutcome): void {
    this.byAttemptId.set(attemptId, outcome);
  }

  async evaluate(context: EvaluationContext): Promise<EvaluationOutcome> {
    return (
      this.byAttemptId.get(context.submission.attemptId) ?? {
        criterionResults: [],
        strengths: [],
        priorityImprovements: [],
        summary: "no script for this attempt",
      }
    );
  }
}

describe("CompareAttempts", () => {
  it("rejects comparing an attempt with itself", async () => {
    const harness = createHarness(problem);
    const attemptId = await startAttempt(harness);

    await expect(
      harness.compareAttempts.execute({
        attemptAId: attemptId,
        attemptBId: attemptId,
        learnerId: LEARNER_ID,
      }),
    ).rejects.toThrow(InvalidComparisonError);
  });

  it("rejects comparing attempts on different problems", async () => {
    const otherProblem = parkingLotProblem({
      id: "prb_other",
      slug: "other-problem",
      requirements: PARKING_LOT_REQUIREMENTS.map((requirement) => ({
        ...requirement,
        problemId: "prb_other",
      })),
    });
    // A harness built directly, rather than through `createHarness`, because that
    // helper seeds exactly one problem and this is the one scenario that needs two.
    const problems = new InMemoryProblemRepository([problem, otherProblem]);
    const attempts = new InMemoryAttemptRepository();
    const submissions = new InMemorySubmissionRepository();
    const evaluations = new InMemoryEvaluationRepository();
    const clock = new FixedClock();
    const ids = new SequentialIdGenerator();
    const startAttemptUseCase = new StartAttempt({ problems, attempts, ids, clock });
    const compareAttempts = new CompareAttempts({
      attempts,
      problems,
      submissions,
      evaluations,
    });

    const { attemptId: onParkingLot } = await startAttemptUseCase.execute({
      problemId: problem.id,
      learnerId: LEARNER_ID,
    });
    const { attemptId: onOtherProblem } = await startAttemptUseCase.execute({
      problemId: otherProblem.id,
      learnerId: LEARNER_ID,
    });

    await expect(
      compareAttempts.execute({
        attemptAId: onParkingLot,
        attemptBId: onOtherProblem,
        learnerId: LEARNER_ID,
      }),
    ).rejects.toThrow(InvalidComparisonError);
  });

  it("rejects comparing another learner's attempt", async () => {
    const harness = createHarness(problem);
    const mine = await startAttempt(harness, LEARNER_ID);
    const someoneElses = await startAttempt(harness, "learner_other");

    await expect(
      harness.compareAttempts.execute({
        attemptAId: mine,
        attemptBId: someoneElses,
        learnerId: LEARNER_ID,
      }),
    ).rejects.toThrow(AttemptNotFoundError);
  });

  it("fails with not-found rather than exposing a nonexistent attempt", async () => {
    const harness = createHarness(problem);
    const mine = await startAttempt(harness);

    await expect(
      harness.compareAttempts.execute({
        attemptAId: mine,
        attemptBId: "att_missing",
        learnerId: LEARNER_ID,
      }),
    ).rejects.toThrow(AttemptNotFoundError);
  });

  it("orders attempts chronologically regardless of which id was passed first", async () => {
    const harness = createHarness(problem);
    const first = await startAttempt(harness);
    await harness.submitAttempt.execute({
      attemptId: first,
      design: designForProblem(problem),
    });
    const second = await startAttempt(harness);
    await harness.submitAttempt.execute({
      attemptId: second,
      design: designForProblem(problem),
    });

    const forwards = await harness.compareAttempts.execute({
      attemptAId: first,
      attemptBId: second,
      learnerId: LEARNER_ID,
    });
    const backwards = await harness.compareAttempts.execute({
      attemptAId: second,
      attemptBId: first,
      learnerId: LEARNER_ID,
    });

    expect(forwards.earlier.attemptId).toBe(first);
    expect(forwards.later.attemptId).toBe(second);
    expect(backwards.earlier.attemptId).toBe(first);
    expect(backwards.later.attemptId).toBe(second);
  });

  it("does not crash when an attempt has no submission yet, and reports it plainly", async () => {
    const harness = createHarness(problem);
    const submitted = await startAttempt(harness);
    await harness.submitAttempt.execute({
      attemptId: submitted,
      design: designForProblem(problem),
    });
    const draftOnly = await startAttempt(harness);

    const result = await harness.compareAttempts.execute({
      attemptAId: submitted,
      attemptBId: draftOnly,
      learnerId: LEARNER_ID,
    });

    expect(result.later.hasSubmission).toBe(false);
    // Nothing in the later, empty design; everything from the earlier design
    // reads as removed rather than throwing.
    expect(
      result.comparison.structure.classChanges.every(
        (change) => change.kind === "REMOVED",
      ),
    ).toBe(true);
  });

  it("produces a valid comparison for two empty designs without crashing", async () => {
    const harness = createHarness(problem);
    const a = await startAttempt(harness);
    const b = await startAttempt(harness);

    const result = await harness.compareAttempts.execute({
      attemptAId: a,
      attemptBId: b,
      learnerId: LEARNER_ID,
    });

    expect(result.comparison.summary.totalStructuralChanges).toBe(0);
  });

  it("treats a missing evaluation as no baseline, without failing the comparison", async () => {
    const harness = createHarness(problem);
    const a = await startAttempt(harness);
    await harness.submitAttempt.execute({ attemptId: a, design: designForProblem(problem) });
    const b = await startAttempt(harness);
    await harness.submitAttempt.execute({ attemptId: b, design: designForProblem(problem) });
    // Neither attempt has been evaluated.

    const result = await harness.compareAttempts.execute({
      attemptAId: a,
      attemptBId: b,
      learnerId: LEARNER_ID,
    });

    expect(result.earlier.hasCompletedEvaluation).toBe(false);
    expect(result.comparison.criterionEvolutions).toEqual([]);
    expect(result.comparison.feedbackResolutions).toEqual([]);
  });

  it("treats a failed evaluation the same as no evaluation, not as a completed baseline", async () => {
    const failingEvaluator: DesignEvaluator = {
      version: "failing-v1",
      async evaluate() {
        throw new Error("boom");
      },
    };
    const failingHarness = createHarness(problem, failingEvaluator);
    const failed = await startAttempt(failingHarness);
    await failingHarness.submitAttempt.execute({
      attemptId: failed,
      design: designForProblem(problem),
    });
    await expect(evaluate(failingHarness, failed)).rejects.toThrow();
    const other = await startAttempt(failingHarness);
    await failingHarness.submitAttempt.execute({
      attemptId: other,
      design: designForProblem(problem),
    });

    const result = await failingHarness.compareAttempts.execute({
      attemptAId: failed,
      attemptBId: other,
      learnerId: LEARNER_ID,
    });

    expect(result.earlier.evaluationStatus).toBe("FAILED");
    expect(result.earlier.hasCompletedEvaluation).toBe(false);
    expect(result.comparison.criterionEvolutions).toEqual([]);
  });

  it("compares completed evaluations criterion by criterion and resolves feedback", async () => {
    const evaluator = new ScriptedEvaluator();
    const harness = createHarness(problem, evaluator);

    const before = await startAttempt(harness);
    await harness.submitAttempt.execute({
      attemptId: before,
      design: {
        ...emptyStructuredDesign(),
        classes: [
          {
            id: "cls_1",
            name: "ParkingLot",
            responsibility: "Allocates spots and processes payment.",
            attributes: [],
            methods: [],
          },
        ],
      },
    });
    evaluator.script(before, {
      criterionResults: [
        { criterion: "RESPONSIBILITY", assessment: "NEEDS_IMPROVEMENT", evidence: [] },
      ],
      strengths: [],
      priorityImprovements: [
        {
          id: "fdb_1",
          priority: "P0",
          criterion: "RESPONSIBILITY",
          what: "ParkingLot has too many responsibilities.",
          where: [{ entity: "ParkingLot" }],
          why: "Allocation and payment change for different reasons.",
        },
      ],
      summary: "Responsibility concentrated in one class.",
    });
    await evaluate(harness, before);

    const after = await startAttempt(harness);
    await harness.submitAttempt.execute({
      attemptId: after,
      design: {
        ...emptyStructuredDesign(),
        classes: [
          {
            id: "cls_2",
            name: "SpotAllocator",
            responsibility: "Allocates spots.",
            attributes: [],
            methods: [],
          },
          {
            id: "cls_3",
            name: "PaymentService",
            responsibility: "Processes payment.",
            attributes: [],
            methods: [],
          },
        ],
      },
    });
    evaluator.script(after, {
      criterionResults: [
        { criterion: "RESPONSIBILITY", assessment: "ADEQUATE", evidence: [] },
      ],
      strengths: ["Responsibilities are separated."],
      priorityImprovements: [],
      summary: "Responsibility separated across two classes.",
    });
    await evaluate(harness, after);

    const result = await harness.compareAttempts.execute({
      attemptAId: before,
      attemptBId: after,
      learnerId: LEARNER_ID,
    });

    expect(result.comparison.criterionEvolutions).toEqual([
      expect.objectContaining({ criterion: "RESPONSIBILITY", trend: "IMPROVED" }),
    ]);
    expect(result.comparison.feedbackResolutions).toEqual([
      expect.objectContaining({ feedbackId: "fdb_1", status: "ADDRESSED" }),
    ]);
    expect(result.comparison.summary.feedbackAddressed).toBe(1);
    expect(result.comparison.summary.criteriaImproved).toBe(1);
    // The original finding travels alongside its resolution, at the same index.
    expect(result.earlierFeedback).toHaveLength(1);
    expect(result.earlierFeedback[0]?.id).toBe(
      result.comparison.feedbackResolutions[0]?.feedbackId,
    );
  });

  it("keeps requirement coverage honest against the current problem's own requirements", async () => {
    const harness = createHarness(problem);
    const a = await startAttempt(harness);
    await harness.submitAttempt.execute({
      attemptId: a,
      design: {
        ...emptyStructuredDesign(),
        classes: [
          {
            id: "cls_1",
            name: "Placeholder",
            responsibility: "Not yet mapped to any requirement.",
            attributes: [],
            methods: [],
          },
        ],
      },
    });
    const b = await startAttempt(harness);
    const covering = designForProblem(problem);
    await harness.submitAttempt.execute({ attemptId: b, design: covering });

    const result = await harness.compareAttempts.execute({
      attemptAId: a,
      attemptBId: b,
      learnerId: LEARNER_ID,
    });

    const coveredIds = result.comparison.requirementCoverage
      .filter((change) => change.transition === "UNCOVERED_TO_COVERED")
      .map((change) => change.requirementId);
    expect(coveredIds.length).toBeGreaterThan(0);
    for (const id of coveredIds) {
      expect(problem.hasRequirement(id)).toBe(true);
    }
    // Sanity: the covering design is actually valid against this problem.
    expect(
      validateStructuredDesign(covering, {
        requirementIds: problem.requirementIds,
      }).issues,
    ).toEqual([]);
  });
});
