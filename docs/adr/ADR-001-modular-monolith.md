# ADR-001: Modular monolith, not microservices

## Status

Accepted.

## Context

The assignment explicitly warns against distributed-system over-engineering,
and its centre of gravity is low-level design — classes, interfaces,
responsibilities, relationships — not distributed-systems concerns like
sharding, multi-region replication or a service mesh. The domain has clear
seams (problems, attempts, evaluation, knowledge, comparison, coaching), which
is exactly the situation where it is tempting to reach for microservices
prematurely.

## Decision

Build one Next.js application with a strict internal layering — UI →
application → domain ← ports ← infrastructure — and enforce the seams with
architecture tests and lint rules instead of network boundaries. See
`docs/ARCHITECTURE.md` for the full layer diagram.

## Consequences

- Domain boundaries are demonstrated by dependency direction and automated
  architecture tests (`tests/architecture/layering.test.ts`), not by which
  process a module happens to run in.
- No network calls, no serialization boundary, no partial-failure story
  between the pieces of the product itself — deployment is one artifact.
- If a genuine scaling reason ever requires splitting a module into its own
  service, the ports already at each seam (`DesignEvaluator`, `LLMProvider`,
  `KnowledgeContextProvider`, the repository ports) are exactly the
  extraction points; nothing about this decision blocks that later.
- Rejected explicitly: microservices, Kubernetes, a service mesh, and
  multi-region architecture — none are demonstrated requirements at this
  product's current scale, and building them would spend the milestone's
  effort on infrastructure ceremony instead of LLD evaluation quality.
