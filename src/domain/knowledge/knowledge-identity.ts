const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isKnowledgeSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}

/**
 * Identity is derived from the slug rather than generated, which is what makes
 * ingestion rerunnable: the same catalogue produces the same ids, so a second run
 * replaces rows instead of adding a duplicate set.
 */
export function knowledgeDocumentId(slug: string): string {
  return `kdoc_${slug}`;
}

export function knowledgeChunkId(slug: string, chunkIndex: number): string {
  return `kchk_${slug}_${String(chunkIndex).padStart(3, "0")}`;
}
