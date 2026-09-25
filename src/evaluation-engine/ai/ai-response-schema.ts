import { z, core } from "zod";
import { CRITERION_ASSESSMENTS } from "@/domain/evaluation/criterion-result";
import { EVIDENCE_FIELDS } from "@/domain/evaluation/evidence-validation";
import { FEEDBACK_PRIORITIES } from "@/domain/feedback/feedback-item";
import { EVALUATION_CRITERIA } from "@/domain/problem/rubric";
import type { Evidence } from "@/domain/feedback/evidence";
import type { JsonSchema } from "@/application/ports/llm-provider";

/**
 * A field that reads as absent to the domain (`undefined`) but that a
 * strict-structured-output model must still always emit, so "absent" is
 * spelled `null` on the wire instead. `.optional()` is kept alongside
 * `.nullable()` so a caller that omits the key entirely — every existing test
 * fixture, and any non-strict caller — still parses exactly as before;
 * `requireAllProperties` (below) is what actually makes the *generated JSON
 * Schema* list the key as required, independent of this Zod-level leniency.
 */
function optionalNullable<T extends z.ZodType>(schema: T) {
  return schema.nullable().optional();
}

/**
 * Reads one of the fields `optionalNullable` wraps back into the domain's own
 * "absent" idiom: both a missing key (`undefined`, from a lenient caller) and
 * an explicit `null` (from a strict-mode model with nothing to say) collapse
 * to `undefined` here, so nothing downstream needs to know the wire form.
 */
export function presentOrUndefined<T>(value: T | null | undefined): T | undefined {
  return value === null || value === undefined ? undefined : value;
}

/**
 * `override` for `z.toJSONSchema`: strict structured-output providers (Groq,
 * OpenAI) require every property of every object — at every nesting depth —
 * to be listed in `required`, using a nullable type to express "optional"
 * rather than omitting the key from `required`. This is the one place that
 * rule is applied, so `aiReviewJsonSchema` and `coachAnswerJsonSchema` cannot
 * drift on it. It does not relax anything: pairing `.nullable()` above with
 * `required` here is what makes strict mode's own contract satisfiable
 * without weakening what `aiReviewSchema`/`coachAnswerSchema` will accept.
 */
export const requireAllProperties: NonNullable<core.ToJSONSchemaParams["override"]> = (
  ctx,
) => {
  if (ctx.jsonSchema.type === "object" && ctx.jsonSchema.properties !== undefined) {
    ctx.jsonSchema.required = Object.keys(ctx.jsonSchema.properties);
  }
};

/** Shared with the coach engine's response schema: the same evidence shape, one definition. */
export const evidenceSchema = z.object({
  entity: z.string().min(1),
  field: optionalNullable(z.enum(EVIDENCE_FIELDS)),
  value: optionalNullable(z.string().min(1)),
});

/**
 * Maps one wire-shape evidence item back to the domain's `Evidence` — the
 * only place `null` vs `undefined` is reconciled for evidence, so
 * `validateEvidence` keeps seeing exactly the shape it always has.
 */
export function toDomainEvidence(item: z.infer<typeof evidenceSchema>): Evidence {
  const field = presentOrUndefined(item.field);
  const value = presentOrUndefined(item.value);
  return {
    entity: item.entity,
    ...(field === undefined ? {} : { field }),
    ...(value === undefined ? {} : { value }),
  };
}

const criterionSchema = z.object({
  criterion: z.enum(EVALUATION_CRITERIA),
  assessment: z.enum(CRITERION_ASSESSMENTS),
  evidence: z.array(evidenceSchema).max(8),
  concern: optionalNullable(z.string().min(1).max(600)),
  suggestion: optionalNullable(z.string().min(1).max(600)),
  // Rejecting an out-of-range value outright is safer than clamping it: a model
  // that answers 4.2 has misunderstood the field, and silently rewriting that to
  // 1 would hide the misunderstanding behind a confident-looking number.
  confidence: z.number().min(0).max(1),
});

const improvementSchema = z.object({
  criterion: z.enum(EVALUATION_CRITERIA),
  priority: z.enum(FEEDBACK_PRIORITIES),
  what: z.string().min(1).max(400),
  where: z.array(evidenceSchema).max(8),
  why: z.string().min(1).max(600),
  reconsider: optionalNullable(z.string().min(1).max(600)),
});

export const aiReviewSchema = z.object({
  criteria: z.array(criterionSchema).min(1).max(12),
  strengths: z.array(z.string().min(1).max(400)).max(10),
  priorityImprovements: z.array(improvementSchema).max(12),
  summary: z.string().min(1).max(1200),
});

export type AIReview = z.infer<typeof aiReviewSchema>;

export const AI_REVIEW_SCHEMA_NAME = "design_review";

/**
 * The same contract expressed as JSON Schema for the provider to constrain
 * generation with. It is generated from the Zod schema so the two cannot drift,
 * and the Zod schema still re-validates the answer: a provider's schema mode is
 * a strong hint, not a guarantee.
 */
export const aiReviewJsonSchema: JsonSchema = z.toJSONSchema(aiReviewSchema, {
  target: "draft-7",
  override: requireAllProperties,
});
