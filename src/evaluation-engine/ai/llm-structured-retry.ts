import type { z } from "zod";
import type { LLMProvider, LLMRequest } from "@/application/ports/llm-provider";
import { LLMResponseFormatError } from "@/application/ports/llm-provider";

/**
 * Appended to the system prompt on the one allowed retry. Generic and
 * schema-agnostic on purpose — it names the failure class a structured-output
 * rejection actually looks like, without knowing anything about a particular
 * schema's fields, so the same note serves both the evaluator and the coach.
 */
export const STRUCTURED_OUTPUT_RETRY_NOTE = [
  "",
  "YOUR PREVIOUS ANSWER DID NOT MATCH THE REQUIRED SCHEMA. Try again, and this time:",
  "- Return ONLY the required structured response. No prose outside the JSON.",
  "- Follow every enum field exactly as given; never invent a value outside the listed options.",
  "- Never leave a required string field empty; use null for an absent optional value instead of an empty string.",
  "- Preserve the exact object and array structure the schema requires — never flatten, stringify, or wrap a nested object as text.",
  "- Do not add any field the schema does not define.",
].join("\n");

export type StructuredAttempt = "first" | "retry";

export interface StructuredCallResult<T> {
  readonly output: T;
  /** Which call actually produced the accepted output — safe to log or assert on: never model content, never a credential. */
  readonly attempt: StructuredAttempt;
}

/**
 * Both AI routes run under Vercel's 60-second `maxDuration` ceiling (the
 * platform's Hobby-plan maximum, already the most that can be requested). A
 * retry issues a second full provider call on the same connection, so it can
 * roughly double the time already spent — safe when the first attempt failed
 * quickly, dangerous when it consumed most of the budget already.
 */
export const EXECUTION_BUDGET_MS = 60_000;

/**
 * Time reserved for everything in the request that is not this LLM call —
 * grounding/knowledge lookups before it and persistence after it. Those are
 * ordinary Postgres round-trips, not another network call to a model, so 5s
 * is generous headroom rather than a number tuned to make a specific case work.
 */
export const NON_LLM_OVERHEAD_BUDGET_MS = 5_000;

/**
 * The smallest remaining budget a retry is allowed to start with. A live,
 * measured call against the configured Groq model — the same kind of call a
 * retry makes — completed in 6.7s. Requiring more than double that before
 * attempting a retry means a retry only ever starts when a normal call has
 * comfortable room to finish, not merely "some" room.
 */
export const MIN_SAFE_RETRY_BUDGET_MS = 15_000;

/**
 * Calls one `LLMProvider` request and validates it against `schema`, retrying
 * at most once — same provider, same model, same request plus one corrective
 * note — if and only if the first attempt is a structured-output/schema
 * failure. Any other kind of failure (timeout, rate limit, auth,
 * configuration, or a plain vendor outage) propagates immediately from the
 * first attempt; nothing about those is retried here, and there is no second
 * retry regardless of how the retry itself fails.
 *
 * The retry is additionally budget-aware: `startedAt` marks when the caller's
 * overall request began (grounding, this call, and persistence all come out of
 * the same 60-second execution window). If the first attempt already used
 * enough of that window that a second full call could not safely finish, the
 * retry is skipped and the original schema failure is thrown unchanged —
 * exactly as if no retry were configured at all. This never makes a timeout
 * more likely than not retrying would; it only ever removes a retry that
 * would have made one more likely.
 *
 * A model is not made more trustworthy by asking twice: the same `schema`
 * validates the retry's answer exactly as strictly as the first one, and a
 * second failure is thrown unchanged — never coerced into something that
 * looks valid.
 */
export async function generateStructuredWithRetry<T>(
  llm: LLMProvider,
  request: LLMRequest,
  schema: z.ZodType<T>,
  label: string,
  startedAt: number = Date.now(),
): Promise<StructuredCallResult<T>> {
  const first = await attemptOnce(llm, request, schema, label);
  if (first.ok) {
    return { output: first.value, attempt: "first" };
  }
  if (!(first.error instanceof LLMResponseFormatError)) {
    throw first.error;
  }

  const remainingMs =
    EXECUTION_BUDGET_MS - NON_LLM_OVERHEAD_BUDGET_MS - (Date.now() - startedAt);
  if (remainingMs < MIN_SAFE_RETRY_BUDGET_MS) {
    // eslint-disable-next-line no-console -- safe, narrow observability; see this function's own doc comment
    console.warn(
      `[${label}] skipping structured-output retry: only ${remainingMs}ms left of the execution budget`,
    );
    throw first.error;
  }

  const retry = await attemptOnce(
    llm,
    { ...request, system: `${request.system}\n${STRUCTURED_OUTPUT_RETRY_NOTE}` },
    schema,
    label,
  );
  if (retry.ok) {
    // Notable but not alarming: the schema and grounding still held, the
    // model just needed one nudge. Never logs model content or a credential.
    // eslint-disable-next-line no-console -- safe, narrow observability; see this function's own doc comment
    console.info(`[${label}] structured output accepted after one retry`);
    return { output: retry.value, attempt: "retry" };
  }
  // eslint-disable-next-line no-console -- safe, narrow observability; see this function's own doc comment
  console.error(`[${label}] structured output rejected on both the first attempt and the retry`);
  throw retry.error;
}

type AttemptResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: unknown };

/**
 * One call-and-validate cycle. A provider failure and a schema failure are
 * both reported the same way here — as an `AttemptResult` the caller decides
 * whether to retry — but only a schema failure is ever wrapped in
 * `LLMResponseFormatError`; every other provider error passes through as-is,
 * which is what lets the retry loop tell the two apart.
 */
async function attemptOnce<T>(
  llm: LLMProvider,
  request: LLMRequest,
  schema: z.ZodType<T>,
  label: string,
): Promise<AttemptResult<T>> {
  let output: unknown;
  try {
    const result = await llm.generateStructured(request);
    output = result.output;
  } catch (error) {
    return { ok: false, error };
  }

  const parsed = schema.safeParse(output);
  if (!parsed.success) {
    return {
      ok: false,
      error: new LLMResponseFormatError(
        `The model's answer did not match the ${label} schema: ${parsed.error.issues
          .map((issue) => `${issue.path.join(".")} ${issue.message}`)
          .join("; ")}`,
        { cause: parsed.error },
      ),
    };
  }
  return { ok: true, value: parsed.data };
}
