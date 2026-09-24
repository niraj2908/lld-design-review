import type {
  KnowledgeFilter,
  KnowledgeRepository,
  KnowledgeSearch,
} from "@/application/ports/knowledge-repository";
import { EmbeddingDimensionError } from "@/application/ports/embedding-provider";
import type {
  EmbeddedKnowledgeChunk,
  RetrievedKnowledge,
} from "@/domain/knowledge/knowledge-chunk";
import type { KnowledgeDocument } from "@/domain/knowledge/knowledge-document";
import type { KnowledgeTopic } from "@/domain/knowledge/knowledge-topic";
import { withTranslatedErrors } from "../persistence/persistence-errors";
import type { PrismaClient } from "../persistence/prisma/prisma-client";
import { KNOWLEDGE_EMBEDDING_DIMENSIONS } from "./knowledge-dimensions";

interface SearchRow {
  readonly chunkId: string;
  readonly documentId: string;
  readonly chunkIndex: number;
  readonly content: string;
  readonly topic: KnowledgeTopic;
  readonly problemSlug: string | null;
  readonly concepts: readonly string[];
  readonly slug: string;
  readonly title: string;
  readonly source: string;
  readonly version: string;
  readonly distance: number;
}

/**
 * The only place that knows the knowledge base is PostgreSQL with pgvector.
 *
 * Prisma has no vector type, so the embedding column is written and searched
 * through raw SQL here. Everything raw is confined to this file: the application
 * layer sees vectors as `number[]` and results as domain objects.
 */
export class PrismaKnowledgeRepository implements KnowledgeRepository {
  readonly embeddingDimensions = KNOWLEDGE_EMBEDDING_DIMENSIONS;

  constructor(private readonly prisma: PrismaClient) {}

  async replaceDocument(input: {
    readonly document: KnowledgeDocument;
    readonly chunks: readonly EmbeddedKnowledgeChunk[];
  }): Promise<void> {
    const { document, chunks } = input;

    for (const { embedding } of chunks) {
      if (embedding.length !== this.embeddingDimensions) {
        throw new EmbeddingDimensionError({
          expected: this.embeddingDimensions,
          received: embedding.length,
        });
      }
    }

    await withTranslatedErrors("knowledge.replaceDocument", () =>
      this.prisma.$transaction(async (tx) => {
        await tx.knowledgeDocument.upsert({
          where: { id: document.id },
          create: {
            id: document.id,
            slug: document.slug,
            title: document.title,
            source: document.source,
            topic: document.topic,
            version: document.version,
            content: document.content,
            problemSlug: document.metadata.problemSlug ?? null,
            concepts: [...document.metadata.concepts],
            createdAt: document.createdAt,
          },
          update: {
            slug: document.slug,
            title: document.title,
            source: document.source,
            topic: document.topic,
            version: document.version,
            content: document.content,
            problemSlug: document.metadata.problemSlug ?? null,
            concepts: [...document.metadata.concepts],
          },
        });

        // The whole chunk set is replaced rather than merged, so a document whose
        // text shrank does not keep chunks that no longer exist.
        await tx.knowledgeChunk.deleteMany({
          where: { documentId: document.id },
        });

        for (const { chunk, embedding } of chunks) {
          await tx.$executeRawUnsafe(
            `INSERT INTO "knowledge_chunks"
               ("id", "documentId", "chunkIndex", "content", "topic", "problemSlug", "concepts", "embedding", "createdAt")
             VALUES ($1, $2, $3, $4, $5::"KnowledgeTopic", $6, $7::text[], $8::vector, $9)`,
            chunk.id,
            chunk.documentId,
            chunk.chunkIndex,
            chunk.content,
            chunk.metadata.topic,
            chunk.metadata.problemSlug ?? null,
            [...chunk.metadata.concepts],
            toVectorLiteral(embedding),
            document.createdAt,
          );
        }
      }),
    );
  }

