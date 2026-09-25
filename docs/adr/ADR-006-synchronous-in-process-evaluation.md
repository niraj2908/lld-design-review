# ADR-006: Synchronous, in-process evaluation for now

## Status

Accepted, revisit if a real scale or latency requirement appears.

## Context

The frozen requirements ask for evaluation to sit "behind an
`EvaluationDispatcher` port" and explicitly allow the initial implementation
to be in-process rather than a background worker or a queue. An AI evaluation
call can take several seconds, which is a real latency cost for whatever
serves the request, but nothing about this project's actual scale (a single
learner, four problems, evaluations run on demand) currently makes that
latency a reliability problem worth a queue to solve.

## Decision

`EvaluateAttempt` runs the evaluator synchronously, within the request that
triggers it, and `EvaluationDispatcher`
(`src/application/ports/evaluation-dispatcher.ts`) is declared as a port but
not yet wired into any use case — it exists so the extraction point is named
and typed before it is needed, not so it can be pointed to as "done." The
`Evaluation` domain entity's own state machine
(`PENDING → EVALUATING → COMPLETED | FAILED`, `src/domain/evaluation/evaluation.ts`)
does not assume synchronous execution: it would behave identically if a
dispatcher call replaced the direct evaluator call inside `EvaluateAttempt`.

## Consequences

- No queue, no worker process, no message broker to run, operate or reason
  about failure modes for, in a project whose actual bottleneck is evaluation
  *quality*, not evaluation *throughput*.
- The failure and retry path (`RetryEvaluation`, the `Evaluation` state
  machine, idempotency keys) is fully exercised and tested today, without a
  queue's own failure modes (redelivery, ordering, poison messages) adding
  noise to that testing.
- If evaluation volume or latency ever becomes a real product problem, the
  `EvaluationDispatcher` port is exactly where that change lands: swap what
  `EvaluateAttempt` calls, add a worker that consumes dispatched requests and
  calls the same evaluator, and nothing about the domain entity, the API
  contract, or the stored evaluation shape needs to change.
- This is stated as a real, current limitation — not hidden — in the
  README's "Limitations" section.
