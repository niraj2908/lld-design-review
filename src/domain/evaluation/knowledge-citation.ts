/**
 * A record of one piece of reference knowledge that was put in front of the judge.
 *
 * It answers "what knowledge influenced this evaluation?" without storing the
 * passage again: the chunk id and the document version are enough to fetch the
 * exact text back, and the embedding model says how it was found. It is
 * deliberately not evidence — evidence is something the learner wrote, and the two
 * are kept apart everywhere they appear.
 */
export interface KnowledgeCitation {
  /** Label the prompt used for this passage, for example `K1`. */
  readonly ref: string;
  /** Rank in the retrieval result, 1-based, so a reader can see what came first. */
  readonly rank: number;
  readonly chunkId: string;
  readonly documentId: string;
  readonly title: string;
  readonly source: string;
  readonly topic: string;
  /** Version of the knowledge document, so the passage can be fetched as it was. */
  readonly documentVersion: string;
  /** Higher is closer. Comparable within one evaluation, not across evaluations. */
  readonly score: number;
  /** Which model produced the vectors this passage was found with. */
  readonly embeddingModel: string;
}
