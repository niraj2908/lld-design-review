import { isBlank } from "../shared/text";
import { DomainError } from "../shared/errors";
import type { KnowledgeTopic } from "./knowledge-topic";

export class InvalidKnowledgeDocumentError extends DomainError {
  readonly code = "KNOWLEDGE_DOCUMENT_INVALID";

  constructor(
    message: string,
    readonly detail: { readonly field: string },
  ) {
    super(message);
  }
}

export interface KnowledgeDocumentMetadata {
  /** Set only on guidance written for one problem, so it can be filtered to it. */
  readonly problemSlug?: string;
  /** Concepts the document explains, for filtering and for auditing a citation. */
  readonly concepts: readonly string[];
}

/**
 * A piece of design guidance the evaluator may consult.
 *
 * It explains how to reason about a design. It is never a solution: nothing here
 * describes the classes a problem "should" have, because the product accepts many
 * valid designs and a stored answer key would quietly turn retrieval into
 * comparison.
 */
export interface KnowledgeDocument {
  readonly id: string;
  /** Human-stable identity; the id is derived from it, so ingestion is rerunnable. */
  readonly slug: string;
  readonly title: string;
  /** Where the material came from, for auditing a citation. */
  readonly source: string;
  readonly topic: KnowledgeTopic;
  readonly version: string;
  readonly content: string;
  readonly metadata: KnowledgeDocumentMetadata;
  readonly createdAt: Date;
}

/** What a retrieved chunk carries about where it came from. */
export interface KnowledgeDocumentSummary {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly source: string;
  readonly topic: KnowledgeTopic;
  readonly version: string;
}

export function assertValidKnowledgeDocument(
  document: KnowledgeDocument,
): KnowledgeDocument {
  const required: readonly [keyof KnowledgeDocument, string][] = [
    ["id", "id"],
    ["slug", "slug"],
    ["title", "title"],
    ["source", "source"],
    ["version", "version"],
    ["content", "content"],
  ];

  for (const [field, name] of required) {
    const value = document[field];
    if (typeof value !== "string" || isBlank(value)) {
      throw new InvalidKnowledgeDocumentError(
        `Knowledge document "${name}" must not be empty.`,
        { field: name },
      );
    }
  }

  return document;
}

export function toDocumentSummary(
  document: KnowledgeDocument,
): KnowledgeDocumentSummary {
  return {
    id: document.id,
    slug: document.slug,
    title: document.title,
    source: document.source,
    topic: document.topic,
    version: document.version,
  };
}
