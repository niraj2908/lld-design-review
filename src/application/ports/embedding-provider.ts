/**
 * Turns text into a vector. Contract only: nothing above this port knows which
 * service, which model, or how the numbers are produced.
 */
export interface EmbeddingProvider {
  readonly name: string;
  /** The configured model id, recorded so a stored vector can be explained. */
  readonly model: string;
  /** Length of every vector this provider returns. */
  readonly dimensions: number;
  embed(text: string): Promise<readonly number[]>;
  /**
   * Present because ingestion embeds a whole catalogue at once, and one request
   * per chunk is the difference between a second and a minute.
   */
  embedBatch(texts: readonly string[]): Promise<readonly (readonly number[])[]>;
}

export abstract class EmbeddingProviderError extends Error {
  abstract readonly code: string;

  constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class EmbeddingConfigurationError extends EmbeddingProviderError {
  readonly code = "EMBEDDING_NOT_CONFIGURED";
}

export class EmbeddingUnavailableError extends EmbeddingProviderError {
  readonly code = "EMBEDDING_UNAVAILABLE";
}

/**
 * Raised when a vector is not the length the store was built for.
 *
 * Worth its own type: a silent mismatch would either be rejected by the database
 * with an opaque message or, worse, compared against vectors it has no
 * relationship to.
 */
export class EmbeddingDimensionError extends EmbeddingProviderError {
  readonly code = "EMBEDDING_DIMENSION_MISMATCH";

  constructor(
    readonly detail: { readonly expected: number; readonly received: number },
  ) {
    super(
      `Expected an embedding of ${detail.expected} dimensions but received ${detail.received}. The embedding model and the vector column must agree.`,
    );
  }
}
