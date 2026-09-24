import { describe, expect, it } from "vitest";
import { DEFAULT_CHUNKING, chunkDocument } from "./chunking";
import type { KnowledgeDocument } from "./knowledge-document";
import { knowledgeChunkId, knowledgeDocumentId } from "./knowledge-identity";

function documentWith(content: string): KnowledgeDocument {
  return {
    id: knowledgeDocumentId("test-doc"),
    slug: "test-doc",
    title: "Test",
    source: "unit test",
    topic: "OOP",
    version: "v1",
    content,
    metadata: { concepts: ["cohesion"] },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

const NO_OVERLAP = { maxChars: 60, overlapChars: 0 };

describe("chunkDocument", () => {
  it("keeps a short document as a single chunk", () => {
    const chunks = chunkDocument(documentWith("One short paragraph."));

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe("One short paragraph.");
    expect(chunks[0]?.chunkIndex).toBe(0);
  });

  it("derives a stable id from the document slug and the chunk position", () => {
    // A bound small enough that the two paragraphs cannot share a chunk.
    const chunks = chunkDocument(documentWith("Alpha.\n\nBeta."), {
      maxChars: 10,
      overlapChars: 0,
    });

    expect(chunks.map((chunk) => chunk.id)).toEqual([
      knowledgeChunkId("test-doc", 0),
      knowledgeChunkId("test-doc", 1),
    ]);
    expect(chunks[0]?.id).toBe("kchk_test-doc_000");
  });

  it("produces the same chunks every time it runs", () => {
    const document = documentWith("Alpha paragraph.\n\nBeta paragraph.\n\nGamma.");

    expect(chunkDocument(document)).toEqual(chunkDocument(document));
  });

  it("packs whole paragraphs up to the size bound", () => {
    const chunks = chunkDocument(
      documentWith("aaaa bbbb.\n\ncccc dddd.\n\n" + "e".repeat(55)),
      NO_OVERLAP,
    );

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.content).toBe("aaaa bbbb.\n\ncccc dddd.");
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(NO_OVERLAP.maxChars);
    }
  });

  it("numbers chunks in document order", () => {
    const chunks = chunkDocument(
      documentWith(["one.", "two.", "three.", "four."].map((p) => p.repeat(8)).join("\n\n")),
      NO_OVERLAP,
    );

    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual(
      chunks.map((_chunk, index) => index),
    );
  });

  it("splits a paragraph that is larger than the bound at sentence ends", () => {
    const sentence = "This sentence is of a moderate length. ";
    const chunks = chunkDocument(
      documentWith(sentence.repeat(4).trim()),
      { maxChars: 80, overlapChars: 0 },
    );

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(80);
      expect(chunk.content.trim()).toBe(chunk.content);
    }
  });

  it("hard-splits text with no sentence breaks rather than exceeding the bound", () => {
    const chunks = chunkDocument(documentWith("x".repeat(200)), NO_OVERLAP);

    expect(chunks.length).toBe(Math.ceil(200 / NO_OVERLAP.maxChars));
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(NO_OVERLAP.maxChars);
    }
  });

  it("repeats a tail of the previous chunk when overlap is requested", () => {
    const content = `${"alpha ".repeat(12).trim()}\n\n${"beta ".repeat(12).trim()}`;
    const withOverlap = chunkDocument(documentWith(content), {
      maxChars: 70,
      overlapChars: 20,
    });

    expect(withOverlap.length).toBeGreaterThan(1);
    expect(withOverlap[1]?.content).toContain("alpha");
  });

  it("leaves the first chunk untouched by overlap", () => {
    const content = "alpha one two.\n\nbeta three four.\n\ngamma five six.";
    const chunks = chunkDocument(documentWith(content), {
      maxChars: 30,
      overlapChars: 10,
    });

    expect(chunks[0]?.content).toBe("alpha one two.");
  });

  it("adds no overlap when the option is zero", () => {
    const content = "alpha one two.\n\nbeta three four.";
    const chunks = chunkDocument(documentWith(content), {
      maxChars: 20,
      overlapChars: 0,
    });

    expect(chunks[1]?.content).toBe("beta three four.");
  });

  it("drops blank paragraphs and trailing whitespace", () => {
    const chunks = chunkDocument(documentWith("\n\n  Alpha.  \n\n\n\n  Beta.  \n\n"), NO_OVERLAP);

    expect(chunks.map((chunk) => chunk.content)).toEqual(["Alpha.\n\nBeta."]);
  });

  it("returns nothing for an empty document", () => {
    expect(chunkDocument(documentWith("   \n\n  "))).toEqual([]);
  });

  it("carries the document's topic, concepts and problem onto every chunk", () => {
    const document: KnowledgeDocument = {
      ...documentWith("Alpha.\n\nBeta."),
      topic: "PROBLEM_GUIDANCE",
      metadata: { problemSlug: "parking-lot", concepts: ["allocation"] },
    };

    for (const chunk of chunkDocument(document, NO_OVERLAP)) {
      expect(chunk.metadata).toEqual({
        topic: "PROBLEM_GUIDANCE",
        problemSlug: "parking-lot",
        concepts: ["allocation"],
      });
      expect(chunk.documentId).toBe(document.id);
    }
  });

  it("omits problemSlug entirely when the document has none", () => {
    const chunk = chunkDocument(documentWith("Alpha."))[0]!;

    expect("problemSlug" in chunk.metadata).toBe(false);
  });

  it("uses a bound large enough for a paragraph by default", () => {
    expect(DEFAULT_CHUNKING.maxChars).toBeGreaterThan(500);
    expect(DEFAULT_CHUNKING.overlapChars).toBeGreaterThan(0);
    expect(DEFAULT_CHUNKING.overlapChars).toBeLessThan(DEFAULT_CHUNKING.maxChars);
  });
});
