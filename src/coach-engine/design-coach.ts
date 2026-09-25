import type { CoachContext, DesignCoach } from "@/application/ports/design-coach";
import type { KnowledgeContextProvider } from "@/application/ports/knowledge-context";
import type { LLMProvider } from "@/application/ports/llm-provider";
import { LLMResponseFormatError } from "@/application/ports/llm-provider";
import type {
  CoachAnswer,
  CoachObservation,
  CoachRecommendation,
} from "@/domain/coach/coach-answer";
import { filterKnownCriteria } from "@/domain/coach/evaluation-reference-validation";
import { validateEvidence } from "@/domain/evaluation/evidence-validation";
import type { Evidence } from "@/domain/feedback/evidence";
import { buildCoachKnowledgeRequest } from "./coach-knowledge-query";
import { COACH_PROMPT_VERSION, COACH_SYSTEM_PROMPT, buildCoachUserPrompt } from "./coach-prompt";
import {
  COACH_ANSWER_SCHEMA_NAME,
  coachAnswerJsonSchema,
  coachAnswerSchema,
} from "./coach-response-schema";
import type { CoachModelOutput } from "./coach-response-schema";

export interface DesignCoachOptions {
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly timeoutMs?: number;
  /** Optional, exactly like the AI evaluator's: the coach answers from the design and problem alone without it. */
  readonly knowledge?: KnowledgeContextProvider;
}

const DEFAULTS = {
  temperature: 0.2,
  maxOutputTokens: 2048,
  timeoutMs: 30_000,
} as const;

/**
 * Asks a language model to answer one question about one attempt, then keeps
 * only what the design and the evaluation actually support.
 *
 * The shape of this class mirrors `AIDesignEvaluator` deliberately: retrieve,
 * prompt, parse against a schema, then verify every claim of evidence against
 * the real design before any of it is trusted. A coach that cannot check its own
 * claims is exactly the "generic AI chatbot" this feature is not meant to be.
 */
export class LLMDesignCoach implements DesignCoach {
  private readonly options: Required<Omit<DesignCoachOptions, "knowledge">>;
  private readonly knowledge: KnowledgeContextProvider | undefined;

  constructor(
    private readonly llm: LLMProvider,
    options: DesignCoachOptions = {},
  ) {
    this.options = {
      temperature: options.temperature ?? DEFAULTS.temperature,
      maxOutputTokens: options.maxOutputTokens ?? DEFAULTS.maxOutputTokens,
      timeoutMs: options.timeoutMs ?? DEFAULTS.timeoutMs,
    };
    this.knowledge = options.knowledge;
  }

  async ask(context: CoachContext): Promise<CoachAnswer> {
    const grounded = await this.retrieveKnowledge(context);

    const result = await this.llm.generateStructured({
      promptVersion: COACH_PROMPT_VERSION,
      system: COACH_SYSTEM_PROMPT,
      user: buildCoachUserPrompt(grounded),
      responseSchema: coachAnswerJsonSchema,
      schemaName: COACH_ANSWER_SCHEMA_NAME,
      temperature: this.options.temperature,
      maxOutputTokens: this.options.maxOutputTokens,
      timeoutMs: this.options.timeoutMs,
    });

    const parsed = coachAnswerSchema.safeParse(result.output);
    if (!parsed.success) {
      throw new LLMResponseFormatError(
        `The coach's answer did not match the expected schema: ${parsed.error.issues
          .map((issue) => `${issue.path.join(".")} ${issue.message}`)
          .join("; ")}`,
        { cause: parsed.error },
      );
    }

    return this.ground(parsed.data, grounded);
  }

  private async retrieveKnowledge(context: CoachContext): Promise<CoachContext> {
    if (this.knowledge === undefined) {
      return context;
    }
    const knowledge = await this.knowledge.buildMany([
      buildCoachKnowledgeRequest(context),
    ]);
    return { ...context, knowledge };
  }

  /**
   * Turns the model's raw, schema-valid answer into a `CoachAnswer` nothing in
   * it can no longer be traced. An observation loses its evidence, it is
   * dropped entirely — the same "no evidence, no claim" rule the evaluators use
   * — and an evaluation reference the stored evaluation never actually made is
   * silently removed rather than shown as if it were real.
   */
  private ground(output: CoachModelOutput, context: CoachContext): CoachAnswer {
    let unverified = 0;

    const observations: CoachObservation[] = [];
    for (const entry of output.observations) {
      const { verified, rejected } = validateEvidence(
        entry.evidence as readonly Evidence[],
        context.design,
      );
      unverified += rejected.length;
      if (verified.length === 0) {
        continue;
      }
      observations.push({ text: entry.text, evidence: verified });
    }

    const knownCriteria = (context.evaluation?.criterionResults ?? []).map(
      (result) => result.criterion,
    );
    const evaluationReferences = filterKnownCriteria(
      output.evaluationReferences,
      knownCriteria,
    );
    unverified += output.evaluationReferences.length - evaluationReferences.length;

    const recommendation: CoachRecommendation | undefined =
      output.recommendation === undefined
        ? undefined
        : { suggestion: output.recommendation.suggestion, rationale: output.recommendation.rationale };

    return {
      answer: output.answer,
      observations,
      ...(recommendation === undefined ? {} : { recommendation }),
      evaluationReferences,
      // Provenance of what the coach was shown, never a citation list the model
      // wrote itself — the same rule the evaluator applies.
      knowledgeCitations: context.knowledge?.citations ?? [],
      certainty: output.certainty,
      ...(output.followUpQuestion === undefined
        ? {}
        : { followUpQuestion: output.followUpQuestion }),
      unverifiedReferenceCount: unverified,
    };
  }
}
