import type {
  DesignEvaluator,
  EvaluationContext,
} from "@/application/ports/evaluator";
import { buildDesignElementIndex } from "@/domain/design/design-element-index";
import { validateStructuredDesign } from "@/domain/design/design-validator";
import type { EvaluationOutcome } from "@/domain/evaluation/evaluation-outcome";
import { blockingIssues } from "@/domain/shared/validation";
import { composeOutcome } from "./compose-outcome";
import { analyseDesignCompleteness } from "./rules/design-completeness";
import { analyseDesignDecisions } from "./rules/design-decisions";
import { analyseEdgeCaseCoverage } from "./rules/edge-case-coverage";
import {
  analyseRequirementCoverage,
  classifyRequirementCoverage,
} from "./rules/requirement-coverage";
import { analyseStructuralValidity } from "./rules/structural-validity";

/**
 * Bump when a rule changes what it reports. Stored on every evaluation, so a
 * result can always be traced to the rules that produced it.
 */
export const RULE_EVALUATOR_VERSION = "rules-v1";

/**
 * Reports what can be established from the submission and the problem, and
 * nothing else.
 *
 * It does not judge cohesion, coupling, abstraction or pattern choice, and it
 * holds no reference design to compare against: a learner who solved the problem
 * with three classes instead of eight is not penalised for it. Everything it
 * reports is a fact a reader can verify in the submitted design, which is what
 * makes it safe to run before, and alongside, a judge that cannot.
 */
export class RuleBasedEvaluator implements DesignEvaluator {
  readonly version = RULE_EVALUATOR_VERSION;

  async evaluate(context: EvaluationContext): Promise<EvaluationOutcome> {
    const design = context.submission.payload;
    const requirements = context.problem.requirements;
    const elements = buildDesignElementIndex(design);

    // One validation pass, reported under the criteria the issues belong to. The
    // engine adds no design rules of its own.
    const validation = validateStructuredDesign(design, {
      requirementIds: context.problem.requirementIds,
    });
    const issues = validation.issues;

    const coverage = classifyRequirementCoverage(requirements, design, elements);

    return composeOutcome({
      analyses: [
        analyseStructuralValidity({ issues, design, elements }),
        analyseRequirementCoverage(coverage),
        analyseDesignCompleteness({ issues, design, elements }),
        analyseEdgeCaseCoverage(design),
        analyseDesignDecisions(design),
      ],
      coverage,
      blockingIssueCount: blockingIssues(validation).length,
    });
  }
}
