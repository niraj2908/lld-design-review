import type { RetrievedKnowledge } from "@/domain/knowledge/knowledge-chunk";
import type { KnowledgeFilter } from "./knowledge-repository";

export interface KnowledgeQuery {
  /** What the caller wants to know about, in its own words. */
  readonly text: string;
  readonly limit: number;
  readonly filter?: KnowledgeFilter;
}

/**
 * Contract only. A caller must not learn whether retrieval is pgvector, keyword
 * search, or hybrid.
 */
export interface KnowledgeRetriever {
  /**
   * Which model produced the vectors this retriever searches by, recorded on every
   * evaluation that consults it. A lexically filled store and a semantic one are
   * indistinguishable from a result alone; this is how they stay distinguishable in
   * the record.
   */
  readonly embeddingModel: string;
  retrieve(query: KnowledgeQuery): Promise<readonly RetrievedKnowledge[]>;
}
