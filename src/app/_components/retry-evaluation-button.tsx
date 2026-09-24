"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CircleAlert, LoaderCircle, RotateCcw } from "lucide-react";
import { postJson } from "./api-client";

export function RetryEvaluationButton({
  attemptId,
}: {
  readonly attemptId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry(): Promise<void> {
    setBusy(true);
    setError(null);
    const result = await postJson(`/api/attempts/${attemptId}/retry-evaluation`);
    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  }

  return (
    <>
      <div className="btn-row">
        <button
          type="button"
          className="btn"
          onClick={() => void retry()}
          disabled={busy}
        >
          {busy ? (
            <LoaderCircle className="spin" aria-hidden="true" />
          ) : (
            <RotateCcw aria-hidden="true" />
          )}
          {busy ? "Retrying…" : "Retry the review"}
        </button>
      </div>
      {error !== null && (
        <div className="banner banner-danger" role="alert">
          <CircleAlert aria-hidden="true" />
          <div className="banner-body">{error}</div>
        </div>
      )}
    </>
  );
}
