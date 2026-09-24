import { afterAll, describe, expect, it } from "vitest";
import { EmbeddingDimensionError } from "@/application/ports/embedding-provider";
import { IngestKnowledge } from "@/application/knowledge/ingest-knowledge";
import { KnowledgeContextBuilder } from "@/application/knowledge/knowledge-context-builder";
import { SemanticKnowledgeRetriever } from "@/application/knowledge/semantic-knowledge-retriever";
import { chunkDocument } from "@/domain/knowledge/chunking";
import { createKnowledgeServices } from "@/infrastructure/composition-root";
import { HashingEmbeddingProvider } from "@/infrastructure/ai/hashing-embedding-provider";
import { KNOWLEDGE_EMBEDDING_DIMENSIONS } from "@/infrastructure/knowledge/knowledge-dimensions";
import { PrismaKnowledgeRepository } from "@/infrastructure/knowledge/prisma-knowledge-repository";
import { KNOWLEDGE_DOCUMENTS } from "@/infrastructure/knowledge/seed/knowledge-catalogue";
import { createIntegrationHarness } from "./harness";

const harness = createIntegrationHarness();

afterAll(async () => {
  await harness.prisma.$disconnect();
});

/**
 * The whole path against real PostgreSQL and real pgvector, with deterministic
 * local embeddings so nothing calls an external service.
 */
const embeddings = new HashingEmbeddingProvider(KNOWLEDGE_EMBEDDING_DIMENSIONS);

function services() {
  const repository = new PrismaKnowledgeRepository(harness.prisma);
  const retriever = new SemanticKnowledgeRetriever(embeddings, repository);
  return {
    repository,
    retriever,
    ingest: new IngestKnowledge({ embeddings, knowledge: repository }),
    contextBuilder: new KnowledgeContextBuilder(retriever),
  };
}

const EXPECTED_CHUNKS = KNOWLEDGE_DOCUMENTS.flatMap((document) =>
  chunkDocument(document),
).length;

