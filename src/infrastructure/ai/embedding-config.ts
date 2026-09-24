import { EmbeddingConfigurationError } from "@/application/ports/embedding-provider";
import { KNOWLEDGE_EMBEDDING_DIMENSIONS } from "../knowledge/knowledge-dimensions";

/**
 * The embedding model, declared once and overridable with `EMBEDDING_MODEL`.
 *
 * Groq serves generation for this project but no embedding endpoint, so embeddings
 * use an OpenAI-compatible `/v1/embeddings` service — which OpenAI, a local Ollama
 * or LM Studio server, and several hosted gateways all speak. Providers retire ids
 * on their own schedule, so re-check this against what the key can use before
 * relying on a long ingestion run:
 *
 *   curl -sH "Authorization: Bearer $EMBEDDING_API_KEY" \
 *     "$EMBEDDING_BASE_URL/models" | jq -r '.data[].id'
 */
export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

export const DEFAULT_EMBEDDING_BASE_URL = "https://api.openai.com/v1";

const DEFAULT_TIMEOUT_MS = 30_000;

export interface EmbeddingConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
  /**
   * Must equal the dimension the vector column was created with. Configurable so a
   * model that supports shortened output can be matched to the column, not so the
   * column can be ignored.
   */
  readonly dimensions: number;
  readonly timeoutMs: number;
}

export function readEmbeddingConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): EmbeddingConfig {
  const apiKey = (env.EMBEDDING_API_KEY ?? "").trim();
  if (apiKey.length === 0) {
    throw new EmbeddingConfigurationError(
      "EMBEDDING_API_KEY is not set, so no embedding service is available. Copy .env.example to .env and add a key, or ingest with the offline hashing provider.",
    );
  }

  const dimensions = positiveInteger(
    env.EMBEDDING_DIMENSIONS,
    KNOWLEDGE_EMBEDDING_DIMENSIONS,
  );
  if (dimensions !== KNOWLEDGE_EMBEDDING_DIMENSIONS) {
    throw new EmbeddingConfigurationError(
      `EMBEDDING_DIMENSIONS is ${dimensions} but the knowledge_chunks.embedding column holds ${KNOWLEDGE_EMBEDDING_DIMENSIONS}. Changing the dimension needs a migration and a re-ingestion, not a configuration change.`,
    );
  }

  const baseUrl = (env.EMBEDDING_BASE_URL ?? DEFAULT_EMBEDDING_BASE_URL).trim();
  const model = (env.EMBEDDING_MODEL ?? "").trim();

  return {
    baseUrl: baseUrl.replace(/\/+$/u, ""),
    apiKey,
    model: model.length === 0 ? DEFAULT_EMBEDDING_MODEL : model,
    dimensions,
    timeoutMs: positiveInteger(env.EMBEDDING_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  };
}

/** True when a real embedding service can be built, revealing nothing about the key. */
export function isEmbeddingConfigured(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (env.EMBEDDING_API_KEY ?? "").trim().length > 0;
}

/**
 * Whether local lexical embeddings may stand in for a real service.
 *
 * They may not in production. Lexical vectors retrieve by word overlap, and
 * substituting them for semantic ones would leave a deployment returning ranked,
 * cited passages chosen on a different basis than the one it claims — with nothing
 * in the result or the database to say so. A missing key is a misconfiguration to
 * report, not a mode to slip into.
 */
export function allowsLocalEmbeddings(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env.NODE_ENV !== "production";
}

function positiveInteger(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new EmbeddingConfigurationError(
      `Expected a positive integer, received "${raw}".`,
    );
  }
  return parsed;
}
