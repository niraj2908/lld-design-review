import Groq from "groq-sdk";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  RateLimitError,
} from "groq-sdk";
import {
  LLMConfigurationError,
  LLMRateLimitError,
  LLMResponseFormatError,
  LLMTimeoutError,
  LLMUnavailableError,
} from "@/application/ports/llm-provider";
import type {
  LLMProvider,
  LLMRequest,
  LLMResult,
} from "@/application/ports/llm-provider";
import type { GroqConfig } from "./groq-config";

export const GROQ_PROVIDER_NAME = "groq";

/**
 * The only file in the repository that knows Groq exists.
 *
 * It turns the vendor's envelope and error taxonomy into the port's, so the
 * evaluation engine can tell a timeout from a malformed answer without importing
 * an SDK. The API key never leaves this object: it is passed to the client and is
 * not stored on the provider, logged, or included in any error.
 */
export class GroqLLMProvider implements LLMProvider {
  readonly name = GROQ_PROVIDER_NAME;
  readonly model: string;

  private readonly client: Groq;
  private readonly timeoutMs: number;

  constructor(config: GroqConfig, client?: Groq) {
    this.model = config.model;
    this.timeoutMs = config.timeoutMs;
    this.client =
      client ??
      new Groq({
        apiKey: config.apiKey,
        // The SDK's own ceiling, so a hung socket cannot outlive the request.
        timeout: config.timeoutMs,
        maxRetries: config.maxRetries,
      });
  }

  async generateStructured(request: LLMRequest): Promise<LLMResult<unknown>> {
    const timeoutMs = request.timeoutMs ?? this.timeoutMs;
    const startedAt = Date.now();

    let completion;
    try {
      completion = await this.client.chat.completions.create(
        {
          model: this.model,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user },
          ],
          // Structured outputs: the model is constrained to the schema, and the
          // caller validates the result anyway (`aiReviewSchema` / `coachAnswerSchema`
          // re-parse it regardless — "a provider's schema mode is a hint, not a
          // guarantee"). `strict: false` rather than `true`: OpenAI's full strict
          // contract additionally demands every optional property still be listed
          // in `required` (expressed as nullable instead), which the Zod-generated
          // schemas here do not do, and at least one model this project has run on
          // (`openai/gpt-oss-120b`) enforces that literally and 400s on `true`.
          // Since Zod re-validates unconditionally, nothing is trusted here either way.
          response_format: {
            type: "json_schema",
            json_schema: {
              name: request.schemaName,
              schema: request.responseSchema as Record<string, unknown>,
              strict: false,
            },
          },
          ...(request.temperature === undefined
            ? {}
            : { temperature: request.temperature }),
          ...(request.maxOutputTokens === undefined
            ? {}
            : { max_completion_tokens: request.maxOutputTokens }),
        },
        { timeout: timeoutMs, signal: AbortSignal.timeout(timeoutMs) },
      );
    } catch (cause) {
      throw translateGroqError(cause, timeoutMs);
    }

    const content = completion.choices[0]?.message?.content;
    if (content === undefined || content === null || content.length === 0) {
      throw new LLMResponseFormatError("The model returned an empty answer.");
    }

    let output: unknown;
    try {
      output = JSON.parse(content);
    } catch (cause) {
      throw new LLMResponseFormatError(
        "The model's answer was not valid JSON.",
        { cause },
      );
    }

    const usage = completion.usage;
    const result: LLMResult<unknown> = {
      output,
      model: completion.model,
      latencyMs: Date.now() - startedAt,
      ...(usage === undefined
        ? {}
        : {
            usage: {
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
            },
          }),
    };
    return result;
  }
}

/**
 * Maps the vendor's failures onto the port's. Nothing carries the request body or
 * the key: only the class of failure and the vendor's own message.
 */
export function translateGroqError(cause: unknown, timeoutMs: number): Error {
  if (
    cause instanceof APIConnectionTimeoutError ||
    (cause instanceof Error && cause.name === "TimeoutError") ||
    (cause instanceof Error && cause.name === "AbortError")
  ) {
    return new LLMTimeoutError(timeoutMs, { cause });
  }
  if (cause instanceof RateLimitError) {
    return new LLMRateLimitError(
      "The language model provider is rate limiting this key.",
      { cause },
    );
  }
  if (cause instanceof AuthenticationError) {
    return new LLMConfigurationError(
      "The language model provider rejected the credentials.",
      { cause },
    );
  }
  if (cause instanceof APIConnectionError) {
    return new LLMUnavailableError(
      "The language model provider could not be reached.",
      { cause },
    );
  }
  if (cause instanceof APIError) {
    return new LLMUnavailableError(
      `The language model provider returned an error: ${cause.message}`,
      { cause },
    );
  }
  return cause instanceof Error ? cause : new Error(String(cause));
}
