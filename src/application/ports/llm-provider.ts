export type JsonSchema = Readonly<Record<string, unknown>>;

export interface LLMRequest {
  readonly promptVersion: string;
  readonly system: string;
  readonly user: string;
  /** Vendor-neutral JSON Schema the provider must constrain its output to. */
  readonly responseSchema: JsonSchema;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
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
 * depend on a vendor SDK, model name, or response envelope.
 */
export interface LLMProvider {
  readonly name: string;
  generateStructured<T>(request: LLMRequest): Promise<LLMResult<T>>;
}
