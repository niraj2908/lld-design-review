import {
  EmbeddingDimensionError,
  EmbeddingUnavailableError,
} from "@/application/ports/embedding-provider";
import type { EmbeddingProvider } from "@/application/ports/embedding-provider";
import type { EmbeddingConfig } from "./embedding-config";

export const OPENAI_COMPATIBLE_PROVIDER_NAME = "openai-compatible";

/** One POST to `/embeddings`, so any service speaking that shape can serve this. */
export type FetchLike = (
  input: string,
  init: {
    readonly method: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly body: string;
    readonly signal: AbortSignal;
  },
) => Promise<{
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

interface EmbeddingResponse {
  readonly data?: readonly { readonly embedding?: unknown; readonly index?: number }[];
}

/**
 * Embeddings over the OpenAI-compatible `/v1/embeddings` contract.
 *
 * Written against the wire format rather than a vendor SDK, which costs about
 * eighty lines and buys provider independence: OpenAI, a local Ollama or LM Studio
 * server, and several gateways all answer this shape, so switching is a base URL.
 *
 * The API key is read from configuration, sent as a header, and never stored on the
 * provider, logged, or included in an error.
 */
export class OpenAICompatibleEmbeddingProvider implements EmbeddingProvider {
  readonly name = OPENAI_COMPATIBLE_PROVIDER_NAME;
  readonly model: string;
  readonly dimensions: number;

  constructor(
    private readonly config: EmbeddingConfig,
    private readonly fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
  ) {
    this.model = config.model;
    this.dimensions = config.dimensions;
  }

  async embed(text: string): Promise<readonly number[]> {
    const [embedding] = await this.embedBatch([text]);
    if (embedding === undefined) {
      throw new EmbeddingUnavailableError(
        "The embedding service returned no vector.",
      );
    }
    return embedding;
  }

  async embedBatch(
    texts: readonly string[],
  ): Promise<readonly (readonly number[])[]> {
    if (texts.length === 0) {
      return [];
    }

    const body = await this.post({
      model: this.model,
      input: [...texts],
      // Models that support shortened output are pinned to the column's dimension;
      // ones that ignore it are caught by the length check below.
      dimensions: this.dimensions,
    });

    const data = (body as EmbeddingResponse).data;
    if (!Array.isArray(data) || data.length !== texts.length) {
      throw new EmbeddingUnavailableError(
        `The embedding service returned ${Array.isArray(data) ? data.length : 0} vectors for ${texts.length} inputs.`,
      );
    }

    // Order is asserted rather than assumed: the contract allows an `index` field,
    // and a vector attached to the wrong chunk is worse than a failed run.
    const ordered = [...data].toSorted(
      (left, right) => (left.index ?? 0) - (right.index ?? 0),
    );

    return ordered.map((entry) => {
      const embedding = entry.embedding;
      if (
        !Array.isArray(embedding) ||
        !embedding.every((value) => typeof value === "number")
      ) {
        throw new EmbeddingUnavailableError(
          "The embedding service returned a vector that was not an array of numbers.",
        );
      }
      if (embedding.length !== this.dimensions) {
        throw new EmbeddingDimensionError({
          expected: this.dimensions,
          received: embedding.length,
        });
      }
      return embedding as readonly number[];
    });
  }

  private async post(payload: unknown): Promise<unknown> {
    let response;
    try {
      response = await this.fetchImpl(`${this.config.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (cause) {
      throw new EmbeddingUnavailableError(
        cause instanceof Error && cause.name === "TimeoutError"
          ? `The embedding service did not answer within ${this.config.timeoutMs}ms.`
          : "The embedding service could not be reached.",
        { cause },
      );
    }

    if (!response.ok) {
      // The status is useful; the response body may quote the request, so it is
      // not repeated.
      throw new EmbeddingUnavailableError(
        `The embedding service answered with HTTP ${response.status}.`,
      );
    }

    try {
      return await response.json();
    } catch (cause) {
      throw new EmbeddingUnavailableError(
        "The embedding service answer was not valid JSON.",
        { cause },
      );
    }
  }
}
