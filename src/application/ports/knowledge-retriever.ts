export interface KnowledgeQuery {
  readonly text: string;
  readonly topK: number;
  readonly categories?: readonly string[];
}

export interface KnowledgeChunk {
  readonly id: string;
  readonly documentId: string;
  readonly content: string;
  readonly score: number;
  readonly knowledgeVersion: string;
  readonly category?: string;
}

/**
 * Contract only. The evaluation engine must not learn whether retrieval is
 * pgvector, keyword search, or hybrid.
 */
export interface KnowledgeRetriever {
  retrieve(query: KnowledgeQuery): Promise<readonly KnowledgeChunk[]>;
}
