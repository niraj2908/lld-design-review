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
          // guarantee"). `strict: true` requires every property of every nested
          // object to be listed in `required`, with a nullable type standing in
          // for "optional" — `requireAllProperties` and the `.nullable()` fields
          // in `ai-response-schema.ts` / `coach-response-schema.ts` produce exactly
          // that shape, so this holds for every model this project has run on
          // (`openai/gpt-oss-120b` included). Without strict mode, at least that
          // model intermittently emitted structurally invalid JSON for these
          // schemas' nested arrays — caught either by Groq's own generation
          // validator or by the Zod re-parse below, but only after wasting the call.
          response_format: {
            type: "json_schema",
            json_schema: {
              name: request.schemaName,
              schema: request.responseSchema as Record<string, unknown>,
              strict: true,
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
  if (cause instanceof APIError && groqErrorCode(cause) === "json_validate_failed") {
    // Groq's own generation validator rejected the model's structured output —
    // the same class of failure as this codebase's own Zod check failing, just
    // caught one step earlier. Classifying it as `LLMResponseFormatError` (not
    // the generic `LLMUnavailableError` below) is what lets the retry-once
    // policy in `generateStructuredWithRetry` recognise it and act on it.
    return new LLMResponseFormatError(
      `The language model provider rejected the generated output as invalid JSON: ${cause.message}`,
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

/**
 * Groq's own error `code` for "the model's generation did not validate against
 * the requested JSON Schema" — read defensively, since the SDK's own typing
 * only promises `error` is the parsed response body, not which key holds the
 * code at. Falls back to the one substring Groq's own message reliably
 * contains for this failure, so a shape this does not anticipate still works.
 */
function groqErrorCode(error: APIError): string | undefined {
  const direct = errorCodeOf(error.error);
  if (direct !== undefined) {
    return direct;
  }
  const nested = errorCodeOf(
    typeof error.error === "object" && error.error !== null
      ? (error.error as Record<string, unknown>).error
      : undefined,
  );
  if (nested !== undefined) {
    return nested;
  }
  return error.message.includes("json_validate_failed") ? "json_validate_failed" : undefined;
}

function errorCodeOf(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const code = (value as Record<string, unknown>).code;
  return typeof code === "string" ? code : undefined;
}
