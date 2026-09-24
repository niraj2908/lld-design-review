import type { DesignElementIndex } from "@/domain/design/design-element-index";
import type { StructuredDesign } from "@/domain/design/structured-design";
import type { Evidence } from "@/domain/feedback/evidence";
import type { Requirement } from "@/domain/problem/requirement";
import type { Finding, RuleAnalysis } from "./rule-analysis";

export const REQUIREMENT_COVERAGE_STATES = [
  "COVERED",
  "PARTIALLY_COVERED",
  "NOT_COVERED",
] as const;

export type RequirementCoverageState =
  (typeof REQUIREMENT_COVERAGE_STATES)[number];

export interface RequirementCoverage {
  readonly requirement: Requirement;
  readonly state: RequirementCoverageState;
  readonly evidence: readonly Evidence[];
  /** References the learner wrote that do not name an element of this design. */
  readonly danglingReferences: readonly string[];
}

/**
 * Coverage is decided only by what the learner mapped explicitly.
 *
 * A class called `PaymentProcessor` is not evidence that a payment requirement is
 * addressed: the name is a guess about meaning, and guessing is what the
 * deterministic evaluator must not do. Only a requirement mapping counts, so a
 * design with different names or a different decomposition is never penalised for
 * the shape it chose.
 */
export function classifyRequirementCoverage(
  requirements: readonly Requirement[],
  design: StructuredDesign,
  elements: DesignElementIndex,
): readonly RequirementCoverage[] {
  return requirements.map((requirement) => {
    const mappings = design.requirementMappings.filter(
      (mapping) => mapping.requirementId === requirement.id,
    );
    const references = mappings.flatMap((mapping) => mapping.references);
    const resolved = references.filter((reference) =>
      elements.has(reference.entity),
    );
    const dangling = references
      .filter((reference) => !elements.has(reference.entity))
      .map((reference) => reference.entity);

    const evidence: readonly Evidence[] = resolved.map((reference) => ({
      entity: reference.entity.trim(),
      field: "requirementMappings",
      value: requirement.code,
    }));

    if (resolved.length === 0) {
      return {
        requirement,
        state: "NOT_COVERED",
        evidence,
        danglingReferences: dangling,
      };
    }

    return {
      requirement,
      // Some evidence resolves and some does not: the learner pointed at the
      // requirement but part of what they pointed at is not in the design.
      state: dangling.length > 0 ? "PARTIALLY_COVERED" : "COVERED",
      evidence,
      danglingReferences: dangling,
    };
  });
}

export function analyseRequirementCoverage(
  coverage: readonly RequirementCoverage[],
): RuleAnalysis {
  const covered = coverage.filter((entry) => entry.state === "COVERED");
  const partial = coverage.filter((entry) => entry.state === "PARTIALLY_COVERED");
  const missing = coverage.filter((entry) => entry.state === "NOT_COVERED");

  const findings: readonly Finding[] = [
    ...missing.map<Finding>((entry) => ({
      code: "REQUIREMENT_NOT_COVERED",
      priority: entry.requirement.priority === "MUST" ? "P0" : "P2",
      what: `No design element is mapped to ${entry.requirement.code} — ${entry.requirement.title}.`,
      where: [],
      why: `The requirement states: ${entry.requirement.description} Without a mapping there is no way to tell which part of the design is meant to satisfy it.`,
      reconsider:
        "Map the element that carries this responsibility to the requirement, or add the element if it is genuinely missing.",
    })),
    ...partial.map<Finding>((entry) => ({
      code: "REQUIREMENT_PARTIALLY_COVERED",
      priority: "P2",
      what: `${entry.requirement.code} is mapped, but ${entry.danglingReferences.length} of its references name something that is not in this design: ${entry.danglingReferences.join(", ")}.`,
      where: entry.evidence,
      why: "A reference to an element that does not exist cannot be checked, so part of the claimed evidence is unverifiable.",
      reconsider:
        "Correct the reference to name an element of this design, or add the element it refers to.",
    })),
  ];

  const assessment =
    missing.length > 0
      ? "NEEDS_IMPROVEMENT"
      : partial.length > 0
        ? "NEEDS_IMPROVEMENT"
        : coverage.length === 0
          ? "MISSING"
          : "ADEQUATE";

  const strengths =
    covered.length === 0
      ? []
      : [
          `${covered.length} of ${coverage.length} requirements carry explicit design evidence: ${covered
            .map((entry) => entry.requirement.code)
            .join(", ")}.`,
        ];

  const base: RuleAnalysis = {
    criterion: "REQUIREMENT_COVERAGE",
    assessment,
    evidence: covered.flatMap((entry) => entry.evidence),
    strengths,
    findings,
  };

  if (missing.length === 0 && partial.length === 0) {
    return base;
  }

  return {
    ...base,
    concern: `${missing.length} requirements have no mapping and ${partial.length} are mapped to elements that do not exist.`,
    suggestion:
      "Map each requirement to the element that satisfies it. Any decomposition is acceptable; the mapping is what makes it reviewable.",
  };
}
