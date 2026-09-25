# ADR-003: Hybrid evaluation — deterministic checks plus a semantic AI judge

## Status

Accepted.

## Context

Some questions about a design have one checkable answer ("does every
relationship's endpoints exist?", "is this requirement mapped to anything?").
Others are judgement calls a fact-checker cannot settle ("is this abstraction
justified?", "is this class doing too much?"). Asking a single LLM to decide
both invites it to contradict a fact it should never have been asked to
re-decide, and current research on LLM-as-judge systems documents real
reliability and bias risk when a model's judgement is trusted unchecked (see
`docs/RESEARCH.md`).

## Decision

Split evaluation into two evaluators behind one `DesignEvaluator` port
(`src/application/ports/evaluator.ts`):

- `RuleBasedEvaluator` — five deterministic criteria
  (`STRUCTURAL_VALIDITY`, `REQUIREMENT_COVERAGE`, `DESIGN_COMPLETENESS`,
  `EDGE_CASE_COVERAGE`, `DESIGN_DECISIONS`), never claiming `STRONG`, never
  carrying a confidence score.
- `AIDesignEvaluator` — nine semantic criteria a fact-checker cannot settle,
  behind the `LLMProvider` port, with every claim validated before it is
  trusted (see ADR-007).
- `HybridEvaluator` — runs both and concatenates their results. The two
  criterion sets are disjoint by construction (`natureOf`, tested by
  `criteriaAreDisjoint`), so there is no criterion either evaluator could
  contradict the other on.

## Consequences

- A learner always sees which kind of finding they are reading —
  `FACTUAL` or `SEMANTIC` — never a blended, unlabelled verdict.
- The deterministic evaluator can run alone with no model configured at all,
  and the whole test suite does exactly that by default.
- Extending `DesignEvaluator` (a rule-based, an AI, a hybrid, or eventually a
  human evaluator) needs no change to `EvaluateAttempt` or any caller.
- `tests/benchmarks/hybrid-grounding.test.ts` demonstrates the guarantee this
  ADR exists to make: a judge's prose claim that a requirement is "probably
  covered" cannot move the deterministic `REQUIREMENT_COVERAGE` finding.
