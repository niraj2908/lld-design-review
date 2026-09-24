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
  evaluate(context: EvaluationContext): Promise<EvaluationOutcome>;
}
