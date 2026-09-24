export type JsonSchema = Readonly<Record<string, unknown>>;

export interface LLMRequest {
  readonly promptVersion: string;
  /** Evaluator rules. Never contains learner-supplied text. */
  readonly system: string;
  /** Problem and submission data. Treated as data, never as instructions. */
  readonly user: string;
  /** Vendor-neutral JSON Schema the provider must constrain its output to. */
  readonly responseSchema: JsonSchema;
  readonly schemaName: string;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  /** Hard ceiling for the whole call, retries included. */
  readonly timeoutMs?: number;
}

export interface LLMUsage {
  readonly promptTokens?: number;
  readonly completionTokens?: number;
}

export interface LLMResult<T> {
  readonly output: T;
  readonly model: string;
  readonly latencyMs: number;
  readonly usage?: LLMUsage;
}

/**
 * Contract only. Groq is the first adapter, but nothing above this port may
 * depend on a vendor SDK or response envelope.
 *
 * `generateStructured` returns whatever JSON the provider produced, typed as
 * `unknown` to the caller's eye: the provider guarantees valid JSON matching the
 * requested schema shape as far as the vendor enforces it, and the caller is
 * still expected to validate it. A model is not a trusted source.
 */
export interface LLMProvider {
  readonly name: string;
  /** The configured model id, recorded on every evaluation this provider serves. */
  readonly model: string;
  generateStructured(request: LLMRequest): Promise<LLMResult<unknown>>;
}

/**
 * Failures a caller can act on, raised by any provider adapter.
 *
 * They live beside the port rather than in infrastructure so the evaluation
 * engine can distinguish "the provider was unreachable" from "the provider
 * answered with something unusable" without importing a vendor SDK.
 */
export abstract class LLMProviderError extends Error {
  abstract readonly code: string;
  /** Whether running the same request again could plausibly succeed. */
  abstract readonly retryable: boolean;

  constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class LLMConfigurationError extends LLMProviderError {
  readonly code = "LLM_NOT_CONFIGURED";
  readonly retryable = false;
}

export class LLMTimeoutError extends LLMProviderError {
  readonly code = "LLM_TIMEOUT";
  readonly retryable = true;

  constructor(readonly timeoutMs: number, options?: { readonly cause?: unknown }) {
    super(`The language model did not answer within ${timeoutMs}ms.`, options);
  }
}

export class LLMRateLimitError extends LLMProviderError {
  readonly code = "LLM_RATE_LIMITED";
  readonly retryable = true;
}

export class LLMUnavailableError extends LLMProviderError {
  readonly code = "LLM_UNAVAILABLE";
  readonly retryable = true;
}

/** The provider answered, but not with usable JSON. */
export class LLMResponseFormatError extends LLMProviderError {
  readonly code = "LLM_RESPONSE_MALFORMED";
  readonly retryable = true;
}
