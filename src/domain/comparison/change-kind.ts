/**
 * How one identified element differs between two designs.
 *
 * `UNCHANGED` is a real member, not an omission, because a comparator has to be
 * able to say "nothing changed here" as confidently as it says "this changed" — a
 * caller that wants to hide unchanged elements from a primary view can filter on
 * this value, but the underlying comparison never simply drops them.
 */
export const CHANGE_KINDS = ["ADDED", "REMOVED", "MODIFIED", "UNCHANGED"] as const;

export type ChangeKind = (typeof CHANGE_KINDS)[number];