  /**
   * Top-K by cosine distance, narrowed by metadata first so similarity is only
   * considered among passages that can apply at all.
   */
  async search(search: KnowledgeSearch): Promise<readonly RetrievedKnowledge[]> {
    if (search.embedding.length !== this.embeddingDimensions) {
      throw new EmbeddingDimensionError({
        expected: this.embeddingDimensions,
        received: search.embedding.length,
      });
    }
    if (search.limit <= 0) {
      return [];
    }

    const { clauses, parameters } = buildFilter(search.filter, 2);

    const rows = await withTranslatedErrors("knowledge.search", () =>
      this.prisma.$queryRawUnsafe<SearchRow[]>(
        `SELECT c."id"          AS "chunkId",
                c."documentId"  AS "documentId",
                c."chunkIndex"  AS "chunkIndex",
                c."content"     AS "content",
                c."topic"       AS "topic",
                c."problemSlug" AS "problemSlug",
                c."concepts"    AS "concepts",
                d."slug"        AS "slug",
                d."title"       AS "title",
                d."source"      AS "source",
                d."version"     AS "version",
                (c."embedding" <=> $1::vector) AS "distance"
           FROM "knowledge_chunks" c
           JOIN "knowledge_documents" d ON d."id" = c."documentId"
          WHERE c."embedding" IS NOT NULL
                ${clauses}
          ORDER BY c."embedding" <=> $1::vector
          LIMIT ${Math.floor(search.limit)}`,
        toVectorLiteral(search.embedding),
        ...parameters,
      ),
    );

    return rows.map(toRetrieved);
  }

  async findDocumentById(documentId: string): Promise<KnowledgeDocument | null> {
    const row = await withTranslatedErrors("knowledge.findDocumentById", () =>
      this.prisma.knowledgeDocument.findUnique({ where: { id: documentId } }),
    );
    if (row === null) {
      return null;
    }

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      source: row.source,
      topic: row.topic,
      version: row.version,
      content: row.content,
      metadata: {
        ...(row.problemSlug === null ? {} : { problemSlug: row.problemSlug }),
        concepts: row.concepts,
      },
      createdAt: row.createdAt,
    };
  }

  async countDocuments(): Promise<number> {
    return withTranslatedErrors("knowledge.countDocuments", () =>
      this.prisma.knowledgeDocument.count(),
    );
  }

  async countChunks(): Promise<number> {
    return withTranslatedErrors("knowledge.countChunks", () =>
      this.prisma.knowledgeChunk.count(),
    );
  }
}

/**
 * pgvector's text input form. Built from numbers that have already been checked
 * for length, and every number is rendered by `Number`, so nothing from a caller
 * reaches SQL as text.
 */
export function toVectorLiteral(embedding: readonly number[]): string {
  return `[${embedding
    .map((value) => {
      if (!Number.isFinite(value)) {
        throw new EmbeddingDimensionError({
          expected: KNOWLEDGE_EMBEDDING_DIMENSIONS,
          received: embedding.length,
        });
      }
      return value;
    })
    .join(",")}]`;
}

/** Filter clauses as bound parameters; no caller text is ever interpolated. */
export function buildFilter(
  filter: KnowledgeFilter | undefined,
  firstIndex: number,
): { readonly clauses: string; readonly parameters: readonly unknown[] } {
  if (filter === undefined) {
    return { clauses: "", parameters: [] };
  }

  const clauses: string[] = [];
  const parameters: unknown[] = [];
  let index = firstIndex;

  if (filter.topics !== undefined && filter.topics.length > 0) {
    clauses.push(`AND c."topic" = ANY($${index}::"KnowledgeTopic"[])`);
    parameters.push([...filter.topics]);
    index += 1;
  }
  if (filter.problemSlugs !== undefined && filter.problemSlugs.length > 0) {
    clauses.push(`AND c."problemSlug" = ANY($${index}::text[])`);
    parameters.push([...filter.problemSlugs]);
    index += 1;
  }
  if (filter.sources !== undefined && filter.sources.length > 0) {
    clauses.push(`AND d."source" = ANY($${index}::text[])`);
    parameters.push([...filter.sources]);
    index += 1;
  }

  return { clauses: clauses.join("\n                "), parameters };
}

function toRetrieved(row: SearchRow): RetrievedKnowledge {
  return {
    chunk: {
      id: row.chunkId,
      documentId: row.documentId,
      chunkIndex: row.chunkIndex,
      content: row.content,
      metadata: {
        topic: row.topic,
        ...(row.problemSlug === null ? {} : { problemSlug: row.problemSlug }),
        concepts: row.concepts,
      },
    },
    document: {
      id: row.documentId,
      slug: row.slug,
      title: row.title,
      source: row.source,
      topic: row.topic,
      version: row.version,
    },
    // Cosine distance is 0 for identical and 2 for opposite; a caller reads "higher
    // is closer", so it is reported as a similarity.
    score: 1 - Number(row.distance),
  };
}
