import { z } from "zod";
import { RELATIONSHIP_TYPES } from "@/domain/design/relationship-type";
import { DEFAULT_DESIGN_LIMITS } from "@/domain/design/design-limits";
import {
  MAX_QUESTION_LENGTH,
  MIN_QUESTION_LENGTH,
} from "@/application/use-cases/ask-design-coach";

const name = z.string().trim().max(DEFAULT_DESIGN_LIMITS.maxNameLength);
const text = z.string().trim().max(DEFAULT_DESIGN_LIMITS.maxTextLength);

const attribute = z.object({
  name,
  type: name.optional(),
});

const method = z.object({
  name,
  signature: name.optional(),
  description: text.optional(),
});

/**
 * The wire shape of a structured design.
 *
 * It checks shape and size only. Whether the design holds together — unique names,
 * endpoints that exist, requirements that belong to this problem — is decided by
 * `validateStructuredDesign` in the domain, and re-checking any of it here would
 * create a second set of rules to keep in step with the first.
 *
 * Size limits are the exception, because an oversized body should be refused before
 * it is parsed into objects rather than after.
 */
export const structuredDesignSchema = z.object({
  classes: z
    .array(
      z.object({
        id: name.optional(),
        name,
        responsibility: text,
        attributes: z.array(attribute).max(64).default([]),
        methods: z.array(method).max(64).default([]),
      }),
    )
    .max(DEFAULT_DESIGN_LIMITS.maxClasses)
    .default([]),
  interfaces: z
    .array(
      z.object({
        id: name.optional(),
        name,
        responsibility: text,
        methods: z.array(method).max(64).default([]),
      }),
    )
    .max(DEFAULT_DESIGN_LIMITS.maxInterfaces)
    .default([]),
  relationships: z
    .array(
      z.object({
        source: name,
        target: name,
        type: z.enum(RELATIONSHIP_TYPES),
        cardinality: name.optional(),
        rationale: text.optional(),
      }),
    )
    .max(DEFAULT_DESIGN_LIMITS.maxRelationships)
    .default([]),
  decisions: z
    .array(
      z.object({
        decision: text,
        rationale: text,
        tradeoff: text,
      }),
    )
    .max(DEFAULT_DESIGN_LIMITS.maxDecisions)
    .default([]),
  edgeCases: z
    .array(
      z.object({
        description: text,
        expectedBehavior: text,
      }),
    )
    .max(DEFAULT_DESIGN_LIMITS.maxEdgeCases)
    .default([]),
  requirementMappings: z
    .array(
      z.object({
        requirementId: name,
        references: z
          .array(
            z.object({
              entity: name,
              field: name.optional(),
              value: text.optional(),
            }),
          )
          .max(16)
          .default([]),
        note: text.optional(),
      }),
    )
    .max(DEFAULT_DESIGN_LIMITS.maxRequirementMappings)
    .default([]),
});

export type StructuredDesignInput = z.infer<typeof structuredDesignSchema>;

export const saveDraftSchema = z.object({ design: structuredDesignSchema });

export const submitSchema = z.object({
  /** Omit to submit whatever draft is stored. */
  design: structuredDesignSchema.optional(),
});

/** Ids are opaque to the client; this only stops obvious nonsense reaching a query. */
export const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/u, "Expected an identifier.");

/**
 * The bounds are `AskDesignCoach`'s own — imported rather than restated, so the
 * API rejects an out-of-range question before it is even parsed into a request,
 * and the use case's own check (for a caller that reaches it directly) can never
 * silently drift from what the wire schema already enforced.
 */
export const askCoachSchema = z.object({
  question: z
    .string()
    .trim()
    .min(MIN_QUESTION_LENGTH)
    .max(MAX_QUESTION_LENGTH),
});
