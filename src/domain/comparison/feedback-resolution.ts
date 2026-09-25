import { buildDesignElementIndex } from "../design/design-element-index";
import type { StructuredDesign } from "../design/structured-design";
import type { FeedbackItem } from "../feedback/feedback-item";

export const FEEDBACK_RESOLUTION_STATUSES = [
  "ADDRESSED",
  "STILL_PRESENT",
  "UNCERTAIN",
  "NOT_COMPARABLE",
] as const;

export type FeedbackResolutionStatus =
  (typeof FEEDBACK_RESOLUTION_STATUSES)[number];

export interface FeedbackResolution {
  readonly feedbackId: string;
  readonly status: FeedbackResolutionStatus;
  /** Entity names the original finding's evidence pointed at, in evidence order. */
  readonly referencedEntities: readonly string[];
  /** Which of those names still exist, under that exact name, in the later design. */
  readonly entitiesStillPresent: readonly string[];
  /** Which of those names are no longer present under that exact name. */
  readonly entitiesRemoved: readonly string[];
  /**
   * A hedged, human sentence explaining the status. Never claims a concern was
   * "fixed" or "solved" — the strongest wording this produces is "likely
   * addressed", because a deterministic structural check cannot confirm quality.
   */
  readonly detail: string;
}

/**
 * Checks a prior evaluation's findings against a later, independently submitted
 * design — deterministically, with no model call.
 *
 * The rule is deliberately conservative, in this priority order:
 *
 * 1. `NOT_COMPARABLE` — the finding carried no evidence, so there is nothing
 *    concrete to re-check it against.
 * 2. `STILL_PRESENT` — the exact text the finding quoted is still there, on the
 *    same named entity. This is checked first and wins over any other signal,
 *    because it is the one case where overclaiming resolution would be a real
 *    false positive: the literal problem is unmistakably still in the design.
 * 3. `ADDRESSED` — every entity the finding named is gone from the later design
 *    under that exact name. This is the strongest deterministic signal available
 *    that the finding's target changed, matching the case the product exists to
 *    detect (`ParkingLot` dissolving into `SpotAllocator` and `PaymentService`).
 *    It is not proof the underlying concern was resolved well, only that its
 *    named target no longer exists — wording says "likely", never "solved".
 * 4. `UNCERTAIN` — anything else: some referenced entities remain and some do
 *    not, or a referenced entity remains but its quoted text changed. Something
 *    changed, but a deterministic check cannot say the concern is settled.
 */
export function resolveFeedback(
  previousFeedback: readonly FeedbackItem[],
  laterDesign: StructuredDesign,
): readonly FeedbackResolution[] {
  const elements = buildDesignElementIndex(laterDesign);

  return previousFeedback.map((item): FeedbackResolution => {
    if (item.where.length === 0) {
      return {
        feedbackId: item.id,
        status: "NOT_COMPARABLE",
        referencedEntities: [],
        entitiesStillPresent: [],
        entitiesRemoved: [],
        detail:
          "This finding was not tied to a specific part of the design, so it cannot be checked against the later attempt.",
      };
    }

    const referencedEntities = [
      ...new Set(item.where.map((evidence) => evidence.entity.trim())),
    ];
    const entitiesStillPresent = referencedEntities.filter((name) =>
      elements.has(name),
    );
    const entitiesRemoved = referencedEntities.filter(
      (name) => !elements.has(name),
    );

    const literalTextStillPresent = item.where.some((evidence) => {
      if (evidence.value === undefined) {
        return false;
      }
      const entityName = evidence.entity.trim();
      return (
        elements.has(entityName) &&
        textAppears(laterDesign, entityName, evidence.field, evidence.value)
      );
    });

    if (literalTextStillPresent) {
      return {
        feedbackId: item.id,
        status: "STILL_PRESENT",
        referencedEntities,
        entitiesStillPresent,
        entitiesRemoved,
        detail:
          "The exact text this finding quoted is still in the design, unchanged.",
      };
    }

    if (entitiesRemoved.length === referencedEntities.length) {
      return {
        feedbackId: item.id,
        status: "ADDRESSED",
        referencedEntities,
        entitiesStillPresent,
        entitiesRemoved,
        detail: `${listOf(entitiesRemoved)} no longer appear${entitiesRemoved.length === 1 ? "s" : ""} in the design under that name — likely addressed by a structural change. This does not confirm the underlying concern was actually settled, only that what it pointed at changed.`,
      };
    }

    return {
      feedbackId: item.id,
      status: "UNCERTAIN",
      referencedEntities,
      entitiesStillPresent,
      entitiesRemoved,
      detail:
        "Something related to this finding changed, but not enough to say whether the concern itself was addressed.",
    };
  });
}

function listOf(names: readonly string[]): string {
  return names.join(", ");
}

/**
 * Whether `value` still appears, case- and whitespace-insensitively, in the part
 * of `entityName` that `field` names — or anywhere belonging to it, when no field
 * was named. Mirrors the containment check `validateEvidence` uses to ground new
 * evidence, applied here to ask whether old evidence still holds.
 */
function textAppears(
  design: StructuredDesign,
  entityName: string,
  field: string | undefined,
  value: string,
): boolean {
  const needle = normalize(value);
  if (needle.length === 0) {
    return false;
  }
  return textFor(design, entityName, field).some((haystack) =>
    normalize(haystack).includes(needle),
  );
}

function textFor(
  design: StructuredDesign,
  entityName: string,
  field: string | undefined,
): readonly string[] {
  const definition = design.classes.find(
    (candidate) => candidate.name.trim() === entityName,
  );
  const contract = design.interfaces.find(
    (candidate) => candidate.name.trim() === entityName,
  );

  const responsibility = definition?.responsibility ?? contract?.responsibility;
  const attributes = (definition?.attributes ?? []).flatMap((attribute) => [
    attribute.name,
    attribute.type ?? "",
  ]);
  const methods = [
    ...(definition?.methods ?? []),
    ...(contract?.methods ?? []),
  ].flatMap((method) => [
    method.name,
    method.signature ?? "",
    method.description ?? "",
  ]);
  const relationships = design.relationships
    .filter(
      (relationship) =>
        relationship.source.trim() === entityName ||
        relationship.target.trim() === entityName,
    )
    .flatMap((relationship) => [
      relationship.source,
      relationship.target,
      String(relationship.type),
      relationship.rationale ?? "",
    ]);

  switch (field) {
    case "responsibility":
      return responsibility === undefined ? [] : [responsibility];
    case "attributes":
      return attributes;
    case "methods":
      return methods;
    case "relationships":
      return relationships;
    default:
      return [responsibility ?? "", ...attributes, ...methods, ...relationships];
  }
}

function normalize(value: string): string {
  return value.trim().replaceAll(/\s+/gu, " ").toLowerCase();
}
