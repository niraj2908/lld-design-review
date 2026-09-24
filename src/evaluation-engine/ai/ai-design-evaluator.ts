import type {
  DesignEvaluator,
  EvaluationContext,
  EvaluatorMetadata,
} from "@/application/ports/evaluator";
import type { LLMProvider } from "@/application/ports/llm-provider";
import { LLMResponseFormatError } from "@/application/ports/llm-provider";
import type { CriterionResult } from "@/domain/evaluation/criterion-result";
import type { EvaluationOutcome } from "@/domain/evaluation/evaluation-outcome";
import { validateEvidence } from "@/domain/evaluation/evidence-validation";
import type { Evidence } from "@/domain/feedback/evidence";
import type { FeedbackItem } from "@/domain/feedback/feedback-item";
import type { KnowledgeContextProvider } from "@/application/ports/knowledge-context";
import {
  AI_EVALUATOR_PROMPT_VERSION,
  AI_SYSTEM_PROMPT,
  buildUserPrompt,
} from "./ai-prompt";
import { buildKnowledgeRequests } from "./knowledge-query";
import { isAICriterion } from "./ai-criteria";
import {
  AI_REVIEW_SCHEMA_NAME,
  aiReviewJsonSchema,
  aiReviewSchema,
} from "./ai-response-schema";
import type { AIReview } from "./ai-response-schema";

/** Bump when the evaluator's own behaviour changes, not just the prompt. */
export const AI_EVALUATOR_VERSION = "ai-v2";

export interface AIDesignEvaluatorOptions {
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly timeoutMs?: number;
  /**
   * Retrieves design guidance to reason with. Optional: without it the judge works
   * from the requirements and the submission alone, which is exactly what it did
   * before a knowledge base existed.
   */
  readonly knowledge?: KnowledgeContextProvider;
}

const DEFAULTS = {
  // Low but not zero: a judge that is too deterministic tends to repeat the same
  // observation for every design.
  temperature: 0.2,
  maxOutputTokens: 4096,
  timeoutMs: 45_000,
} as const;

/**
 * Asks a language model for the judgements the rule evaluator cannot make, then
 * refuses to pass on anything it cannot verify.
 *
 * Three things happen to the model's answer before it becomes an outcome: it is
 * parsed against a schema, its evidence is checked against the submitted design,
 * and any finding left without evidence is dropped rather than shown. What
 * survives is a judgement backed by a quote a reader can go and find.
 */
export class AIDesignEvaluator implements DesignEvaluator {
  readonly version = AI_EVALUATOR_VERSION;
  readonly metadata: EvaluatorMetadata;

  private readonly options: Required<
    Omit<AIDesignEvaluatorOptions, "knowledge">
  >;
  private readonly knowledge: KnowledgeContextProvider | undefined;

  constructor(
    private readonly llm: LLMProvider,
    options: AIDesignEvaluatorOptions = {},
  ) {
    this.options = {
      temperature: options.temperature ?? DEFAULTS.temperature,
      maxOutputTokens: options.maxOutputTokens ?? DEFAULTS.maxOutputTokens,
      timeoutMs: options.timeoutMs ?? DEFAULTS.timeoutMs,
    };
    this.knowledge = options.knowledge;
    this.metadata = {
      provider: llm.name,
      model: llm.model,
      promptVersion: AI_EVALUATOR_PROMPT_VERSION,
    };
  }

