import { chunkDocument, DEFAULT_CHUNKING } from "@/domain/knowledge/chunking";
import type { ChunkingOptions } from "@/domain/knowledge/chunking";
import type { EmbeddedKnowledgeChunk } from "@/domain/knowledge/knowledge-chunk";
import { assertValidKnowledgeDocument } from "@/domain/knowledge/knowledge-document";
import type { KnowledgeDocument } from "@/domain/knowledge/knowledge-document";
import { EmbeddingDimensionError } from "../ports/embedding-provider";
import type { EmbeddingProvider } from "../ports/embedding-provider";
import type { KnowledgeRepository } from "../ports/knowledge-repository";

export interface IngestKnowledgeResult {
  readonly documents: number;
  readonly chunks: number;
  readonly model: string;
  readonly dimensions: number;
}

export interface IngestKnowledgeDeps {
  readonly embeddings: EmbeddingProvider;
  readonly knowledge: KnowledgeRepository;
  readonly chunking?: ChunkingOptions;
}

/**
 * Chunks a catalogue, embeds it, and stores it.
 *
 * Rerunnable by construction rather than by checking: chunk ids are derived from
 * the document slug and the chunk's position, and each document is written by
 * replacing its whole chunk set. Running this twice leaves the database in the
 * same state as running it once, and a document whose text changed loses the
 * chunks that no longer exist instead of keeping them alongside the new ones.
 */
export class IngestKnowledge {
  private readonly chunking: ChunkingOptions;

  constructor(private readonly deps: IngestKnowledgeDeps) {
    this.chunking = deps.chunking ?? DEFAULT_CHUNKING;

    if (deps.embeddings.dimensions !== deps.knowledge.embeddingDimensions) {
      throw new EmbeddingDimensionError({
        expected: deps.knowledge.embeddingDimensions,
        received: deps.embeddings.dimensions,
      });
    }
  }

  async execute(
    documents: readonly KnowledgeDocument[],
  ): Promise<IngestKnowledgeResult> {
    let chunkCount = 0;

    for (const document of documents) {
      assertValidKnowledgeDocument(document);

      // Validation guarantees non-blank content, so there is always at least one
      // chunk here.
      const chunks = chunkDocument(document, this.chunking);

      const vectors = await this.deps.embeddings.embedBatch(
        chunks.map((chunk) => chunk.content),
      );
      if (vectors.length !== chunks.length) {
        throw new Error(
          `The embedding provider returned ${vectors.length} vectors for ${chunks.length} chunks.`,
        );
      }

      const embedded: EmbeddedKnowledgeChunk[] = chunks.map((chunk, index) => {
        const embedding = vectors[index] ?? [];
        if (embedding.length !== this.deps.knowledge.embeddingDimensions) {
          throw new EmbeddingDimensionError({
            expected: this.deps.knowledge.embeddingDimensions,
            received: embedding.length,
          });
        }
        return { chunk, embedding };
      });

      await this.deps.knowledge.replaceDocument({ document, chunks: embedded });
      chunkCount += embedded.length;
    }

    return {
      documents: documents.length,
      chunks: chunkCount,
      model: this.deps.embeddings.model,
      dimensions: this.deps.embeddings.dimensions,
    };
  }
}
