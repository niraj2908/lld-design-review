import { describe, expect, it } from "vitest";
import {
  LLMRateLimitError,
  LLMResponseFormatError,
  LLMTimeoutError,
  LLMUnavailableError,
} from "@/application/ports/llm-provider";
import type { EvaluationContext } from "@/application/ports/evaluator";
import type { StructuredDesign } from "@/domain/design/structured-design";
import { natureOf } from "@/domain/evaluation/review-criterion";
import { isGrounded } from "@/domain/feedback/feedback-item";
import {
  designForProblem,
  parkingLotProblem,
  submissionOf,
} from "@/testing/fixtures";
import { FakeLLMProvider } from "@/testing/fake-llm-provider";
import { AI_EVALUATOR_VERSION, AIDesignEvaluator } from "./ai-design-evaluator";
import { AI_EVALUATOR_PROMPT_VERSION } from "./ai-prompt";
import { RuleBasedEvaluator } from "../rule-based-evaluator";

const problem = parkingLotProblem();

function contextFor(design: StructuredDesign = designForProblem(problem)): EvaluationContext {
  return { problem, submission: submissionOf(design) };
}

/** A well-formed answer whose evidence really is in the fixture design. */
function goodReview(overrides: Record<string, unknown> = {}) {
  return {
    criteria: [
      {
        criterion: "RESPONSIBILITY",
        assessment: "NEEDS_IMPROVEMENT",
        evidence: [
          {
            entity: "ParkingLot",
            field: "responsibility",
            value: "Owns levels and coordinates parking and exit flows.",
          },
        ],
        concern: "The lot coordinates both parking and exit.",
        suggestion: "Consider whether exit settlement is its own concern.",
        confidence: 0.72,
      },
      {
        criterion: "EXTENSIBILITY",
        assessment: "ADEQUATE",
        evidence: [{ entity: "PricingStrategy", field: "methods" }],
        confidence: 0.8,
      },
    ],
    strengths: ["Pricing is expressed as a contract rather than a branch."],
    priorityImprovements: [
      {
        criterion: "RESPONSIBILITY",
        priority: "P2",
        what: "Exit settlement sits on the lot.",
        where: [{ entity: "ParkingLot", field: "methods", value: "exit" }],
        why: "The brief says tariffs change independently of allocation.",
        reconsider: "Could the lot delegate the amount owed?",
      },
    ],
    summary: "The core flow is covered; one responsibility boundary is worth review.",
    ...overrides,
  };
}

