export type ApiResult<T> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly status: number;
      readonly code: string;
      readonly message: string;
      readonly issues: readonly { readonly path: string; readonly message: string }[];
    };

interface ErrorBody {
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
    readonly issues?: readonly { readonly path: string; readonly message: string }[];
  };
}

/**
 * The browser's single door to the API.
 *
 * It returns a result rather than throwing, so every caller has to decide what to
 * show, and it reads the error envelope the API layer produces — a message written
 * for a learner, never a stack trace.
 */
export async function requestJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { "content-type": "application/json", ...init.headers },
    });
  } catch {
    return {
      ok: false,
      status: 0,
      code: "NETWORK_ERROR",
      message: "Could not reach the server. Check your connection and try again.",
      issues: [],
    };
  }

  const body: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = (body as ErrorBody).error;
    return {
      ok: false,
      status: response.status,
      code: error?.code ?? "UNKNOWN",
      message: error?.message ?? "The request failed.",
      issues: error?.issues ?? [],
    };
  }

  return { ok: true, data: body as T };
}

export async function postJson<T>(
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  return requestJson<T>(path, {
    method: "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export async function putJson<T>(
  path: string,
  body: unknown,
): Promise<ApiResult<T>> {
  return requestJson<T>(path, { method: "PUT", body: JSON.stringify(body) });
}
