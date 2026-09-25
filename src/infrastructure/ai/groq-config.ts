import { LLMConfigurationError } from "@/application/ports/llm-provider";

export interface GroqConfig {
  readonly apiKey: string;
  readonly model: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
}

/**
 * The model this project reviews designs with: OpenAI's gpt-oss-120b, hosted on
 * Groq. (Previously Llama 3.3 70B — Groq retired that id; verified live via the
 * models endpoint below during M11 and confirmed working end to end, including
 * structured output, against this codebase's actual evaluator and coach.)
 *
 * Declared once, here, and overridable with `GROQ_MODEL` so retiring it again is
 * a configuration change rather than an edit. Providers retire ids on their own
 * schedule and a stale one fails at call time as a 404, so re-check it against
 * the ids the key can actually use before relying on a long run:
 *
 *   curl -sH "Authorization: Bearer $GROQ_API_KEY" \
 *     https://api.groq.com/openai/v1/models | jq -r '.data[].id'
 *
 * `openai/gpt-oss-20b` is a smaller, faster, cheaper alternative on the same
 * account if a quicker demo matters more than review depth.
 */
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_RETRIES = 1;

/**
 * Reads Groq settings from the environment.
 *
 * Only the key is required: without one there is no model to talk to, and the
 * composition root falls back to the deterministic evaluator. Everything else has
 * a default.
 */
export function readGroqConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): GroqConfig {
  const apiKey = env.GROQ_API_KEY;
  if (apiKey === undefined || apiKey.trim().length === 0) {
    throw new LLMConfigurationError(
      "GROQ_API_KEY is not set, so no language model is available. Copy .env.example to .env and add a key, or run with the deterministic evaluator only.",
    );
  }

  const model = (env.GROQ_MODEL ?? "").trim();

  return {
    apiKey: apiKey.trim(),
    model: model.length === 0 ? DEFAULT_GROQ_MODEL : model,
    timeoutMs: positiveInteger(env.GROQ_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    maxRetries: positiveInteger(env.GROQ_MAX_RETRIES, DEFAULT_MAX_RETRIES, 0),
  };
}

/**
 * True when the environment can build a provider, without revealing anything
 * about the key. Only the key matters: the model has a default.
 */
export function isGroqConfigured(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (env.GROQ_API_KEY ?? "").trim().length > 0;
}

function positiveInteger(
  raw: string | undefined,
  fallback: number,
  minimum = 1,
): number {
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new LLMConfigurationError(
      `Expected an integer of at least ${minimum}, received "${raw}".`,
    );
  }
  return parsed;
}
