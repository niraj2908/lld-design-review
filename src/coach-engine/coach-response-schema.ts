import { z } from "zod";
import {
  evidenceSchema,
  requireAllProperties,
} from "@/evaluation-engine/ai/ai-response-schema";
import { DETERMINISTIC_CRITERIA } from "@/domain/evaluation/review-criterion";
import { EVALUATION_CRITERIA } from "@/domain/problem/rubric";
import { COACH_CERTAINTIES } from "@/domain/coach/coach-answer";
import type { JsonSchema } from "@/application/ports/llm-provider";

/** Every criterion the coach may plausibly cite — the union of both evaluators'. */
const ALL_CRITERIA = [...DETERMINISTIC_CRITERIA, ...EVALUATION_CRITERIA] as const;

const observationSchema = z.object({
  text: z.string().min(1).max(500),
  evidence: z.array(evidenceSchema).min(1).max(6),
});

const recommendationSchema = z.object({
  suggestion: z.string().min(1).max(400),
  rationale: z.string().min(1).max(800),
});

/**
 * The wire contract for one coach answer, as the model must produce it.
 *
 * `evidence` on an observation is required and non-empty here: an observation
 * about the learner's own design with nothing to point at is not something this
 * schema lets through, the same rule `AIReview` applies to a concern. Whether
 * that evidence actually appears in the submitted design is checked afterwards,
 * by the domain's own `validateEvidence` — this schema only enforces shape.
 */
export const coachAnswerSchema = z.object({
  answer: z.string().min(1).max(2000),
  observations: z.array(observationSchema).max(8),
  // `.nullable()` alongside `.optional()`: an omitted key still parses (every
  // existing test fixture, and any non-strict caller), while `requireAllProperties`
  // below makes the *generated JSON Schema* list the key as required with a
  // nullable type — what a strict-structured-output provider needs to always
  // emit it, using `null` to say "no recommendation" instead of omitting the key.
  recommendation: recommendationSchema.nullable().optional(),
  evaluationReferences: z.array(z.enum(ALL_CRITERIA)).max(6).default([]),
  certainty: z.enum(COACH_CERTAINTIES),
  followUpQuestion: z.string().min(1).max(300).nullable().optional(),
});

export type CoachModelOutput = z.infer<typeof coachAnswerSchema>;

export const COACH_ANSWER_SCHEMA_NAME = "design_coach_answer";

export const coachAnswerJsonSchema: JsonSchema = z.toJSONSchema(coachAnswerSchema, {
  target: "draft-7",
  override: requireAllProperties,
});
