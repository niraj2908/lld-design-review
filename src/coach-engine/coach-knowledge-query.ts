import type { CoachContext } from "@/application/ports/design-coach";
import type { KnowledgeContextRequest } from "@/application/ports/knowledge-context";
import { designCues } from "@/evaluation-engine/ai/knowledge-query";

/** How many passages one coaching question may retrieve, and how much prompt space they may cost. */
export const COACH_KNOWLEDGE_LIMIT = 4;
export const COACH_KNOWLEDGE_BUDGET_CHARS = 3_000;

const MAX_QUESTION_CHARS_IN_QUERY = 300;

/**
 * One retrieval query per question — unlike the evaluator's two, because a
 * question is already one focused ask, not a sweep across every criterion.
 *
 * The learner's question *is* embedded here, unlike `designCues` for the
 * evaluator: answering "why is PaymentService coupled" well depends on
 * retrieving passages about coupling, and that only works if the query says so.
 * What still never goes in is the learner's design prose — only the same
 * structural cues (counts, relationship kinds) the evaluator's retrieval uses,
 * so a submission's wording cannot steer what comes back, only its shape can.
 */
export function buildCoachKnowledgeRequest(
  context: CoachContext,
): KnowledgeContextRequest {
  const cues = designCues(context.design);
  const concern = mostRelevantConcern(context);

  const query = [
    `A learner is asking about their low-level design for "${context.problem.title}": ${truncate(context.question, MAX_QUESTION_CHARS_IN_QUERY)}`,
    cues.length === 0 ? "" : `Shape of the design: ${cues.join(", ")}.`,
    concern === undefined ? "" : `A prior review raised: ${concern}.`,
  ]
    .filter((line) => line.length > 0)
    .join(" ");

  return {
    query,
    limit: COACH_KNOWLEDGE_LIMIT,
    budgetChars: COACH_KNOWLEDGE_BUDGET_CHARS,
    filter: {
      topics: ["OOP", "SOLID", "PATTERN", "DESIGN_SMELL", "LLD_REASONING"],
    },
  };
}

/** The single concern most likely relevant to a follow-up question, if the design was evaluated. */
function mostRelevantConcern(context: CoachContext): string | undefined {
  const withConcern = (context.evaluation?.criterionResults ?? []).find(
    (result) => result.concern !== undefined,
  );
  return withConcern?.concern;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}
