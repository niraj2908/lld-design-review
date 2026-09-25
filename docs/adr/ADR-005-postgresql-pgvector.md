# ADR-005: PostgreSQL + pgvector, not a separate vector database

## Status

Accepted.

## Context

The knowledge layer needs to store and retrieve embedded passages of design
guidance by similarity search. A dedicated vector database (Pinecone,
Weaviate, Qdrant, ...) is a common choice for this, but it is a second
persistent store to operate, back up and keep consistent with the relational
data (problems, attempts, evaluations) that already needs PostgreSQL.

## Decision

Store knowledge documents and their embedded chunks in the same PostgreSQL
database, using the `pgvector` extension for the embedding column and its
similarity search operators. `KnowledgeRepository`
(`src/application/ports/knowledge-repository.ts`) is the port; the Prisma
adapter is the only place that knows pgvector exists.

## Consequences

- One database to run, back up, and reason about transactionally — an
  evaluation's stored knowledge citations reference the same database as the
  evaluation itself.
- Retrieval quality is bounded by what pgvector's indexing supports at this
  scale, which is sufficient for a knowledge base of dozens of documents; a
  separate vector database remains an option behind the same
  `KnowledgeRepository` port if retrieval ever needs to scale far beyond that.
- Local development and CI need only the one Postgres container already
  required for everything else — no second service to stand up.
- Explicitly rejected: a dedicated vector database and Redis for caching,
  neither of which this project's actual scale demonstrates a need for.
