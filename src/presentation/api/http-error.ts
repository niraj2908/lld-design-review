import type { ValidationIssue } from "@/domain/shared/validation";

export interface ApiErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    /** Field-level detail for an invalid request or an invalid design. */
    readonly issues?: readonly { readonly path: string; readonly message: string }[];
  };
}

/**
 * Which HTTP status each typed error means.
 *
 * Keyed by the `code` every application and domain error carries, not by
 * `instanceof`. That is not a style preference: the bundler may include the same
 * error module in more than one chunk, and an `instanceof` check against the wrong
 * copy silently falls through — which turned every 404 in a production build into a
 * 500. The codes are part of the error contract, so matching on them survives
 * bundling, minification and a serialised error crossing a boundary.
 */
const STATUS_BY_CODE: Readonly<Record<string, number>> = {
  PROBLEM_NOT_FOUND: 404,
  ATTEMPT_NOT_FOUND: 404,
  SUBMISSION_NOT_FOUND: 404,
  EVALUATION_NOT_FOUND: 404,

  // The input was fine; the resource was not in a state that allows it. Submitting
  // twice and evaluating a finished attempt land here.
  ATTEMPT_INVALID_STATE: 409,
  EVALUATION_INVALID_STATE: 409,
  DUPLICATE_ENTITY: 409,
  // Both attempts exist and are visible to the caller; comparing them is simply not
  // a valid request — the same attempt twice, or two different problems.
  COMPARISON_INVALID: 409,
  // Nothing failed; a concurrent request is already evaluating the same
  // attempt. A plain retry resolves this once that request finishes.
  EVALUATION_IN_PROGRESS: 409,

  // The request parsed, but what it carries breaks the rules of a design.
  DESIGN_INVALID: 422,
  SUBMISSION_INVALID: 422,
  RELATIONSHIP_INVALID: 422,
  SUBMISSION_FORMAT_UNSUPPORTED: 422,
  PROBLEM_INVALID: 422,
  ATTEMPT_INVALID: 422,
  COACH_QUESTION_INVALID: 422,

  // The submission survived; the review did not. A failure in something we depend on
  // rather than in the request.
  EVALUATION_EXECUTION_FAILED: 502,
  COACH_EXECUTION_FAILED: 502,

  // The request is fine; this environment simply has no language model configured
  // to ask, and there is no deterministic coach to fall back to.
  COACH_NOT_CONFIGURED: 503,
};

/** Messages we are willing to replace, because the domain's wording is internal. */
const MESSAGE_BY_CODE: Readonly<Record<string, string>> = {
  DESIGN_INVALID: "The design cannot be submitted yet.",
  EVALUATION_EXECUTION_FAILED:
    "The evaluation could not be completed. Your submission is saved and the evaluation can be retried.",
};

export function toErrorResponse(error: unknown): Response {
  const zodIssues = asZodIssues(error);
  if (zodIssues !== null) {
    return json(400, {
      error: {
        code: "INVALID_REQUEST",
        message: "The request body is not valid.",
        issues: zodIssues,
      },
    });
  }

  const code = codeOf(error);
  const status = code === null ? undefined : STATUS_BY_CODE[code];

  if (code !== null && status !== undefined) {
    const issues = asValidationIssues(error);
    return json(status, {
      error: {
        code,
        message: MESSAGE_BY_CODE[code] ?? messageOf(error),
        ...(issues === null ? {} : { issues }),
      },
    });
  }

  // Anything unrecognised — a driver error, a provider error, a bug — is a 500 with a
  // fixed message. A stack trace or a vendor message is useless to a learner and a
  // disclosure to anyone else.
  return json(500, {
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong while handling the request.",
    },
  });
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function codeOf(error: unknown): string | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function messageOf(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : "The request could not be completed.";
}

/**
 * Zod is duck-typed for the same reason: a second copy of the library in another
 * chunk would defeat `instanceof`.
 */
function asZodIssues(
  error: unknown,
): readonly { readonly path: string; readonly message: string }[] | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }
  const candidate = error as {
    readonly name?: unknown;
    readonly issues?: unknown;
  };
  if (candidate.name !== "ZodError" || !Array.isArray(candidate.issues)) {
    return null;
  }

  return candidate.issues.map((issue) => {
    const detail = issue as { readonly path?: unknown; readonly message?: unknown };
    return {
      path: Array.isArray(detail.path) ? detail.path.join(".") : "",
      message: typeof detail.message === "string" ? detail.message : "Invalid value.",
    };
  });
}

/** The design issues carried by `InvalidDesignError`, when the error has them. */
function asValidationIssues(
  error: unknown,
): readonly { readonly path: string; readonly message: string }[] | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }
  const issues = (error as { readonly issues?: unknown }).issues;
  if (!Array.isArray(issues)) {
    return null;
  }

  return issues
    .filter(
      (issue): issue is ValidationIssue =>
        typeof issue === "object" &&
        issue !== null &&
        typeof (issue as ValidationIssue).path === "string" &&
        typeof (issue as ValidationIssue).message === "string",
    )
    .map((issue) => ({ path: issue.path, message: issue.message }));
}