describe("AIDesignEvaluator", () => {
  it("reports its version and provider metadata", () => {
    const evaluator = new AIDesignEvaluator(
      FakeLLMProvider.answering(goodReview(), "some-model-id"),
    );

    expect(evaluator.version).toBe(AI_EVALUATOR_VERSION);
    expect(evaluator.metadata).toEqual({
      provider: "fake",
      model: "some-model-id",
      promptVersion: AI_EVALUATOR_PROMPT_VERSION,
    });
  });

  it("turns a valid answer into semantic criterion results", async () => {
    const provider = FakeLLMProvider.answering(goodReview());

    const outcome = await new AIDesignEvaluator(provider).evaluate(contextFor());

    expect(outcome.criterionResults.map((entry) => entry.criterion)).toEqual([
      "RESPONSIBILITY",
      "EXTENSIBILITY",
    ]);
    for (const result of outcome.criterionResults) {
      expect(natureOf(result.criterion)).toBe("SEMANTIC");
    }
    expect(outcome.strengths).toHaveLength(1);
    expect(outcome.summary).toContain("responsibility boundary");
  });

  it("keeps the model's confidence, which a judgement is entitled to", async () => {
    const outcome = await new AIDesignEvaluator(
      FakeLLMProvider.answering(goodReview()),
    ).evaluate(contextFor());

    expect(outcome.criterionResults[0]?.confidence).toBe(0.72);
  });

  describe("schema validation", () => {
    it.each([
      ["not an object", 42],
      ["null", null],
      ["missing criteria", { strengths: [], priorityImprovements: [], summary: "x" }],
      ["missing summary", { criteria: [], strengths: [], priorityImprovements: [] }],
      ["empty criteria", goodReview({ criteria: [] })],
    ])("rejects %s", async (_label, output) => {
      await expect(
        new AIDesignEvaluator(FakeLLMProvider.answering(output)).evaluate(
          contextFor(),
        ),
      ).rejects.toThrow(LLMResponseFormatError);
    });

    it("rejects an unknown criterion name", async () => {
      const output = goodReview({
        criteria: [
          {
            criterion: "VIBES",
            assessment: "ADEQUATE",
            evidence: [],
            confidence: 0.5,
          },
        ],
      });

      await expect(
        new AIDesignEvaluator(FakeLLMProvider.answering(output)).evaluate(
          contextFor(),
        ),
      ).rejects.toThrow(LLMResponseFormatError);
    });

    it.each([-0.1, 1.2, 42, Number.NaN])(
      "rejects confidence %s rather than clamping it",
      async (confidence) => {
        const output = goodReview({
          criteria: [
            {
              criterion: "COHESION",
              assessment: "ADEQUATE",
              evidence: [],
              confidence,
            },
          ],
        });

        await expect(
          new AIDesignEvaluator(FakeLLMProvider.answering(output)).evaluate(
            contextFor(),
          ),
        ).rejects.toThrow(LLMResponseFormatError);
      },
    );

    it("rejects an answer with no confidence at all", async () => {
      const output = goodReview({
        criteria: [
          { criterion: "COHESION", assessment: "ADEQUATE", evidence: [] },
        ],
      });

      await expect(
        new AIDesignEvaluator(FakeLLMProvider.answering(output)).evaluate(
          contextFor(),
        ),
      ).rejects.toThrow(LLMResponseFormatError);
    });

    it("names the offending field in the error", async () => {
      const error = await new AIDesignEvaluator(
        FakeLLMProvider.answering(goodReview({ summary: "" })),
      )
        .evaluate(contextFor())
        .catch((caught: unknown) => caught);

      expect((error as Error).message).toContain("summary");
    });
  });

  describe("provider failure", () => {
    it.each([
      ["a timeout", new LLMTimeoutError(45_000)],
      ["a rate limit", new LLMRateLimitError("slow down")],
      ["an outage", new LLMUnavailableError("unreachable")],
    ])("propagates %s rather than returning a partial review", async (_label, error) => {
      await expect(
        new AIDesignEvaluator(FakeLLMProvider.failing(error)).evaluate(
          contextFor(),
        ),
      ).rejects.toThrow(error.constructor as never);
    });

    it("keeps a timeout distinguishable from a malformed answer", async () => {
      const timeout = await new AIDesignEvaluator(FakeLLMProvider.timingOut(1_000))
        .evaluate(contextFor())
        .catch((caught: unknown) => caught);

      expect(timeout).toBeInstanceOf(LLMTimeoutError);
      expect((timeout as LLMTimeoutError).retryable).toBe(true);
      expect((timeout as LLMTimeoutError).code).toBe("LLM_TIMEOUT");
    });
  });

  describe("structured-output retry", () => {
    it("recovers from one malformed answer by retrying once, and keeps the recovered result", async () => {
      const provider = FakeLLMProvider.sequence([
        { output: { criteria: [], strengths: [], priorityImprovements: [] } }, // missing `summary`
        { output: goodReview() },
      ]);

      const outcome = await new AIDesignEvaluator(provider).evaluate(contextFor());

      expect(outcome.summary).toBe(goodReview().summary);
      expect(provider.requests).toHaveLength(2);
      expect(provider.requests[1]?.system).toContain("YOUR PREVIOUS ANSWER DID NOT MATCH");
      // The retry is the same request otherwise — same schema, same problem data.
      expect(provider.requests[1]?.user).toBe(provider.requests[0]?.user);
    });

    it("fails cleanly, never inventing a result, when the retry is malformed too", async () => {
      const provider = FakeLLMProvider.sequence([
        { output: { criteria: [] } },
        { output: { criteria: [] } },
      ]);

      await expect(new AIDesignEvaluator(provider).evaluate(contextFor())).rejects.toThrow(
        LLMResponseFormatError,
      );
      expect(provider.requests).toHaveLength(2);
    });

    it("does not retry a timeout, a rate limit, or any non-schema failure", async () => {
      for (const error of [
        new LLMTimeoutError(1_000),
        new LLMRateLimitError("rate limited"),
        new LLMUnavailableError("provider is down"),
      ]) {
        const provider = FakeLLMProvider.failing(error);

        await expect(new AIDesignEvaluator(provider).evaluate(contextFor())).rejects.toBe(error);
        expect(provider.requests).toHaveLength(1);
      }
    });

    it("never attempts a third call — bounded to exactly one retry", async () => {
      const provider = FakeLLMProvider.sequence([
        { output: { criteria: [] } },
        { output: { criteria: [] } },
        { output: goodReview() },
      ]);

      await expect(new AIDesignEvaluator(provider).evaluate(contextFor())).rejects.toThrow();
      expect(provider.requests).toHaveLength(2);
    });

    it("makes exactly one call when the first answer already validates", async () => {
      const provider = FakeLLMProvider.answering(goodReview());

      await new AIDesignEvaluator(provider).evaluate(contextFor());

      expect(provider.requests).toHaveLength(1);
    });
  });

  describe("evidence grounding", () => {
    it("accepts evidence that names a real element and field", async () => {
      const outcome = await new AIDesignEvaluator(
        FakeLLMProvider.answering(goodReview()),
      ).evaluate(contextFor());

      expect(outcome.criterionResults[0]?.evidence).toEqual([
        {
          entity: "ParkingLot",
          field: "responsibility",
          value: "Owns levels and coordinates parking and exit flows.",
        },
      ]);
      expect(
        outcome.criterionResults[0]?.unverifiedEvidenceCount,
      ).toBeUndefined();
    });

    it("rejects evidence naming an entity that is not in the design", async () => {
      const output = goodReview({
        criteria: [
          {
            criterion: "COUPLING",
            assessment: "NEEDS_IMPROVEMENT",
            evidence: [{ entity: "PaymentService", field: "responsibility" }],
            concern: "PaymentService knows too much.",
            confidence: 0.9,
          },
        ],
        priorityImprovements: [],
      });

      const outcome = await new AIDesignEvaluator(
        FakeLLMProvider.answering(output),
      ).evaluate(contextFor());

      const result = outcome.criterionResults[0]!;
      expect(result.evidence).toEqual([]);
      expect(result.unverifiedEvidenceCount).toBe(1);
      // A concern with nothing to point at is not carried as one.
      expect(result.concern).toBeUndefined();
      expect(outcome.summary).toContain("could not be found");
    });

    it("rejects a fabricated relationship", async () => {
      const output = goodReview({
        criteria: [
          {
            criterion: "COUPLING",
            assessment: "NEEDS_IMPROVEMENT",
            evidence: [
              {
                entity: "Ticket",
                field: "relationships",
                value: "Ticket -> PaymentService",
              },
            ],
            concern: "Ticket depends on payment.",
            confidence: 0.8,
          },
        ],
        priorityImprovements: [],
      });

      const outcome = await new AIDesignEvaluator(
        FakeLLMProvider.answering(output),
      ).evaluate(contextFor());

      expect(outcome.criterionResults[0]?.evidence).toEqual([]);
      expect(outcome.criterionResults[0]?.unverifiedEvidenceCount).toBe(1);
    });

    it("drops an improvement whose evidence cannot be verified", async () => {
      const output = goodReview({
        priorityImprovements: [
          {
            criterion: "ABSTRACTION",
            priority: "P1",
            what: "Extract a PaymentGateway.",
            where: [{ entity: "PaymentGateway", field: "methods" }],
            why: "Payments vary.",
          },
        ],
      });

      const outcome = await new AIDesignEvaluator(
        FakeLLMProvider.answering(output),
      ).evaluate(contextFor());

      expect(outcome.priorityImprovements).toEqual([]);
    });

    it("keeps an improvement that is grounded, and marks it as an AI finding", async () => {
      const outcome = await new AIDesignEvaluator(
        FakeLLMProvider.answering(goodReview()),
      ).evaluate(contextFor());

      const item = outcome.priorityImprovements[0]!;
      expect(isGrounded(item)).toBe(true);
      expect(item.code).toBe("AI_SEMANTIC_FINDING");
      expect(item.criterion).toBe("RESPONSIBILITY");
      expect(item.where).toEqual([
        { entity: "ParkingLot", field: "methods", value: "exit" },
      ]);
    });

    it("gives two different submissions' priority improvements at the same index different ids", async () => {
      // `EvaluationFeedbackItem.id` is a global primary key across every
      // evaluation ever stored, not one scoped to this evaluation, so an id
      // built from the array index alone would collide as soon as two
      // different submissions each produced a priority improvement at the
      // same index — exactly what happened in production.
      const design = designForProblem(problem);
      const first = await new AIDesignEvaluator(
        FakeLLMProvider.answering(goodReview()),
      ).evaluate({ problem, submission: submissionOf(design, { id: "sub_one" }) });
      const second = await new AIDesignEvaluator(
        FakeLLMProvider.answering(goodReview()),
      ).evaluate({ problem, submission: submissionOf(design, { id: "sub_two" }) });

      const firstId = first.priorityImprovements[0]?.id;
      const secondId = second.priorityImprovements[0]?.id;
      expect(firstId).toBeDefined();
      expect(secondId).toBeDefined();
      expect(firstId).not.toBe(secondId);
    });

    it("keeps verified evidence and discards the rest from the same finding", async () => {
      const output = goodReview({
        criteria: [
          {
            criterion: "COHESION",
            assessment: "ADEQUATE",
            evidence: [
              { entity: "ParkingLot", field: "methods", value: "park" },
              { entity: "Imaginary", field: "methods" },
            ],
            concern: "Mixed, but mostly coherent.",
            confidence: 0.6,
          },
        ],
        priorityImprovements: [],
      });

      const outcome = await new AIDesignEvaluator(
        FakeLLMProvider.answering(output),
      ).evaluate(contextFor());

      expect(outcome.criterionResults[0]?.evidence).toHaveLength(1);
      expect(outcome.criterionResults[0]?.unverifiedEvidenceCount).toBe(1);
      expect(outcome.criterionResults[0]?.concern).toBe(
        "Mixed, but mostly coherent.",
      );
    });

    it("ignores a criterion outside its remit, so it cannot restate a fact", async () => {
      const output = goodReview({
        criteria: [
          {
            criterion: "REQUIREMENT_UNDERSTANDING",
            assessment: "MISSING",
            evidence: [{ entity: "ParkingLot" }],
            concern: "Requirements are not covered.",
            confidence: 1,
          },
          ...goodReview().criteria,
        ],
      });

      const outcome = await new AIDesignEvaluator(
        FakeLLMProvider.answering(output),
      ).evaluate(contextFor());

      expect(outcome.criterionResults.map((entry) => entry.criterion)).not.toContain(
        "REQUIREMENT_UNDERSTANDING",
      );
    });
  });

  describe("what the model is sent", () => {
    it("sends the problem, its requirements and the submitted design", async () => {
      const provider = FakeLLMProvider.answering(goodReview());
      await new AIDesignEvaluator(provider).evaluate(contextFor());

      const { user } = provider.lastRequest;
      expect(user).toContain("Parking Lot");
      expect(user).toContain("PL-REQ-01");
      expect(user).toContain("PL-REQ-02");
      expect(user).toContain("ParkingLot");
      expect(user).toContain("PricingStrategy");
      expect(user).toContain("Keep pricing behind PricingStrategy.");
      expect(user).toContain("No compatible spot is free.");
    });

    it("sends deterministic findings when a rule evaluation has already run", async () => {
      const provider = FakeLLMProvider.answering(goodReview());
      const context = contextFor();
      const deterministicOutcome = await new RuleBasedEvaluator().evaluate(context);

      await new AIDesignEvaluator(provider).evaluate({
        ...context,
        deterministicOutcome,
      });

      const { user } = provider.lastRequest;
      expect(user).toContain("ALREADY ESTABLISHED BY THE STRUCTURAL CHECKER");
      expect(user).toContain("STRUCTURAL_VALIDITY");
      expect(user).toContain("REQUIREMENT_COVERAGE");
    });

    it("omits the deterministic section when nothing has run yet", async () => {
      const provider = FakeLLMProvider.answering(goodReview());
      await new AIDesignEvaluator(provider).evaluate(contextFor());

      expect(provider.lastRequest.user).not.toContain(
        "ALREADY ESTABLISHED BY THE STRUCTURAL CHECKER",
      );
    });

    it("records the prompt version and the schema on every request", async () => {
      const provider = FakeLLMProvider.answering(goodReview());
      await new AIDesignEvaluator(provider).evaluate(contextFor());

      const request = provider.lastRequest;
      expect(request.promptVersion).toBe(AI_EVALUATOR_PROMPT_VERSION);
      expect(request.schemaName).toBe("design_review");
      expect(request.responseSchema).toHaveProperty("properties");
      expect(request.timeoutMs).toBeGreaterThan(0);
    });

    it("passes a configured timeout through to the provider", async () => {
      const provider = FakeLLMProvider.answering(goodReview());
      await new AIDesignEvaluator(provider, { timeoutMs: 1_234 }).evaluate(
        contextFor(),
      );

      expect(provider.lastRequest.timeoutMs).toBe(1_234);
    });

    it("defaults to a token budget with real headroom above a measured normal evaluation, and below the model's own ceiling", async () => {
      const provider = FakeLLMProvider.answering(goodReview());
      await new AIDesignEvaluator(provider).evaluate(contextFor());

      // A live call against the configured Groq model produced a complete,
      // schema-valid evaluation using ~2900 completion tokens against its true
      // 65536-token ceiling. The default budget must sit well above that
      // measured usage (so a more elaborate design does not truncate) and well
      // below the model's ceiling (so it stays a considered budget, not a guess
      // at the max).
      expect(provider.lastRequest.maxOutputTokens).toBeGreaterThanOrEqual(8_000);
      expect(provider.lastRequest.maxOutputTokens).toBeLessThan(65_536);
    });

    it("passes a configured token budget through to the provider", async () => {
      const provider = FakeLLMProvider.answering(goodReview());
      await new AIDesignEvaluator(provider, { maxOutputTokens: 9_000 }).evaluate(
        contextFor(),
      );

      expect(provider.lastRequest.maxOutputTokens).toBe(9_000);
    });
  });

  describe("multiple valid designs", () => {
    it("reviews a one-class design without any reference design to compare to", async () => {
      const alternative: StructuredDesign = {
        classes: [
          {
            id: "c1",
            name: "ParkingLotService",
            responsibility: "Admits vehicles, tracks occupancy and settles payment.",
            attributes: [],
            methods: [{ name: "admit" }, { name: "release" }],
          },
        ],
        interfaces: [],
        relationships: [],
        decisions: [
          {
            decision: "One service while the rules are fixed.",
            rationale: "No stated variation point yet.",
            tradeoff: "A pricing change touches this class.",
          },
        ],
        edgeCases: [
          { description: "The lot is full.", expectedBehavior: "Refuse entry." },
        ],
        requirementMappings: problem.requirements.map((requirement) => ({
          requirementId: requirement.id,
          references: [{ entity: "ParkingLotService" }],
        })),
      };

      const provider = FakeLLMProvider.answering({
        criteria: [
          {
            criterion: "ABSTRACTION",
            assessment: "ADEQUATE",
            evidence: [
              {
                entity: "ParkingLotService",
                field: "responsibility",
                value: "Admits vehicles",
              },
            ],
            concern: "One element carries three jobs, which the brief allows for now.",
            confidence: 0.55,
          },
        ],
        strengths: ["The single decision states its trade-off."],
        priorityImprovements: [],
        summary: "A simple decomposition that meets the stated requirements.",
      });

      const outcome = await new AIDesignEvaluator(provider).evaluate({
        problem,
        submission: submissionOf(alternative),
      });

      expect(outcome.criterionResults[0]?.assessment).toBe("ADEQUATE");
      expect(outcome.criterionResults[0]?.evidence).toHaveLength(1);
      // Nothing in the request describes a preferred design.
      expect(provider.lastRequest.system).toContain(
        "THERE IS NO CORRECT ANSWER TO COMPARE AGAINST",
      );
    });
  });
});
