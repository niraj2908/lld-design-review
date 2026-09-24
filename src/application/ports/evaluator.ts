import type { EvaluationOutcome } from "@/domain/evaluation/evaluation-outcome";
import type { Problem } from "@/domain/problem/problem";
import type { ValidationIssue } from "@/domain/shared/validation";
import type { Submission } from "@/domain/submission/submission";
import type { KnowledgeChunk } from "./knowledge-retriever";

export interface EvaluationInput {
  readonly problem: Problem;
  readonly submission: Submission;
  /** Deterministic findings are given to the evaluator, not hidden from it. */
  readonly deterministicFindings: readonly ValidationIssue[];
  readonly knowledge: readonly KnowledgeChunk[];
}

/**
 * Contract only. Rule-based, AI, hybrid and human evaluators are all valid
 * implementations; none of them receives a reference solution to compare against.
 */
export interface Evaluator {
  readonly version: string;
  evaluate(input: EvaluationInput): Promise<EvaluationOutcome>;
}
