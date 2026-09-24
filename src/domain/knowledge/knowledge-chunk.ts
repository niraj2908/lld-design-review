import type { KnowledgeDocumentSummary } from "./knowledge-document";

/**
 * One retrievable piece of a document.
 *
 * It holds no embedding. A vector is how a store finds this chunk, not something
 * the chunk is, and keeping it out means nothing in the core has an opinion about
 * dimensions, distance metrics or index types.
 */
export interface KnowledgeChunk {
  readonly id: string;
  readonly documentId: string;
  /** Position in the document, so retrieved material can be read back in order. */
  readonly chunkIndex: number;
  readonly content: string;
  readonly metadata: KnowledgeChunkMetadata;
}

export interface KnowledgeChunkMetadata {
  readonly topic: string;
  readonly problemSlug?: string;
  readonly concepts: readonly string[];
}

/** A chunk paired with the vector a store will search it by. */
export interface EmbeddedKnowledgeChunk {
  readonly chunk: KnowledgeChunk;
  readonly embedding: readonly number[];
}

/** A chunk found by a search, with enough context to cite it. */
export interface RetrievedKnowledge {
  readonly chunk: KnowledgeChunk;
  readonly document: KnowledgeDocumentSummary;
  /** Higher is closer. Comparable within one result set, not across queries. */
  readonly score: number;
}
