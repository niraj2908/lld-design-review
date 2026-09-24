import type { EvaluationContext } from "@/application/ports/evaluator";
import type { KnowledgeContextRequest } from "@/application/ports/knowledge-context";
import type { StructuredDesign } from "@/domain/design/structured-design";
import type { Problem } from "@/domain/problem/problem";
import type { EvaluationOutcome } from "@/domain/evaluation/evaluation-outcome";
import { AI_CRITERIA } from "./ai-criteria";

/** How many principle passages and how many problem-guidance passages to ask for. */
export const KNOWLEDGE_RETRIEVAL_LIMITS = {
  principles: 5,
  problemGuidance: 2,
} as const;

/** Characters of reference knowledge the prompt will carry, at most. */
export const KNOWLEDGE_BUDGET_CHARS = 5_000;

const MAX_REQUIREMENTS_IN_QUERY = 6;
const MAX_FINDING_CODES_IN_QUERY = 6;

/**
 * Builds the retrieval queries for one review.
 *
 * Two of them, deliberately: general design principles and guidance written for
 * this problem compete for the same slots in a single query, and separating them by
 * metadata filter makes what comes back predictable. Two round trips is also the
 * ceiling — one query per criterion would multiply latency for material that
 * overlaps heavily anyway.
 *
 * The query text is assembled from the platform's own vocabulary, the problem
 * author's requirement titles, and *shapes* read off the submitted design. No
 * learner prose goes into it: a responsibility or a decision is untrusted text, and
 * a retrieval query is not the place to find out what it does.
 */
export function buildKnowledgeRequests(
  context: EvaluationContext,
): readonly KnowledgeContextRequest[] {
  const { problem, submission } = context;
  const cues = designCues(submission.payload);
  const findings = findingCodes(context.deterministicOutcome);

  const principles = [
    `Design review of a low-level design for the problem "${problem.title}".`,
    `Assess these aspects: ${AI_CRITERIA.join(", ")}.`,
    requirementFocus(problem),
    cues.length === 0
      ? ""
      : `Shape of the submitted design: ${cues.join(", ")}.`,
    findings.length === 0
      ? ""
      : `Structural findings already established: ${findings.join(", ")}.`,
  ]
    .filter((line) => line.length > 0)
    .join(" ");

  return [
    {
      query: principles,
      limit: KNOWLEDGE_RETRIEVAL_LIMITS.principles,
      budgetChars: KNOWLEDGE_BUDGET_CHARS,
      filter: {
        topics: ["OOP", "SOLID", "PATTERN", "DESIGN_SMELL", "LLD_REASONING"],
      },
    },
    {
      query: `What this problem is really about: ${problem.title}. ${requirementFocus(problem)}`,
      limit: KNOWLEDGE_RETRIEVAL_LIMITS.problemGuidance,
      budgetChars: KNOWLEDGE_BUDGET_CHARS,
      // Guidance is tagged with the problem it was written for, so this is a
      // metadata lookup rather than a hope that similarity finds the right one.
      filter: { problemSlugs: [problem.slug] },
    },
  ];
}

function requirementFocus(problem: Problem): string {
  const titles = problem.requirements
    .filter((requirement) => requirement.priority === "MUST")
    .slice(0, MAX_REQUIREMENTS_IN_QUERY)
    .map((requirement) => requirement.title);

  return titles.length === 0
    ? ""
    : `Requirements in focus: ${titles.join("; ")}.`;
}

function findingCodes(
  outcome: EvaluationOutcome | undefined,
): readonly string[] {
  if (outcome === undefined) {
    return [];
  }
  const codes = outcome.priorityImprovements
    .map((item) => item.code)
    .filter((code): code is string => code !== undefined);

  return [...new Set(codes)].slice(0, MAX_FINDING_CODES_IN_QUERY);
}

/**
 * Concept words implied by the design's structure.
 *
 * These are counts and relationship kinds, never the learner's words, so a
 * submission cannot steer retrieval by what it says. They are what makes retrieval
 * differ between two designs for the same problem: a design with no abstraction at
 * all and one with a seam behind every collaborator need different reading.
 */
export function designCues(design: StructuredDesign): readonly string[] {
  const cues: string[] = [];

  cues.push(
    `${design.classes.length} classes and ${design.interfaces.length} interfaces`,
  );

  if (design.interfaces.length === 0) {
    cues.push("no interfaces declared, abstraction and premature abstraction");
  } else if (design.interfaces.length >= design.classes.length) {
    cues.push("many interfaces relative to classes, premature abstraction");
  }

  const kinds = new Set(design.relationships.map((entry) => String(entry.type)));
  if (kinds.has("INHERITANCE")) {
    cues.push("inheritance used, substitutability");
  }
  if (kinds.has("COMPOSITION") || kinds.has("AGGREGATION")) {
    cues.push("composition used");
  }
  if (kinds.has("DEPENDENCY") || kinds.has("ASSOCIATION")) {
    cues.push("dependencies between elements, coupling and dependency direction");
  }

  const busiest = busiestElement(design);
  if (busiest >= 4) {
    cues.push("one element with many relationships, cohesion and god object");
  }

  if (design.decisions.length === 0) {
    cues.push("no recorded design decisions, design reasoning");
  }
  if (design.edgeCases.length === 0) {
    cues.push("no recorded edge cases, edge case reasoning");
  }

  return cues;
}

function busiestElement(design: StructuredDesign): number {
  const counts = new Map<string, number>();
  for (const relationship of design.relationships) {
    for (const endpoint of [relationship.source, relationship.target]) {
      counts.set(endpoint, (counts.get(endpoint) ?? 0) + 1);
    }
  }
  return Math.max(0, ...counts.values());
}