  async evaluate(context: EvaluationContext): Promise<EvaluationOutcome> {
    // Retrieval happens here, after the deterministic outcome has arrived in the
    // context, so the query can say what the structural checker already settled. A
    // retrieval failure is not swallowed: it fails the evaluation like any other
    // dependency, rather than quietly producing an ungrounded review.
    const grounded = await this.ground(context);

    const result = await this.llm.generateStructured({
      promptVersion: AI_EVALUATOR_PROMPT_VERSION,
      system: AI_SYSTEM_PROMPT,
      user: buildUserPrompt(grounded),
      responseSchema: aiReviewJsonSchema,
      schemaName: AI_REVIEW_SCHEMA_NAME,
      temperature: this.options.temperature,
      maxOutputTokens: this.options.maxOutputTokens,
      timeoutMs: this.options.timeoutMs,
    });

    const parsed = aiReviewSchema.safeParse(result.output);
    if (!parsed.success) {
      // A provider's schema mode is a hint, not a guarantee. An answer that does
      // not fit the contract is a failed evaluation, never a partial one.
      throw new LLMResponseFormatError(
        `The model's answer did not match the review schema: ${parsed.error.issues
          .map((issue) => `${issue.path.join(".")} ${issue.message}`)
          .join("; ")}`,
        { cause: parsed.error },
      );
    }

    return this.validate(parsed.data, grounded);
  }

  /** Adds retrieved guidance to the context, when a knowledge layer is configured. */
  private async ground(
    context: EvaluationContext,
  ): Promise<EvaluationContext> {
    if (this.knowledge === undefined) {
      return context;
    }
    const knowledge = await this.knowledge.buildMany(
      buildKnowledgeRequests(context),
    );
    return { ...context, knowledge };
  }

  /**
   * Keeps only what the submission supports.
   *
   * A criterion result keeps its verified evidence and records how much was
   * discarded. An improvement with no verified evidence left is dropped: the
   * product promises the learner that every improvement says where, and an
   * unverifiable "where" is worse than silence.
   */
  private validate(
    review: AIReview,
    context: EvaluationContext,
  ): EvaluationOutcome {
    const design = context.submission.payload;
    let discarded = 0;

    const criterionResults: CriterionResult[] = [];
    for (const entry of review.criteria) {
      if (!isAICriterion(entry.criterion)) {
        // Outside this evaluator's remit — most importantly requirement coverage,
        // which is already settled deterministically.
        continue;
      }

      const { verified, rejected } = validateEvidence(
        entry.evidence as readonly Evidence[],
        design,
      );
      discarded += rejected.length;

      let result: CriterionResult = {
        criterion: entry.criterion,
        assessment: entry.assessment,
        evidence: verified,
        confidence: entry.confidence,
      };
      if (rejected.length > 0) {
        result = { ...result, unverifiedEvidenceCount: rejected.length };
      }
      // A concern with nothing to point at is an assertion, so it is not carried
      // as one. The assessment and confidence still stand as the judge's reading.
      if (entry.concern !== undefined && verified.length > 0) {
        result = { ...result, concern: entry.concern };
      }
      if (entry.suggestion !== undefined) {
        result = { ...result, suggestion: entry.suggestion };
      }
      criterionResults.push(result);
    }

    const priorityImprovements: FeedbackItem[] = [];
    review.priorityImprovements.forEach((entry, index) => {
      if (!isAICriterion(entry.criterion)) {
        return;
      }
      const { verified, rejected } = validateEvidence(
        entry.where as readonly Evidence[],
        design,
      );
      discarded += rejected.length;
      if (verified.length === 0) {
        return;
      }

      let item: FeedbackItem = {
        id: `fbk_ai_${index + 1}`,
        priority: entry.priority,
        criterion: entry.criterion,
        code: "AI_SEMANTIC_FINDING",
        what: entry.what,
        where: verified,
        why: entry.why,
      };
      if (entry.reconsider !== undefined) {
        item = { ...item, reconsider: entry.reconsider };
      }
      priorityImprovements.push(item);
    });

    const summary =
      discarded === 0
        ? review.summary
        : `${review.summary} (${discarded} evidence ${discarded === 1 ? "reference" : "references"} in this review could not be found in the submission and were discarded.)`;

    const citations = context.knowledge?.citations ?? [];

    return {
      criterionResults,
      strengths: review.strengths,
      priorityImprovements,
      summary,
      // Provenance of what the judge was shown, never of what the learner did.
      ...(citations.length === 0 ? {} : { knowledgeCitations: citations }),
    };
  }
}
