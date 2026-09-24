import { describe, expect, it } from "vitest";
import { EmbeddingConfigurationError } from "@/application/ports/embedding-provider";
import { KNOWLEDGE_EMBEDDING_DIMENSIONS } from "../knowledge/knowledge-dimensions";
import {
  DEFAULT_EMBEDDING_BASE_URL,
  DEFAULT_EMBEDDING_MODEL,
  allowsLocalEmbeddings,
  isEmbeddingConfigured,
  readEmbeddingConfig,
} from "./embedding-config";

const KEY_ONLY = { EMBEDDING_API_KEY: "test-key-not-a-real-credential" } as const;

describe("readEmbeddingConfig", () => {
  it("needs only a key, defaulting model, host and width", () => {
    const config = readEmbeddingConfig(KEY_ONLY);

    expect(config.model).toBe(DEFAULT_EMBEDDING_MODEL);
    expect(config.baseUrl).toBe(DEFAULT_EMBEDDING_BASE_URL);
    expect(config.dimensions).toBe(KNOWLEDGE_EMBEDDING_DIMENSIONS);
    expect(config.timeoutMs).toBeGreaterThan(0);
  });

  it("defaults to an OpenAI-compatible embeddings service", () => {
    expect(DEFAULT_EMBEDDING_MODEL).toBe("text-embedding-3-small");
    expect(DEFAULT_EMBEDDING_BASE_URL).toBe("https://api.openai.com/v1");
  });

  it.each([undefined, "", "   "])(
    "refuses to run without a key (%s)",
    (EMBEDDING_API_KEY) => {
      expect(() => readEmbeddingConfig({ EMBEDDING_API_KEY })).toThrow(
        EmbeddingConfigurationError,
      );
    },
  );

  it("lets the model be overridden", () => {
    expect(
      readEmbeddingConfig({ ...KEY_ONLY, EMBEDDING_MODEL: "another-model" }).model,
    ).toBe("another-model");
  });

  it("lets the host be overridden, so a local server can serve embeddings", () => {
    expect(
      readEmbeddingConfig({
        ...KEY_ONLY,
        EMBEDDING_BASE_URL: "http://localhost:11434/v1/",
      }).baseUrl,
    ).toBe("http://localhost:11434/v1");
  });

  it("refuses a width the vector column cannot hold", () => {
    expect(() =>
      readEmbeddingConfig({ ...KEY_ONLY, EMBEDDING_DIMENSIONS: "768" }),
    ).toThrow(/needs a migration/);
  });

  it("accepts the width the column was built for", () => {
    expect(
      readEmbeddingConfig({
        ...KEY_ONLY,
        EMBEDDING_DIMENSIONS: String(KNOWLEDGE_EMBEDDING_DIMENSIONS),
      }).dimensions,
    ).toBe(KNOWLEDGE_EMBEDDING_DIMENSIONS);
  });

  it.each(["0", "-1", "abc", "1.5"])(
    "rejects the timeout value %s",
    (EMBEDDING_TIMEOUT_MS) => {
      expect(() =>
        readEmbeddingConfig({ ...KEY_ONLY, EMBEDDING_TIMEOUT_MS }),
      ).toThrow(EmbeddingConfigurationError);
    },
  );

  it("never repeats the key in an error message", () => {
    try {
      readEmbeddingConfig({
        EMBEDDING_API_KEY: "secret-value",
        EMBEDDING_DIMENSIONS: "42",
      });
    } catch (error) {
      expect((error as Error).message).not.toContain("secret-value");
    }
  });
});

describe("isEmbeddingConfigured", () => {
  it("is true only when a key is present", () => {
    expect(isEmbeddingConfigured(KEY_ONLY)).toBe(true);
    expect(isEmbeddingConfigured({})).toBe(false);
    expect(isEmbeddingConfigured({ EMBEDDING_API_KEY: "  " })).toBe(false);
  });
});

describe("allowsLocalEmbeddings", () => {
  it("does not permit local embeddings in production", () => {
    expect(allowsLocalEmbeddings({ NODE_ENV: "production" })).toBe(false);
  });

  it.each(["development", "test", "staging", undefined])(
    "permits them when NODE_ENV is %s",
    (NODE_ENV) => {
      expect(
        allowsLocalEmbeddings(NODE_ENV === undefined ? {} : { NODE_ENV }),
      ).toBe(true);
    },
  );
});
