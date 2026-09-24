# Infrastructure

Intentionally empty at milestone 1.

Adapters that implement the ports in `src/application/ports` land here in later
milestones: Prisma repositories, the Groq `LLMProvider`, the pgvector
`KnowledgeRetriever`, and the in-process `EvaluationDispatcher`.

Nothing in `src/domain` or `src/application` may import from this directory.
