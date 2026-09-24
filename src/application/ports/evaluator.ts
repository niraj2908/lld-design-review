import type { KnowledgeContext } from "./knowledge-context";
import type { EvaluationOutcome } from "@/domain/evaluation/evaluation-outcome";
import type { Problem } from "@/domain/problem/problem";
import type { Submission } from "@/domain/submission/submission";

/**
 * Everything an evaluator is allowed to see.
 *
 * The problem carries its own requirements, constraints and rubric, and the
 * submission carries its version, format and frozen design, so nothing is
 * duplicated here — a second copy of either could disagree with the stored one.
 *
 * What is deliberately absent: any reference or model answer. An evaluator
 * reasons from the requirements, never from someone else's design.
 */
export interface EvaluationContext {
  readonly problem: Problem;
  readonly submission: Submission;
  /**
   * What a deterministic evaluator already established, when one has run.
   *
   * A judge that can see the structural findings does not waste its attention
   * re-deciding them, and can reason about what they imply. Optional, because an
   * evaluator running on its own has nothing to pass.
   */
  readonly deterministicOutcome?: EvaluationOutcome;
  /**
   * Reference knowledge retrieved for this review. Absent when no knowledge layer is
   * configured; present and empty when retrieval found nothing, which the prompt
   * states rather than hiding.
   */
  readonly knowledge?: KnowledgeContext;
}

/**
 * Static facts about what produced an evaluation, recorded for reproducibility.
 * Known when an evaluator is constructed, so it needs no plumbing through the
 * call.
 */
export interface EvaluatorMetadata {
  readonly provider?: string;
  readonly model?: string;
  readonly promptVersion?: string;
}

/**
 * Contract only. Rule-based, AI, hybrid and human evaluators are all valid
 * implementations.
 *
 * Retrieved knowledge and deterministic findings are not in the context on
 * purpose: an AI evaluator holds its own `KnowledgeRetriever`, and a hybrid
 * evaluator composes a rule evaluator with a judge and passes one's output to the
 * other. Neither concern belongs to every implementation.
 */
export interface DesignEvaluator {
  /** Recorded on every evaluation this evaluator produces, for reproducibility. */
  readonly version: string;
  /** Absent for an evaluator that consults no model. */
  readonly metadata?: EvaluatorMetadata;
  evaluate(context: EvaluationContext): Promise<EvaluationOutcome>;
}
