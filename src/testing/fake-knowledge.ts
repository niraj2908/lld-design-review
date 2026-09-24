import type { EmbeddingProvider } from "@/application/ports/embedding-provider";
import type {
  KnowledgeFilter,
  KnowledgeRepository,
  KnowledgeSearch,
} from "@/application/ports/knowledge-repository";
import type {
  EmbeddedKnowledgeChunk,
  RetrievedKnowledge,
} from "@/domain/knowledge/knowledge-chunk";
import type { KnowledgeDocument } from "@/domain/knowledge/knowledge-document";
import { toDocumentSummary } from "@/domain/knowledge/knowledge-document";
import { embedText } from "@/infrastructure/ai/hashing-embedding-provider";

/**
 * A deterministic embedding provider for tests: the same lexical hashing the
 * offline provider uses, at whatever width a test wants, with a record of what it
 * was asked to embed.
 */
export class FakeEmbeddingProvider implements EmbeddingProvider {
  readonly name = "fake-embeddings";
  readonly model = "fake-embedding-v1";
  readonly embedded: string[] = [];

  constructor(readonly dimensions = 8) {}

  async embed(text: string): Promise<readonly number[]> {
    this.embedded.push(text);
    return embedText(text, this.dimensions);
  }

  async embedBatch(
    texts: readonly string[],
  ): Promise<readonly (readonly number[])[]> {
    this.embedded.push(...texts);
    return texts.map((text) => embedText(text, this.dimensions));
  }
}

/** Returns vectors of the wrong width, so a mismatch can be tested. */
export class WrongWidthEmbeddingProvider implements EmbeddingProvider {
  readonly name = "wrong-width";
  readonly model = "wrong-width-v1";

  constructor(
    readonly dimensions: number,
    private readonly actualWidth: number,
  ) {}

  async embed(): Promise<readonly number[]> {
    return Array.from({ length: this.actualWidth }, () => 0.1);
  }

  async embedBatch(
    texts: readonly string[],
  ): Promise<readonly (readonly number[])[]> {
    return texts.map(() => Array.from({ length: this.actualWidth }, () => 0.1));
  }
}

/**
 * An in-memory knowledge store that ranks by cosine similarity, so retrieval can
 * be exercised without a database while still behaving like one.
 */
export class InMemoryKnowledgeRepository implements KnowledgeRepository {
  private readonly documents = new Map<string, KnowledgeDocument>();
  private readonly chunks = new Map<string, EmbeddedKnowledgeChunk[]>();

  constructor(readonly embeddingDimensions = 8) {}

  async replaceDocument(input: {
    readonly document: KnowledgeDocument;
    readonly chunks: readonly EmbeddedKnowledgeChunk[];
  }): Promise<void> {
    this.documents.set(input.document.id, input.document);
    this.chunks.set(input.document.id, [...input.chunks]);
  }

  async search(search: KnowledgeSearch): Promise<readonly RetrievedKnowledge[]> {
    const candidates: RetrievedKnowledge[] = [];

    for (const [documentId, stored] of this.chunks) {
      const document = this.documents.get(documentId);
      if (document === undefined || !matches(document, search.filter)) {
        continue;
      }
      for (const { chunk, embedding } of stored) {
        candidates.push({
          chunk,
          document: toDocumentSummary(document),
          score: cosine(search.embedding, embedding),
        });
      }
    }

    return candidates
      .toSorted((left, right) => right.score - left.score)
      .slice(0, search.limit);
  }

  async findDocumentById(documentId: string): Promise<KnowledgeDocument | null> {
    return this.documents.get(documentId) ?? null;
  }

  async countDocuments(): Promise<number> {
    return this.documents.size;
  }

  async countChunks(): Promise<number> {
    return [...this.chunks.values()].reduce(
      (total, stored) => total + stored.length,
      0,
    );
  }
}

function matches(
  document: KnowledgeDocument,
  filter: KnowledgeFilter | undefined,
): boolean {
  if (filter === undefined) {
    return true;
  }
  if (filter.topics !== undefined && !filter.topics.includes(document.topic)) {
    return false;
  }
  if (
    filter.sources !== undefined &&
    !filter.sources.includes(document.source)
  ) {
    return false;
  }
  if (filter.problemSlugs !== undefined) {
    const slug = document.metadata.problemSlug;
    if (slug === undefined || !filter.problemSlugs.includes(slug)) {
      return false;
    }
  }
  return true;
}

function cosine(left: readonly number[], right: readonly number[]): number {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftMagnitude += a * a;
    rightMagnitude += b * b;
  }
  const magnitude = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  return magnitude === 0 ? 0 : dot / magnitude;
}
