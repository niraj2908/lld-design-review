import type {
  DesignEvaluator,
  EvaluationContext,
  EvaluatorMetadata,
} from "@/application/ports/evaluator";
import type { LLMProvider } from "@/application/ports/llm-provider";
import type { CriterionResult } from "@/domain/evaluation/criterion-result";
import type { EvaluationOutcome } from "@/domain/evaluation/evaluation-outcome";
import { validateEvidence } from "@/domain/evaluation/evidence-validation";
import type { FeedbackItem } from "@/domain/feedback/feedback-item";
import type { KnowledgeContextProvider } from "@/application/ports/knowledge-context";
import {
  AI_EVALUATOR_PROMPT_VERSION,
  AI_SYSTEM_PROMPT,
  buildUserPrompt,
} from "./ai-prompt";
import { buildKnowledgeRequests } from "./knowledge-query";
import { isAICriterion } from "./ai-criteria";
import { generateStructuredWithRetry } from "./llm-structured-retry";
import {
  AI_REVIEW_SCHEMA_NAME,
  aiReviewJsonSchema,
  aiReviewSchema,
  presentOrUndefined,
  toDomainEvidence,
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
  // The configured Groq model (openai/gpt-oss-120b) is a reasoning model whose
  // completion tokens cover both its internal reasoning and the final JSON body;
  // a live measurement against the real API showed a normal, complete multi-
  // criterion evaluation consuming ~2900 of those tokens even though the model's
  // own ceiling is 65536. 4096 left too little headroom above that baseline and
  // production evaluations were hitting it before the JSON was finished. 16384
  // gives roughly 5x the measured normal usage without raising latency on a
  // successful run — the model stops generating once it is done; the ceiling
  // only matters when a response would otherwise be cut off.
  maxOutputTokens: 16384,
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
    // Marks the start of this request's share of the route's 60-second execution
    // budget, so a structured-output retry started later — after grounding has
    // already spent part of it — knows how much is genuinely left.
    const startedAt = Date.now();

    // Retrieval happens here, after the deterministic outcome has arrived in the
    // context, so the query can say what the structural checker already settled. A
    // retrieval failure is not swallowed: it fails the evaluation like any other
    // dependency, rather than quietly producing an ungrounded review.
    const grounded = await this.ground(context);

    // A provider's schema mode is a hint, not a guarantee: `generateStructuredWithRetry`
    // re-validates with `aiReviewSchema` regardless, and allows at most one retry —
    // same provider, same model — if and only if that first answer fails to
    // validate AND enough of the execution budget remains. Any other kind of
    // failure (timeout, rate limit, auth, ...) is not retried here.
    const { output } = await generateStructuredWithRetry(
      this.llm,
      {
        promptVersion: AI_EVALUATOR_PROMPT_VERSION,
        system: AI_SYSTEM_PROMPT,
        user: buildUserPrompt(grounded),
        responseSchema: aiReviewJsonSchema,
        schemaName: AI_REVIEW_SCHEMA_NAME,
        temperature: this.options.temperature,
        maxOutputTokens: this.options.maxOutputTokens,
        timeoutMs: this.options.timeoutMs,
      },
      aiReviewSchema,
      "review",
      startedAt,
    );

    return this.validate(output, grounded);
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
        entry.evidence.map(toDomainEvidence),
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
      const concern = presentOrUndefined(entry.concern);
      if (concern !== undefined && verified.length > 0) {
        result = { ...result, concern };
      }
      const suggestion = presentOrUndefined(entry.suggestion);
      if (suggestion !== undefined) {
        result = { ...result, suggestion };
      }
      criterionResults.push(result);
    }

    const priorityImprovements: FeedbackItem[] = [];
    review.priorityImprovements.forEach((entry, index) => {
      if (!isAICriterion(entry.criterion)) {
        return;
      }
      const { verified, rejected } = validateEvidence(
        entry.where.map(toDomainEvidence),
        design,
      );
      discarded += rejected.length;
      if (verified.length === 0) {
        return;
      }

      let item: FeedbackItem = {
        // Scoped by submission id: `EvaluationFeedbackItem.id` is a single global
        // primary key across every evaluation ever stored, not one scoped to this
        // evaluation, so an id built from the array index alone ("fbk_ai_1") is
        // certain to collide with another submission's first finding. The
        // submission id is already globally unique and stable for retries of the
        // same submission, which keeps the id deterministic for the same input —
        // just also unique across different ones.
        id: `fbk_ai_${context.submission.id}_${index + 1}`,
        priority: entry.priority,
        criterion: entry.criterion,
        code: "AI_SEMANTIC_FINDING",
        what: entry.what,
        where: verified,
        why: entry.why,
      };
      const reconsider = presentOrUndefined(entry.reconsider);
      if (reconsider !== undefined) {
        item = { ...item, reconsider };
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
