"use client";

import { useEffect } from "react";
import { CircleAlert, RotateCcw } from "lucide-react";

/**
 * Catches anything an app-router page throws that its own read-model or handler
 * did not already turn into a typed, in-page state (an `<div className="empty">`
 * or a `<div className="banner-danger">`). A database hiccup or an unexpected
 * exception lands here instead of Next's default, unstyled crash screen — the
 * one path in the app where a raw error reaches the boundary, so its message is
 * deliberately never rendered: no stack trace, no driver detail, ever reaches
 * the page, matching the same rule the API layer follows in `http-error.ts`.
 */
export default function GlobalError({
  error,
  reset,
}: {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console -- the only place this app logs client-side; nothing else here can report it.
    console.error(error);
  }, [error]);

  return (
    <div className="empty">
      <span className="empty-icon">
        <CircleAlert size={17} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <h3>Something went wrong</h3>
      <p>
        This page could not load. Nothing about your attempts or designs was
        changed — try again, or come back in a moment.
      </p>
      <button type="button" className="btn btn-primary" onClick={() => reset()}>
        <RotateCcw aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}
