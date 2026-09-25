# ADR-007: Evidence-grounded feedback

## Status

Accepted.

## Context

An LLM judging a design can state a concern fluently and convincingly while
citing an entity, a relationship, or a field that does not actually exist in
what the learner submitted — a hallucination that would be indistinguishable
from a real finding to a learner reading it. Trusting a model's citation at
face value would let a confident-sounding but false claim reach the product's
core deliverable: feedback the learner is meant to act on.

## Decision

Every criterion result and every priority-improvement item an AI evaluator or
the Design Coach produces carries `evidence`: an entity name, an optional
field, and an optional value. `validateEvidence`
(`src/domain/evaluation/evidence-validation.ts`) checks each piece of cited
evidence against the actual submitted `StructuredDesign` — the entity must
exist, the field must be one the format has, and the quoted value must appear
in that element's actual text. Evidence that fails is rejected; a finding left
with no verified evidence is dropped entirely rather than shown with a caveat.
`unverifiedEvidenceCount` records how much was discarded so a reader can see a
result rests on less grounding than the model originally claimed.

## Consequences

- No finding a learner sees can cite something that is not really there —
  demonstrated by `tests/benchmarks/evidence-quality.test.ts`, which mixes a
  real and a hallucinated evidence item in one model response and confirms
  only the real one survives.
- A vague, ungrounded criticism ("poor abstraction") without a citable element
  simply cannot pass through this evaluator's `criterionSchema`, which
  requires evidence to be present.
- The same validator is reused, unmodified, by both `AIDesignEvaluator` and
  `LLMDesignCoach` — one grounding rule, checked once, rather than two
  slightly different implementations that could drift.
- The cost is that a genuinely correct observation phrased loosely by the
  model (a paraphrase rather than a quote) can be rejected as unverifiable.
  This is treated as the safer failure direction: losing a true finding to
  strict grounding is preferable to keeping a false one.
