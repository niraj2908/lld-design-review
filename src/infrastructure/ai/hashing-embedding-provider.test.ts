import { describe, expect, it } from "vitest";
import {
  HASHING_MODEL,
  HashingEmbeddingProvider,
  embedText,
} from "./hashing-embedding-provider";
import { KNOWLEDGE_EMBEDDING_DIMENSIONS } from "../knowledge/knowledge-dimensions";

function cosine(left: readonly number[], right: readonly number[]): number {
  return left.reduce((total, value, index) => total + value * (right[index] ?? 0), 0);
}

describe("HashingEmbeddingProvider", () => {
  it("matches the width the vector column was built for by default", () => {
    const provider = new HashingEmbeddingProvider();

    expect(provider.dimensions).toBe(KNOWLEDGE_EMBEDDING_DIMENSIONS);
    expect(provider.model).toBe(HASHING_MODEL);
    expect(provider.name).toBe("hashing-local");
  });

  it("names itself honestly, so a lexically filled store is recognisable", () => {
    expect(HASHING_MODEL).toContain("hashing");
  });

  it("returns a vector of the promised width", async () => {
    const provider = new HashingEmbeddingProvider(64);

    expect(await provider.embed("cohesion and coupling")).toHaveLength(64);
  });

  it("is deterministic", async () => {
    const provider = new HashingEmbeddingProvider(64);

    expect(await provider.embed("responsibility")).toEqual(
      await provider.embed("responsibility"),
    );
  });

  it("embeds a batch in the order given", async () => {
    const provider = new HashingEmbeddingProvider(64);

    const [first, second] = await provider.embedBatch(["alpha", "beta"]);

    expect(first).toEqual(await provider.embed("alpha"));
    expect(second).toEqual(await provider.embed("beta"));
  });

  it("returns unit vectors, so cosine similarity is a dot product", async () => {
    const vector = await new HashingEmbeddingProvider(64).embed("abstraction");

    expect(cosine(vector, vector)).toBeCloseTo(1, 6);
  });

  it("places texts that share vocabulary closer than texts that do not", () => {
    const query = embedText("coupling and dependency direction", 256);
    const near = embedText(
      "Coupling is about dependency direction between elements.",
      256,
    );
    const far = embedText("A vending machine dispenses a snack.", 256);

    expect(cosine(query, near)).toBeGreaterThan(cosine(query, far));
  });

  it("ignores case and punctuation", () => {
    expect(embedText("Cohesion!", 32)).toEqual(embedText("cohesion", 32));
  });

  it("returns a zero vector for text with no usable tokens", () => {
    const vector = embedText("a, b. c!", 16);

    expect(vector.every((value) => value === 0)).toBe(true);
  });

  it("handles an empty batch", async () => {
    expect(await new HashingEmbeddingProvider(16).embedBatch([])).toEqual([]);
  });
});
