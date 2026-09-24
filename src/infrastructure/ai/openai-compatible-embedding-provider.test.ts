import { describe, expect, it } from "vitest";
import {
  EmbeddingDimensionError,
  EmbeddingUnavailableError,
} from "@/application/ports/embedding-provider";
import type { EmbeddingConfig } from "./embedding-config";
import {
  OPENAI_COMPATIBLE_PROVIDER_NAME,
  OpenAICompatibleEmbeddingProvider,
} from "./openai-compatible-embedding-provider";
import type { FetchLike } from "./openai-compatible-embedding-provider";

const config: EmbeddingConfig = {
  baseUrl: "https://example.test/v1",
  apiKey: "test-key-not-a-real-credential",
  model: "some-embedding-model",
  dimensions: 4,
  timeoutMs: 1_000,
};

function vector(seed: number): number[] {
  return [seed, seed + 1, seed + 2, seed + 3];
}

/** Records the request and answers with whatever a test supplies. No network. */
function fakeFetch(
  answer:
    | { readonly kind: "json"; readonly body: unknown }
    | { readonly kind: "status"; readonly status: number }
    | { readonly kind: "throw"; readonly error: Error }
    | { readonly kind: "badJson" },
): { readonly fetch: FetchLike; readonly calls: unknown[] } {
  const calls: unknown[] = [];
  const fetch: FetchLike = async (input, init) => {
    calls.push({ input, init });
    if (answer.kind === "throw") {
      throw answer.error;
    }
    if (answer.kind === "status") {
      return {
        ok: false,
        status: answer.status,
        text: async () => "error body",
        json: async () => ({}),
      };
    }
    if (answer.kind === "badJson") {
      return {
        ok: true,
        status: 200,
        text: async () => "not json",
        json: () => Promise.reject(new Error("invalid json")),
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(answer.body),
      json: async () => answer.body,
    };
  };
  return { fetch, calls };
}

describe("OpenAICompatibleEmbeddingProvider", () => {
  it("reports its name, model and width", () => {
    const { fetch } = fakeFetch({ kind: "json", body: { data: [] } });
    const provider = new OpenAICompatibleEmbeddingProvider(config, fetch);

    expect(provider.name).toBe(OPENAI_COMPATIBLE_PROVIDER_NAME);
    expect(provider.model).toBe("some-embedding-model");
    expect(provider.dimensions).toBe(4);
  });

  it("posts to the embeddings endpoint with the model and width", async () => {
    const { fetch, calls } = fakeFetch({
      kind: "json",
      body: { data: [{ index: 0, embedding: vector(1) }] },
    });

    await new OpenAICompatibleEmbeddingProvider(config, fetch).embed("cohesion");

    const call = calls[0] as { input: string; init: { body: string; headers: Record<string, string>; method: string } };
    expect(call.input).toBe("https://example.test/v1/embeddings");
    expect(call.init.method).toBe("POST");
    expect(JSON.parse(call.init.body)).toEqual({
      model: "some-embedding-model",
      input: ["cohesion"],
      dimensions: 4,
    });
  });

  it("sends the key as a bearer header and nowhere else", async () => {
    const { fetch, calls } = fakeFetch({
      kind: "json",
      body: { data: [{ index: 0, embedding: vector(1) }] },
    });

    await new OpenAICompatibleEmbeddingProvider(config, fetch).embed("x");

    const call = calls[0] as { input: string; init: { body: string; headers: Record<string, string> } };
    expect(call.init.headers.authorization).toBe(`Bearer ${config.apiKey}`);
    expect(call.input).not.toContain(config.apiKey);
    expect(call.init.body).not.toContain(config.apiKey);
  });

  it("returns the vectors it was given", async () => {
    const { fetch } = fakeFetch({
      kind: "json",
      body: {
        data: [
          { index: 0, embedding: vector(1) },
          { index: 1, embedding: vector(5) },
        ],
      },
    });

    const result = await new OpenAICompatibleEmbeddingProvider(
      config,
      fetch,
    ).embedBatch(["a", "b"]);

    expect(result).toEqual([vector(1), vector(5)]);
  });

  it("restores the order the service reported rather than trusting position", async () => {
    const { fetch } = fakeFetch({
      kind: "json",
      body: {
        data: [
          { index: 1, embedding: vector(5) },
          { index: 0, embedding: vector(1) },
        ],
      },
    });

    const result = await new OpenAICompatibleEmbeddingProvider(
      config,
      fetch,
    ).embedBatch(["a", "b"]);

    expect(result).toEqual([vector(1), vector(5)]);
  });

  it("makes no request for an empty batch", async () => {
    const { fetch, calls } = fakeFetch({ kind: "json", body: { data: [] } });

    expect(
      await new OpenAICompatibleEmbeddingProvider(config, fetch).embedBatch([]),
    ).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("rejects a vector of the wrong width", async () => {
    const { fetch } = fakeFetch({
      kind: "json",
      body: { data: [{ index: 0, embedding: [1, 2] }] },
    });

    await expect(
      new OpenAICompatibleEmbeddingProvider(config, fetch).embed("x"),
    ).rejects.toThrow(EmbeddingDimensionError);
  });

  it("rejects a count that does not match the inputs", async () => {
    const { fetch } = fakeFetch({
      kind: "json",
      body: { data: [{ index: 0, embedding: vector(1) }] },
    });

    await expect(
      new OpenAICompatibleEmbeddingProvider(config, fetch).embedBatch(["a", "b"]),
    ).rejects.toThrow(/returned 1 vectors for 2 inputs/);
  });

  it.each([
    ["a missing data array", { usage: {} }],
    ["a non-numeric vector", { data: [{ index: 0, embedding: ["a", "b", "c", "d"] }] }],
    ["a vector that is not an array", { data: [{ index: 0, embedding: 42 }] }],
  ])("rejects %s", async (_label, body) => {
    const { fetch } = fakeFetch({ kind: "json", body });

    await expect(
      new OpenAICompatibleEmbeddingProvider(config, fetch).embed("x"),
    ).rejects.toThrow(EmbeddingUnavailableError);
  });

  it("reports an HTTP failure by status without quoting the body", async () => {
    const { fetch } = fakeFetch({ kind: "status", status: 429 });

    const error = await new OpenAICompatibleEmbeddingProvider(config, fetch)
      .embed("x")
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(EmbeddingUnavailableError);
    expect((error as Error).message).toContain("429");
    expect((error as Error).message).not.toContain("error body");
  });

  it("reports an unreachable service", async () => {
    const { fetch } = fakeFetch({
      kind: "throw",
      error: new TypeError("fetch failed"),
    });

    await expect(
      new OpenAICompatibleEmbeddingProvider(config, fetch).embed("x"),
    ).rejects.toThrow(/could not be reached/);
  });

  it("reports a timeout as a timeout", async () => {
    const timeout = Object.assign(new Error("aborted"), { name: "TimeoutError" });
    const { fetch } = fakeFetch({ kind: "throw", error: timeout });

    await expect(
      new OpenAICompatibleEmbeddingProvider(config, fetch).embed("x"),
    ).rejects.toThrow(/did not answer within 1000ms/);
  });

  it("reports an answer that is not JSON", async () => {
    const { fetch } = fakeFetch({ kind: "badJson" });

    await expect(
      new OpenAICompatibleEmbeddingProvider(config, fetch).embed("x"),
    ).rejects.toThrow(/not valid JSON/);
  });
});
