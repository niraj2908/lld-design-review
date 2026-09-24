import type {
  EmbeddedKnowledgeChunk,
  RetrievedKnowledge,
} from "@/domain/knowledge/knowledge-chunk";
import type { KnowledgeDocument } from "@/domain/knowledge/knowledge-document";
import type { KnowledgeTopic } from "@/domain/knowledge/knowledge-topic";

/**
 * Narrowing applied before similarity is considered.
 *
 * Deliberately small. Filtering is for keeping a query inside material that can
 * possibly apply — guidance for this problem, this topic — not a query language.
 */
export interface KnowledgeFilter {
  readonly topics?: readonly KnowledgeTopic[];
  readonly problemSlugs?: readonly string[];
  readonly sources?: readonly string[];
}

export interface KnowledgeSearch {
  readonly embedding: readonly number[];
  readonly limit: number;
  readonly filter?: KnowledgeFilter;
}

export interface KnowledgeRepository {
  /** The vector length this store was built for. */
  readonly embeddingDimensions: number;

  /**
   * Writes a document and the whole of its chunk set, replacing any chunks
   * previously stored for it. Replacing rather than appending is what makes
   * ingestion rerunnable without accumulating duplicates.
   */
  replaceDocument(input: {
    readonly document: KnowledgeDocument;
    readonly chunks: readonly EmbeddedKnowledgeChunk[];
  }): Promise<void>;

  search(search: KnowledgeSearch): Promise<readonly RetrievedKnowledge[]>;

  findDocumentById(documentId: string): Promise<KnowledgeDocument | null>;
  countDocuments(): Promise<number>;
  countChunks(): Promise<number>;
}
