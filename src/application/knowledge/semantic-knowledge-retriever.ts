import { EmbeddingDimensionError } from "../ports/embedding-provider";
import type { EmbeddingProvider } from "../ports/embedding-provider";
import type { KnowledgeRepository } from "../ports/knowledge-repository";
import type {
  KnowledgeQuery,
  KnowledgeRetriever,
} from "../ports/knowledge-retriever";
import type { RetrievedKnowledge } from "@/domain/knowledge/knowledge-chunk";

/** Nothing asks for more than this many chunks, whatever it requests. */
export const MAX_RETRIEVAL_LIMIT = 20;

/**
 * Retrieval expressed over two ports: embed the question, then search the store.
 *
 * It lives in the application layer rather than infrastructure because there is
 * no vendor and no SQL in it — swapping pgvector for something else replaces the
 * repository adapter and leaves this untouched.
 */
export class SemanticKnowledgeRetriever implements KnowledgeRetriever {
  constructor(
    private readonly embeddings: EmbeddingProvider,
    private readonly knowledge: KnowledgeRepository,
  ) {
    // Checked once, at construction: a provider that disagrees with the store can
    // never return a meaningful neighbour, so failing here beats failing per query.
    if (embeddings.dimensions !== knowledge.embeddingDimensions) {
      throw new EmbeddingDimensionError({
        expected: knowledge.embeddingDimensions,
        received: embeddings.dimensions,
      });
    }
  }

  async retrieve(query: KnowledgeQuery): Promise<readonly RetrievedKnowledge[]> {
    const text = query.text.trim();
    if (text.length === 0) {
      // An empty question has no nearest neighbour; returning the store's
      // arbitrary first rows would look like an answer.
      return [];
    }

    const limit = boundedLimit(query.limit);
    if (limit === 0) {
      return [];
    }

    const embedding = await this.embeddings.embed(text);
    if (embedding.length !== this.knowledge.embeddingDimensions) {
      throw new EmbeddingDimensionError({
        expected: this.knowledge.embeddingDimensions,
        received: embedding.length,
      });
    }

    return this.knowledge.search({
      embedding,
      limit,
      ...(query.filter === undefined ? {} : { filter: query.filter }),
    });
  }
}

export function boundedLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) {
    return 0;
  }
  return Math.min(Math.floor(limit), MAX_RETRIEVAL_LIMIT);
}
