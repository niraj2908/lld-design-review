import type { KnowledgeCitation } from "@/domain/evaluation/knowledge-citation";
import type { KnowledgeFilter } from "./knowledge-repository";

export interface KnowledgeContextRequest {
  readonly query: string;
  readonly limit?: number;
  readonly budgetChars?: number;
  readonly filter?: KnowledgeFilter;
}

export interface KnowledgeContext {
  readonly version: string;
  /** Which model found these passages, carried through to the stored evaluation. */
  readonly embeddingModel: string;
  /** Ready to drop into a prompt. Empty when nothing was retrieved. */
  readonly text: string;
  readonly citations: readonly KnowledgeCitation[];
  /** True when the budget cut material that was retrieved. */
  readonly truncated: boolean;
}

/**
 * Turns questions into a block of reference knowledge a prompt can carry.
 *
 * Contract only, so an evaluator can be given grounded guidance without learning
 * that retrieval is pgvector, or that anything is retrieved at all.
 */
export interface KnowledgeContextProvider {
  buildMany(
    requests: readonly KnowledgeContextRequest[],
  ): Promise<KnowledgeContext>;
}
