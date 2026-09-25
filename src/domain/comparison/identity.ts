/**
 * How comparison identifies "the same element" across two independently edited
 * designs.
 *
 * The structured design format gives classes and interfaces a client-generated
 * `id` (see `structuredDesignSchema`), but that id is a fresh editor session key,
 * never persisted identity — the same class re-typed in a later attempt gets a
 * different one. Relationships, decisions and edge cases have no id at all. The
 * only thing genuinely stable across two submissions is what a learner typed as a
 * name, which is also how the domain already addresses elements everywhere else
 * (relationship endpoints, evidence, `DesignElementIndex`). Comparison follows
 * that same convention rather than inventing a second notion of identity.
 *
 * This is a real limitation, not a shortcut: renaming `ParkingLot` to `Garage`
 * with no other change reads as "removed ParkingLot, added Garage" rather than
 * "renamed", because nothing in the stored data distinguishes a rename from a
 * genuine removal-and-replacement. Overclaiming identity from a name match alone
 * would risk the opposite mistake — treating two unrelated classes that happen to
 * share a name as continuous — so trimmed-name equality is the one rule applied
 * everywhere, honestly, rather than a heuristic that sometimes guesses right.
 */
export function identityKey(name: string): string {
  return name.trim();
}

/**
 * Identity for a relationship: its endpoints, not its type. Two edges between the
 * same two elements are one relationship whose type may have changed; an edge
 * that moves to a different target is a different relationship entirely, not the
 * same one "modified" — so a source or target rename always shows as one removed
 * edge and one added edge rather than a false "changed" claim across a rename
 * that cannot be told apart from a genuine replacement.
 *
 * Encoded as a JSON array rather than joined with a separator character: a name
 * is free text with no character restriction enforced above the domain (the wire
 * schema only trims and caps length), so a joined key could in principle collide
 * two different pairs onto one string. `JSON.stringify` escapes whatever the two
 * strings contain, so two different pairs never produce the same key, by
 * construction rather than by a separator being unlikely to occur in practice.
 */
export function relationshipKey(source: string, target: string): string {
  return JSON.stringify([identityKey(source), identityKey(target)]);
}
