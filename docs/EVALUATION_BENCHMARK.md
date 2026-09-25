# Evaluation benchmark (M10)

DesignReview's evaluator is the whole product: if a learner cannot trust the
feedback, the review loop teaches nothing. M10 does not add a product feature —
it establishes that the evaluator is credible enough to use as a learning tool,
with a small, curated benchmark suite that runs as part of the normal test
suite (`npm test`) and as a standalone, readable report (`npm run benchmark`).

## What this benchmark is, and is not

It answers one question: **given known design cases, does DesignReview produce
reasonable, explainable, evidence-grounded feedback?**

It does **not** attempt to prove the evaluator is "accurate" in any general
sense, and it produces no numeric score. Nine mocked review cases and one
regression scenario are curated evidence of specific behaviours, not a sample
large or random enough to support a statistical accuracy claim. A future
sentence like "the AI evaluator is 97% accurate" would not be supported by
anything in this suite, and nothing here should be read as claiming it.

Every case runs against `FakeLLMProvider`, scripted with a hand-written,
representative judge answer — never a live model. This keeps the suite:

- **deterministic and reproducible** — the same input always produces the same
  result, which a live model's output cannot promise;
- **free of any API credential or network call** — `npm test`, `npm run
  benchmark` and CI never require a Groq or OpenAI key;
- **fast** — the whole suite runs in well under a second.

A hand-written mock is one plausible judge answer, not *the* judge answer. The
benchmark's assertions are about what the *pipeline* does with an answer of
that shape — evidence grounding held, deterministic facts stayed put, nothing
was fabricated — never about whether that exact wording is what a real model
would produce. See "No model grading itself" below for why a live model is
never asked to validate its own output here.

## Where it lives

```text
tests/benchmarks/
  fixtures.ts               benchmark cases A–F: problem, design, intent, expected
                             findings/strengths/trade-offs, and a mock judge answer
  regression-fixtures.ts    the two attempts shared by benchmark G's test and runner
  deterministic.test.ts     what the rule-based evaluator alone must get right
  ai-semantic.test.ts       what the AI evaluator does with each case's mock answer
  hybrid-grounding.test.ts  proof that a judge's claim cannot move a deterministic fact
  evidence-quality.test.ts  evidence pointing at real elements is kept; invented evidence is not
  regression-evolution.test.ts   benchmark G, via `buildAttemptComparison` directly
  run-benchmarks.ts         `npm run benchmark` — human-readable summary of all of the above
```

Everything here is test-only: `tests/benchmarks` depends on the domain, the
application ports' test doubles, and the evaluation engine, exactly as every
other test in this codebase does. Nothing in `src/` depends on anything under
`tests/`, and no benchmark fixture or runner logic was added to production code.

## The cases

| id | category | what it protects |
|---|---|---|
| `strong-design` | Strong | A well-structured solution reads as strong; nothing manufactured. Reused directly from `validParkingLotDesign()` — the project's own "one valid answer, not the answer" fixture. |
| `weak-design` | Weak | A god class with direct infrastructure coupling is structurally *valid* (determinism has nothing to say) while a semantic judge finds real, evidence-backed issues. |
| `valid-alternative-design` | Valid alternative | A fully independent decomposition, sharing no class name with the strong design, receives the identical class of deterministic assessment. This is the benchmark that most directly protects the product's thesis — see below. |
| `over-engineered-design` | Over-engineered | Two strategy interfaces are justified by the brief's stated variation points; two factories on top of them are not. The correct finding names the factories specifically, never "interfaces are bad". |
| `missing-requirement-design` | Missing requirement | One explicit requirement has no mapping at all. The deterministic evaluator must name it, and a judge's optimistic prose must never obscure the gap (see "hybrid grounding" below). |
| `edge-case-heavy-design` | Edge-case-heavy | Five recorded edge cases and a real coupling flaw must both surface, independently — extensive edge-case coverage elsewhere must not soften an unrelated concern. |
| *(built into `regression-fixtures.ts`)* | Regression / evolution | Two attempts where the second fixes one issue and introduces a different one. The comparison must show an improvement, a regression, and a resolved prior finding all at once — never one collapsed verdict. |

Each case's full metadata — `intent`, `expectedDeterministicFindings`,
`expectedSemanticFindings`, `expectedStrengths`, `knownTradeoffs` — lives next to
its design in `tests/benchmarks/fixtures.ts`, in prose, so a reader can check
what a case is claiming without reading the assertions.

## Valid-alternative design

Section 10's case deserves its own note, because it is the one most at risk of
a subtle regression: nothing in this codebase holds a reference design to
compare a submission against, ever — not for scoring, not for "similarity". If
it did, `valid-alternative-design` would be the first case to expose it, since
it shares zero class or interface names with `strong-design`.

`tests/benchmarks/deterministic.test.ts` asserts the two designs receive
**identical** deterministic assessments criterion by criterion despite that
disjoint vocabulary. `tests/benchmarks/ai-semantic.test.ts` additionally asserts
the alternative's semantic outcome never mentions the strong design's own
element names, and manufactures no improvement — the outcome for a plain,
pattern-free design can be a clean bill of health, with nothing forcing the
pipeline to invent a concern to fill space.

## Over-engineering

`over-engineered-design` is written narrowly on purpose. It contains four
interfaces: two (`IAllocationStrategy`, `IPricingStrategy`) that the brief's own
stated per-site and independent-pricing variation justifies, and two
(`IAllocationStrategyFactory`, `IPricingStrategyFactory`) that add a layer of
indirection nothing in the brief calls for. The mocked judge's finding names the
factories specifically and leaves the strategies at `ADEQUATE` — a benchmark
that instead rewarded "fewer interfaces, full stop" would be exactly the
mistake section 11 of the M10 brief warns against, and this case would fail if
the pipeline (or a future prompt change) started doing that.

