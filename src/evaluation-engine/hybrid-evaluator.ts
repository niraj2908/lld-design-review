import type {
  DesignEvaluator,
  EvaluationContext,
  EvaluatorMetadata,
} from "@/application/ports/evaluator";
import type { EvaluationOutcome } from "@/domain/evaluation/evaluation-outcome";
import { FEEDBACK_PRIORITIES } from "@/domain/feedback/feedback-item";
import { natureOf } from "@/domain/evaluation/review-criterion";

export const HYBRID_EVALUATOR_VERSION = "hybrid-v1";

const PRIORITY_ORDER = new Map(
  FEEDBACK_PRIORITIES.map((priority, index) => [priority, index]),
);

/**
 * Runs the deterministic evaluator, then the judge, and joins the two.
 *
 * The AI cannot overwrite a fact, and not by policing: the two evaluators report
 * on disjoint criterion sets — five deterministic, nine semantic — so there is no
 * criterion both can speak about. The join is a concatenation, and a test asserts
 * the sets stay disjoint.
 *
 * The deterministic outcome is also handed to the judge through the context, so it
 * spends its attention on what the checker could not settle.
 */
export class HybridEvaluator implements DesignEvaluator {
  readonly version = HYBRID_EVALUATOR_VERSION;

  constructor(
    private readonly deterministic: DesignEvaluator,
    private readonly semantic: DesignEvaluator,
  ) {}

  get metadata(): EvaluatorMetadata {
    // The judge is the only part with a provider and a model.
    return this.semantic.metadata ?? {};
  }

  async evaluate(context: EvaluationContext): Promise<EvaluationOutcome> {
    const factual = await this.deterministic.evaluate(context);

    // A judge failure must not discard the facts, so the deterministic outcome is
    // already complete before the model is called; the caller decides what a
    // failed judge means for the evaluation as a whole.
    const judgement = await this.semantic.evaluate({
      ...context,
      deterministicOutcome: factual,
    });

    return {
      criterionResults: [
        ...factual.criterionResults,
        ...judgement.criterionResults,
      ],
      strengths: [...factual.strengths, ...judgement.strengths],
      priorityImprovements: [
        ...factual.priorityImprovements,
        ...judgement.priorityImprovements,
      ].toSorted(
        (left, right) =>
          (PRIORITY_ORDER.get(left.priority) ?? 0) -
          (PRIORITY_ORDER.get(right.priority) ?? 0),
      ),
      summary: `${factual.summary} ${judgement.summary}`,
      // Only the judge consults knowledge, so its provenance passes straight through.
      ...(judgement.knowledgeCitations === undefined
        ? {}
        : { knowledgeCitations: judgement.knowledgeCitations }),
    };
  }
}

/** True when no criterion is claimed by both kinds of evaluator. */
export function criteriaAreDisjoint(outcome: EvaluationOutcome): boolean {
  const factual = outcome.criterionResults.filter(
    (result) => natureOf(result.criterion) === "FACTUAL",
  );
  const semantic = outcome.criterionResults.filter(
    (result) => natureOf(result.criterion) === "SEMANTIC",
  );
  const names = new Set(factual.map((result) => result.criterion));

  return semantic.every((result) => !names.has(result.criterion));
}
