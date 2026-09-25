# ADR-008: Kafka is intentionally deferred

## Status

Accepted.

## Context

Evaluation dispatch is exactly the kind of seam an event-driven architecture
is often reached for by default: "evaluation can be slow, so put it on a
queue." The frozen requirements explicitly ask that Kafka be introduced only
if an event-driven implementation demonstrably improves reliability or
decoupling without distracting from the LLD-evaluation core of the
assignment — not as a default.

## Decision

No message broker is introduced. `EvaluationDispatcher`
(`src/application/ports/evaluation-dispatcher.ts`) is declared as the
extension point (see ADR-006), and evaluation runs synchronously in-process
today. Kafka — or any broker — is deferred until a specific, demonstrated
requirement calls for it: sustained evaluation volume that competes with
request latency, a need to decouple evaluation from the request lifecycle
entirely, or multiple consumers needing the same evaluation event.

## Consequences

- Nothing in this project currently justifies operating a broker: one
  learner, four problems, on-demand evaluation. Standing up Kafka now would
  be infrastructure built for a scale the product does not have, at the cost
  of effort that would otherwise go into evaluation and coaching quality.
- The port already exists and is typed, so introducing a broker later is an
  additive adapter behind `EvaluationDispatcher`, not a redesign of
  `EvaluateAttempt`, the `Evaluation` state machine, or the API contract.
- This decision is revisited, not permanent: if evaluation volume or a
  specific decoupling need ever appears, `docs/EVALUATION_BENCHMARK.md` and
  this ADR are where the trade-off should be re-examined, using real evidence
  of the need rather than architectural anticipation.