## Hybrid grounding: a judge cannot move a fact

`tests/benchmarks/hybrid-grounding.test.ts` scripts a judge that claims, in
prose, that a requirement is "probably handled" despite `missing-requirement-design`
genuinely having no mapping for it. Two independent mechanisms stop this from
reaching the learner:

1. The AI response schema's `criterion` field is drawn from `EVALUATION_CRITERIA`
   (the ten *semantic* criteria) — it shares no name with `REQUIREMENT_COVERAGE`,
   one of the five *deterministic* criteria, so the two can never collide by name.
2. `AIDesignEvaluator.validate()` additionally drops any criterion outside the
   nine it is actually asked about (`isAICriterion`, in
   `src/evaluation-engine/ai/ai-criteria.ts`) — `REQUIREMENT_UNDERSTANDING`
   included — before it ever reaches an outcome.

`HybridEvaluator` then concatenates the two evaluators' results rather than
merging or voting between them (`criteriaAreDisjoint`, asserted on every
hybrid run in `src/evaluation-engine/hybrid-evaluator.test.ts`). The benchmark
exercises this end to end, on a realistic case, rather than re-proving the
mechanism the unit tests already cover.

## Regression / evolution

`regression-fixtures.ts` holds one pair of attempts, shared by the real
assertions (`regression-evolution.test.ts`) and the CLI summary
(`run-benchmarks.ts`) so the two can never describe different scenarios under
the same name. Attempt 2 genuinely resolves attempt 1's one real issue
(`ParkingLot` doing two jobs, split into `SpotAllocator` and `ExitGate`) and
genuinely introduces a different one (`PricingStrategyFactory`, an unjustified
factory over one pricing implementation). `buildAttemptComparison` — the same
pure domain function `CompareAttempts` calls in production — reports both an
`IMPROVED` and a `REGRESSED` criterion evolution in the same result, alongside
the resolved prior finding, exactly as milestone 8 was built to allow.

## No model grading itself

Nowhere in this suite is a language model asked whether its own (or another
model's) answer was correct. Every check is one of:

- a deterministic assertion (`RuleBasedEvaluator`'s own output, or
  `buildAttemptComparison`'s),
- a structural/schema assertion (`aiReviewSchema.safeParse`,
  `validateEvidence`), or
- a fixture-level expectation a human wrote down in `fixtures.ts` before ever
  running the pipeline.

This avoids circular validation — an LLM's self-assessment of quality is not
evidence of quality — and keeps every assertion falsifiable without a model
call.

## The AI evaluator quality rubric

For reviewing a benchmark case's mocked or (optionally, outside CI) real judge
output by hand, the same seven dimensions apply every time:

| Dimension | Question |
|---|---|
| **Grounding** | Does every claim refer to a class, interface, relationship, decision, edge case or requirement that actually exists in the submission? |
| **Correctness** | Does the finding logically follow from what the design actually shows, not from what a similar design usually has? |
| **Relevance** | Does it address the criterion or the problem's own stated constraints, rather than a generic checklist? |
| **Actionability** | Could the learner make a concrete next edit from this, without guessing what "better" means? |
| **Non-canonical reasoning** | Does it avoid implying there is one correct decomposition, or that a difference from some other design is itself a defect? |
| **Proportionality** | Does it avoid recommending an abstraction, pattern or layer the design's own stated requirements do not justify? |
| **Uncertainty** | Does it say plainly when the submission does not show enough to judge confidently, rather than filling the gap with an assumption? |

This is a checklist for a human reviewing output — including a *live* model's
output, when one is deliberately run outside the default suite — not a scoring
formula, and it produces no number.

## Live-model benchmarking (optional, never required)

Nothing in `npm test`, `npm run test:integration`, `npm run verify` or CI needs
a Groq key. If a maintainer wants to see how a real model performs against
these same cases, `tests/benchmarks/fixtures.ts`'s designs can be run through a
real `GroqLLMProvider` in a throwaway script, reading the output against the
rubric above by hand. That workflow is deliberately not built into this
milestone: it would need judgement each time, not a boolean the suite could
assert, and building an automated "grade the live model's grade" harness is
exactly the circular validation the previous section rules out.

## Honest limitations

- Nine designs against one problem (Parking Lot) is deliberately small. It
  demonstrates specific behaviours; it says nothing about how the evaluator
  performs on problems or design shapes not represented here.
- The mocked judge answers are written by a person who knows what the
  benchmark is trying to show. A real model, given the same design, may reach
  different conclusions — reasonably so, since a judge's semantic assessment is
  a judgement, not a fact. The benchmark's claims are about the pipeline's
  handling of an answer, not about what a live model will say.
- `HybridEvaluator`'s persisted `evaluatorVersion` records the join version
  (`hybrid-v1`) rather than a composite of `RuleBasedEvaluator`'s and
  `AIDesignEvaluator`'s own version constants. `promptVersion` separately
  tracks AI prompt wording changes, but a change to the AI evaluator's own
  grounding or validation code (a change to `AI_EVALUATOR_VERSION` with no
  prompt change) would not, on its own, be visible in a stored evaluation's
  versions when run through the hybrid path. This is a known, narrow gap,
  intentionally not changed in M10 — the fix would alter the persisted
  idempotency-key format and several pre-existing integration tests across
  M2–M6, for a benefit that is currently theoretical; see the M10 final audit's
  "Remaining Risks" for the trade-off as considered at the time.
