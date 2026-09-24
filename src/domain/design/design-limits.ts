export interface DesignLimits {
  readonly maxClasses: number;
  readonly maxInterfaces: number;
  readonly maxRelationships: number;
  readonly maxDecisions: number;
  readonly maxEdgeCases: number;
  readonly maxRequirementMappings: number;
  readonly maxNameLength: number;
  readonly maxTextLength: number;
}

/**
 * Submission size bounds keep a single design inside a promptable and
 * reviewable range. They are configuration rather than product rules, so they
 * are injectable wherever validation happens.
 */
export const DEFAULT_DESIGN_LIMITS: DesignLimits = {
  maxClasses: 60,
  maxInterfaces: 40,
  maxRelationships: 200,
  maxDecisions: 40,
  maxEdgeCases: 60,
  maxRequirementMappings: 200,
  maxNameLength: 120,
  maxTextLength: 2000,
};
