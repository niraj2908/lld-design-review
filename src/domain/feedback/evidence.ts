/**
 * A pointer into the learner's own submission. Every substantive concern must
 * carry at least one, so feedback can be checked against the design instead of
 * being taken on trust.
 */
export interface Evidence {
  readonly entity: string;
  readonly field?: string;
  readonly value?: string;
}