describe("knowledge base against PostgreSQL and pgvector", () => {
  it("ingests the curated catalogue", async () => {
    const { ingest, repository } = services();

    const result = await ingest.execute(KNOWLEDGE_DOCUMENTS);

    expect(result.documents).toBe(KNOWLEDGE_DOCUMENTS.length);
    expect(result.chunks).toBe(EXPECTED_CHUNKS);
    expect(await repository.countDocuments()).toBe(KNOWLEDGE_DOCUMENTS.length);
    expect(await repository.countChunks()).toBe(EXPECTED_CHUNKS);
  });

  it("stores a vector of the column's width for every chunk", async () => {
    await services().ingest.execute(KNOWLEDGE_DOCUMENTS.slice(0, 3));

    const rows = await harness.prisma.$queryRawUnsafe<
      { readonly dimensions: number }[]
    >(`SELECT vector_dims("embedding") AS "dimensions" FROM "knowledge_chunks"`);

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Number(row.dimensions)).toBe(KNOWLEDGE_EMBEDDING_DIMENSIONS);
    }
  });

  it("produces no duplicates when ingestion is rerun", async () => {
    const { ingest, repository } = services();

    await ingest.execute(KNOWLEDGE_DOCUMENTS);
    const first = await repository.countChunks();
    await ingest.execute(KNOWLEDGE_DOCUMENTS);

    expect(await repository.countChunks()).toBe(first);
    expect(await repository.countDocuments()).toBe(KNOWLEDGE_DOCUMENTS.length);
  });

  it("replaces a document's chunks rather than adding to them", async () => {
    const { ingest, repository } = services();
    const original = KNOWLEDGE_DOCUMENTS[0]!;

    await ingest.execute([original]);
    const before = await repository.countChunks();

    await ingest.execute([
      { ...original, content: "A much shorter replacement body for this document." },
    ]);

    expect(await repository.countChunks()).toBeLessThanOrEqual(before);
    const stored = await repository.findDocumentById(original.id);
    expect(stored?.content).toContain("shorter replacement");
  });

  it("retrieves the passage that matches the query", async () => {
    const { ingest, retriever } = services();
    await ingest.execute(KNOWLEDGE_DOCUMENTS);

    const results = await retriever.retrieve({
      text: "an element that accumulates responsibilities until every change touches it",
      limit: 3,
    });

    expect(results.length).toBe(3);
    expect(results.map((entry) => entry.document.slug)).toContain(
      "smell-god-object",
    );
  });

  it("orders results by similarity", async () => {
    const { ingest, retriever } = services();
    await ingest.execute(KNOWLEDGE_DOCUMENTS);

    const results = await retriever.retrieve({
      text: "substitutability of a subtype for its supertype",
      limit: 5,
    });

    const scores = results.map((entry) => entry.score);
    expect(scores).toEqual([...scores].toSorted((left, right) => right - left));
  });

  it("respects the limit", async () => {
    const { ingest, retriever } = services();
    await ingest.execute(KNOWLEDGE_DOCUMENTS);

    expect(
      await retriever.retrieve({ text: "abstraction", limit: 2 }),
    ).toHaveLength(2);
  });

  it("filters by topic", async () => {
    const { ingest, retriever } = services();
    await ingest.execute(KNOWLEDGE_DOCUMENTS);

    const results = await retriever.retrieve({
      text: "design",
      limit: 10,
      filter: { topics: ["SOLID"] },
    });

    expect(results.length).toBeGreaterThan(0);
    for (const entry of results) {
      expect(entry.document.topic).toBe("SOLID");
    }
  });

  it("filters by problem", async () => {
    const { ingest, retriever } = services();
    await ingest.execute(KNOWLEDGE_DOCUMENTS);

    const results = await retriever.retrieve({
      text: "what this problem is about",
      limit: 10,
      filter: { problemSlugs: ["vending-machine"] },
    });

    expect(results.length).toBeGreaterThan(0);
    for (const entry of results) {
      expect(entry.chunk.metadata.problemSlug).toBe("vending-machine");
    }
  });

  it("filters by source", async () => {
    const { ingest, retriever } = services();
    await ingest.execute(KNOWLEDGE_DOCUMENTS);

    expect(
      await retriever.retrieve({
        text: "design",
        limit: 5,
        filter: { sources: ["nothing published here"] },
      }),
    ).toEqual([]);
  });

  it("combines filters", async () => {
    const { ingest, retriever } = services();
    await ingest.execute(KNOWLEDGE_DOCUMENTS);

    const results = await retriever.retrieve({
      text: "design",
      limit: 10,
      filter: { topics: ["PROBLEM_GUIDANCE"], problemSlugs: ["parking-lot"] },
    });

    expect(results.length).toBeGreaterThan(0);
    for (const entry of results) {
      expect(entry.document.topic).toBe("PROBLEM_GUIDANCE");
      expect(entry.chunk.metadata.problemSlug).toBe("parking-lot");
    }
  });

  it("keeps every retrieved chunk traceable to its document", async () => {
    const { ingest, retriever, repository } = services();
    await ingest.execute(KNOWLEDGE_DOCUMENTS);

    const results = await retriever.retrieve({ text: "cohesion", limit: 4 });

    for (const entry of results) {
      expect(entry.chunk.id).toMatch(/^kchk_/u);
      expect(entry.chunk.documentId).toBe(entry.document.id);
      expect(await repository.findDocumentById(entry.document.id)).not.toBeNull();
      expect(entry.chunk.metadata.concepts.length).toBeGreaterThan(0);
    }
  });

  it("returns nothing from an empty knowledge base", async () => {
    const { retriever } = services();

    expect(await retriever.retrieve({ text: "anything", limit: 5 })).toEqual([]);
  });

  it("builds a bounded, cited context for the evaluator", async () => {
    const { ingest, contextBuilder } = services();
    await ingest.execute(KNOWLEDGE_DOCUMENTS);

    const context = await contextBuilder.build({
      query: "pricing and allocation policies that vary independently",
      limit: 3,
      filter: { problemSlugs: ["parking-lot"] },
    });

    expect(context.citations.length).toBeGreaterThan(0);
    expect(context.text).toContain("REFERENCE MATERIAL");
    expect(context.text).toContain("[K1]");
    expect(context.citations[0]?.chunkId).toMatch(/^kchk_guidance-parking-lot/u);
    expect(context.citations[0]?.documentVersion).toBe("lld-kb-v1");
    expect(context.citations[0]?.embeddingModel).toBe("hashing-bag-of-words-v1");
  });

  it("refuses a store and a provider that disagree on width", () => {
    expect(
      () =>
        new SemanticKnowledgeRetriever(
          new HashingEmbeddingProvider(64),
          new PrismaKnowledgeRepository(harness.prisma),
        ),
    ).toThrow(EmbeddingDimensionError);
  });

  it("refuses to store a vector of the wrong width", async () => {
    const repository = new PrismaKnowledgeRepository(harness.prisma);
    const document = KNOWLEDGE_DOCUMENTS[0]!;

    await expect(
      repository.replaceDocument({
        document,
        chunks: [
          {
            chunk: chunkDocument(document)[0]!,
            embedding: [0.1, 0.2, 0.3],
          },
        ],
      }),
    ).rejects.toThrow(EmbeddingDimensionError);

    expect(await repository.countChunks()).toBe(0);
  });

  it("wires the knowledge layer from the composition root", async () => {
    const knowledge = createKnowledgeServices(harness.prisma, { env: {} });

    // With no embedding service configured it falls back to local vectors.
    expect(knowledge.embeddings.name).toBe("hashing-local");
    await knowledge.ingest.execute(KNOWLEDGE_DOCUMENTS.slice(0, 5));

    const context = await knowledge.contextBuilder.build({
      query: "interface written in the vocabulary of its caller",
      limit: 2,
    });

    expect(context.citations.length).toBeGreaterThan(0);
  });
});
