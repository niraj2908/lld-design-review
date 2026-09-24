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
  retrieve(query: KnowledgeQuery): Promise<readonly RetrievedKnowledge[]>;
}
