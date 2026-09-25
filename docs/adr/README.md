# Architecture Decision Records

Short records of decisions with real, lasting trade-offs — not a record of
every choice made while building this project. Each one names what was
decided, why, and what it costs; several are cross-referenced from
`docs/ARCHITECTURE.md` and from the main `README.md` where the same decision
is discussed in product terms.

| ADR | Decision |
|---|---|
| [ADR-001](./ADR-001-modular-monolith.md) | Modular monolith, not microservices |
| [ADR-002](./ADR-002-structured-design-submission.md) | Structured design submission, not free-form text or a full UML editor |
| [ADR-003](./ADR-003-hybrid-evaluation.md) | Hybrid evaluation — deterministic checks plus a semantic AI judge |
| [ADR-004](./ADR-004-llm-provider-abstraction.md) | LLM provider abstraction |
| [ADR-005](./ADR-005-postgresql-pgvector.md) | PostgreSQL + pgvector, not a separate vector database |
| [ADR-006](./ADR-006-synchronous-in-process-evaluation.md) | Synchronous, in-process evaluation for now |
| [ADR-007](./ADR-007-evidence-grounded-feedback.md) | Evidence-grounded feedback |
| [ADR-008](./ADR-008-no-kafka.md) | Kafka is intentionally deferred |
