import { z } from "zod";
import { CRITERION_ASSESSMENTS } from "@/domain/evaluation/criterion-result";
import { EVIDENCE_FIELDS } from "@/domain/evaluation/evidence-validation";
import { FEEDBACK_PRIORITIES } from "@/domain/feedback/feedback-item";
import { EVALUATION_CRITERIA } from "@/domain/problem/rubric";
import type { JsonSchema } from "@/application/ports/llm-provider";

const evidenceSchema = z.object({
  entity: z.string().min(1),
  field: z.enum(EVIDENCE_FIELDS).optional(),
  value: z.string().min(1).optional(),
});

const criterionSchema = z.object({
  criterion: z.enum(EVALUATION_CRITERIA),
  assessment: z.enum(CRITERION_ASSESSMENTS),
  evidence: z.array(evidenceSchema).max(8),
  concern: z.string().min(1).max(600).optional(),
  suggestion: z.string().min(1).max(600).optional(),
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
  reconsider: z.string().min(1).max(600).optional(),
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
});
