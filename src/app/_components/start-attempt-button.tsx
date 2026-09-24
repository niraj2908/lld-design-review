"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CircleAlert, LoaderCircle, SquarePen } from "lucide-react";
import { postJson } from "./api-client";

/**
 * Starts an attempt through the API and moves the learner into the workspace.
 *
 * It calls the route rather than a use case: this runs in the browser, and the
 * application layer is only reachable over HTTP from here.
 */
export function StartAttemptButton({
  problemRef,
}: {
  readonly problemRef: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(): Promise<void> {
    setBusy(true);
    setError(null);
    const result = await postJson<{ readonly attempt: { readonly id: string } }>(
      `/api/problems/${encodeURIComponent(problemRef)}/attempts`,
    );

    if (!result.ok) {
      setError(result.message);
      setBusy(false);
      return;
    }
    router.push(`/attempts/${result.data.attempt.id}`);
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-primary btn-lg"
        onClick={() => void start()}
        disabled={busy}
      >
        {busy ? (
          <LoaderCircle className="spin" aria-hidden="true" />
        ) : (
          <SquarePen aria-hidden="true" />
        )}
        {busy ? "Starting…" : "Start an attempt"}
      </button>
      {error !== null && (
        <div className="banner banner-danger" role="alert">
          <CircleAlert aria-hidden="true" />
          <div className="banner-body">{error}</div>
        </div>
      )}
    </>
  );
}
