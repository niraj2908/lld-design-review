/**
 * The vector length the `knowledge_chunks.embedding` column was created with.
 *
 * Declared once and checked against the configured embedding provider, because the
 * column's dimension is fixed by migration: changing it is a migration and a
 * re-ingestion, never a configuration edit. A provider that disagrees is rejected
 * at construction rather than at query time.
 */
export const KNOWLEDGE_EMBEDDING_DIMENSIONS = 1536;
