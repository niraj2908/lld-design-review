import type { EmbeddingProvider } from "@/application/ports/embedding-provider";
import { KNOWLEDGE_EMBEDDING_DIMENSIONS } from "../knowledge/knowledge-dimensions";

export const HASHING_PROVIDER_NAME = "hashing-local";
export const HASHING_MODEL = "hashing-bag-of-words-v1";

/**
 * A lexical embedding computed locally: tokens are hashed into a fixed-width vector
 * and the result is unit-normalised, so two passages that share vocabulary end up
 * close together.
 *
 * It is not a language model and knows nothing about meaning — "car park" and
 * "parking lot" are unrelated to it. It exists so ingestion, retrieval and the whole
 * integration path can be exercised with no key, no network and no cost, and so
 * local development works offline. It is the default only when no embedding service
 * is configured, and the model name it reports says what produced the vectors, so a
 * store filled this way is never mistaken for a semantic one.
 */
export class HashingEmbeddingProvider implements EmbeddingProvider {
  readonly name = HASHING_PROVIDER_NAME;
  readonly model = HASHING_MODEL;
  readonly dimensions: number;

  constructor(dimensions: number = KNOWLEDGE_EMBEDDING_DIMENSIONS) {
    this.dimensions = dimensions;
  }

  async embed(text: string): Promise<readonly number[]> {
    return embedText(text, this.dimensions);
  }

  async embedBatch(
    texts: readonly string[],
  ): Promise<readonly (readonly number[])[]> {
    return texts.map((text) => embedText(text, this.dimensions));
  }
}

/** Deterministic: the same text always gives the same vector, in any process. */
export function embedText(text: string, dimensions: number): readonly number[] {
  const vector: number[] = Array.from({ length: dimensions }, () => 0);

  for (const token of tokenize(text)) {
    const slot = hash(token) % dimensions;
    // Sign from a second hash so unrelated tokens do not all push the same way.
    const sign = hash(`${token}#sign`) % 2 === 0 ? 1 : -1;
    vector[slot] = (vector[slot] ?? 0) + sign;
  }

  return normalise(vector);
}

function tokenize(text: string): readonly string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length > 2);
}

/** FNV-1a: small, stable across runs, and not a security primitive. */
function hash(token: string): number {
  let value = 0x81_1c_9d_c5;
  for (let index = 0; index < token.length; index += 1) {
    value ^= token.charCodeAt(index);
    value = Math.imul(value, 0x01_00_01_93) >>> 0;
  }
  return value;
}

function normalise(vector: readonly number[]): readonly number[] {
  const magnitude = Math.sqrt(
    vector.reduce((total, value) => total + value * value, 0),
  );
  if (magnitude === 0) {
    return vector;
  }
  return vector.map((value) => value / magnitude);
}
