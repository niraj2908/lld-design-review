/** Shared display helpers for the server-rendered pages. */

const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatMoment(iso: string | null): string {
  return iso === null ? "—" : DATE.format(new Date(iso));
}

/** "Parking Lot · attempt 3" reads better in a list than a 36-character id. */
export function attemptLabel(problemTitle: string, attemptNumber: number): string {
  return `${problemTitle} · attempt ${attemptNumber}`;
}
