import type { KnowledgeChunk } from "./knowledge-chunk";
import type { KnowledgeDocument } from "./knowledge-document";
import { knowledgeChunkId } from "./knowledge-identity";

export interface ChunkingOptions {
  /** Upper bound on a chunk, in characters. */
  readonly maxChars: number;
  /**
   * Characters of the previous chunk repeated at the start of the next, so a
   * thought that crosses a boundary is still retrievable from either side.
   */
  readonly overlapChars: number;
}

export const DEFAULT_CHUNKING: ChunkingOptions = {
  maxChars: 900,
  overlapChars: 120,
};

const PARAGRAPH_BREAK = /\n\s*\n/u;
const SENTENCE_END = /(?<=[.!?])\s+/u;

/**
 * Splits a document on paragraph boundaries, packing whole paragraphs up to the
 * size bound.
 *
 * Deterministic by construction: no model, no randomness, no clock. The same
 * document and options always produce the same chunks with the same ids, which is
 * what lets ingestion be rerun safely and lets a citation stay valid.
 */
export function chunkDocument(
  document: KnowledgeDocument,
  options: ChunkingOptions = DEFAULT_CHUNKING,
): readonly KnowledgeChunk[] {
  const pieces = splitToPieces(document.content, options.maxChars);
  const packed = packPieces(pieces, options.maxChars);
  const withOverlap = applyOverlap(packed, options);

  return withOverlap.map((content, chunkIndex) => ({
    id: knowledgeChunkId(document.slug, chunkIndex),
    documentId: document.id,
    chunkIndex,
    content,
    metadata: {
      topic: document.topic,
      ...(document.metadata.problemSlug === undefined
        ? {}
        : { problemSlug: document.metadata.problemSlug }),
      concepts: document.metadata.concepts,
    },
  }));
}

/** Paragraphs, with any paragraph larger than the bound split at sentence ends. */
function splitToPieces(content: string, maxChars: number): readonly string[] {
  return content
    .split(PARAGRAPH_BREAK)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .flatMap((paragraph) =>
      paragraph.length <= maxChars
        ? [paragraph]
        : splitLongParagraph(paragraph, maxChars),
    );
}

function splitLongParagraph(
  paragraph: string,
  maxChars: number,
): readonly string[] {
  const sentences = paragraph
    .split(SENTENCE_END)
    .flatMap((sentence) =>
      sentence.length <= maxChars ? [sentence] : hardSplit(sentence, maxChars),
    );

  const pieces: string[] = [];
  let buffer = "";
  for (const sentence of sentences) {
    const candidate = buffer.length === 0 ? sentence : `${buffer} ${sentence}`;
    if (candidate.length <= maxChars) {
      buffer = candidate;
      continue;
    }
    if (buffer.length > 0) {
      pieces.push(buffer);
    }
    buffer = sentence;
  }
  if (buffer.length > 0) {
    pieces.push(buffer);
  }
  return pieces;
}

/** Last resort for text with no sentence breaks at all, such as a long list. */
function hardSplit(text: string, maxChars: number): readonly string[] {
  const parts: string[] = [];
  for (let start = 0; start < text.length; start += maxChars) {
    parts.push(text.slice(start, start + maxChars));
  }
  return parts;
}

function packPieces(
  pieces: readonly string[],
  maxChars: number,
): readonly string[] {
  const chunks: string[] = [];
  let buffer = "";

  for (const piece of pieces) {
    const candidate = buffer.length === 0 ? piece : `${buffer}\n\n${piece}`;
    if (candidate.length <= maxChars) {
      buffer = candidate;
      continue;
    }
    if (buffer.length > 0) {
      chunks.push(buffer);
    }
    buffer = piece;
  }
  if (buffer.length > 0) {
    chunks.push(buffer);
  }
  return chunks;
}

function applyOverlap(
  chunks: readonly string[],
  options: ChunkingOptions,
): readonly string[] {
  if (options.overlapChars <= 0 || chunks.length < 2) {
    return chunks;
  }

  return chunks.map((chunk, index) => {
    if (index === 0) {
      return chunk;
    }
    const previous = chunks[index - 1] ?? "";
    const tail = wordSafeTail(previous, options.overlapChars);
    return tail.length === 0 ? chunk : `${tail}\n\n${chunk}`;
  });
}

/** The last `limit` characters, cut forward to the next word boundary. */
function wordSafeTail(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }
  const tail = text.slice(text.length - limit);
  const boundary = tail.search(/\s/u);
  return boundary === -1 ? tail : tail.slice(boundary + 1);
}
