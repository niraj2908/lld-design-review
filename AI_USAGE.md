# AI usage in DesignReview

This document says, plainly, where a language model is involved in this
product, what it is and is not trusted to do, how its output is validated
before a learner ever sees it, and what the current evidence does and does not
support. It is written to be checked against the code, not taken on faith —
every claim below names the file that enforces it.

## Where AI is used

| Feature | Model involved? | What it does |
|---|---|---|
| Deterministic structural checks (`RuleBasedEvaluator`) | No | Checks facts a reader could verify by hand: names unique, references resolve, requirements mapped, decisions and edge cases recorded. |
| Semantic design judgement (`AIDesignEvaluator`) | Yes | Judges nine criteria a fact-checker cannot settle — responsibility, cohesion, coupling, encapsulation, abstraction, extensibility, design reasoning, edge-case reasoning, testability. |
| Knowledge retrieval (`SemanticKnowledgeRetriever`) | Only for embeddings | Retrieves relevant design-guidance passages by vector similarity; the retrieval itself is not generative. |
| Design Coach (`LLMDesignCoach`) | Yes | Answers a learner's specific question about their own attempt, grounded in the same design, evaluation and knowledge as above. |
| Attempt comparison (M8) | No | Purely deterministic — see `docs/ARCHITECTURE.md#design-evolution`. |

Nowhere in this list does a model decide whether a requirement is covered, run
without its output being independently checked, or receive a reference
solution to compare a submission against.

## What is deterministic vs. what is model-generated

**Deterministic, always, regardless of whether a model is configured:**

- `STRUCTURAL_VALIDITY`, `REQUIREMENT_COVERAGE`, `DESIGN_COMPLETENESS`,
  `EDGE_CASE_COVERAGE`, `DESIGN_DECISIONS` — the five criteria
  `RuleBasedEvaluator` reports on (`src/evaluation-engine/rule-based-evaluator.ts`).
  These never claim `STRONG` and never carry a confidence score, because they
  state a fact rather than a judgement.
- Every attempt comparison (`buildAttemptComparison`,
  `src/domain/comparison/attempt-comparison.ts`) — no model call anywhere in
  that path.
- Requirement coverage specifically is decided **only** by an explicit mapping
  the learner wrote (`classifyRequirementCoverage`,
  `src/evaluation-engine/rules/requirement-coverage.ts`). A class name that
  merely sounds relevant is not evidence.

**Model-generated, always validated before it is trusted:**

- The nine semantic criteria `AIDesignEvaluator` reports on — an assessment, a
  confidence, evidence, and optionally a concern and a suggestion, per
  criterion.
- The Design Coach's answer, observations, recommendation (if any), cited
  evaluation references, and certainty.

## How model output is validated

Three independent checks stand between a model's raw answer and anything a
learner sees, for both the evaluator and the coach:

1. **Schema validation.** The provider is asked to constrain its output to a
   JSON Schema derived from a Zod schema
   (`aiReviewSchema` / `coachAnswerSchema`), and the Zod schema re-validates the
   answer regardless — "a provider's schema mode is a hint, not a guarantee"
   (`src/evaluation-engine/ai/ai-response-schema.ts`). An answer that does not
   fit is a **failed** evaluation or coach request, never a partial one
   (`LLMResponseFormatError`).
2. **Evidence grounding.** Every piece of evidence a model cites is checked
   against the actual submitted design (`validateEvidence`,
   `src/domain/evaluation/evidence-validation.ts`): the named entity must exist,
   the field must be one the format has, and the quoted value must actually
   appear there. Evidence that fails is dropped, and a finding left with no
   verified evidence is dropped entirely — never shown as if it were confirmed.
   `unverifiedEvidenceCount` records how much was discarded, so a reader can see
   a judgement rests on less grounding than it claimed.
3. **Criterion-remit filtering.** A model output naming a criterion outside its
   remit is dropped (`isAICriterion`,
   `src/evaluation-engine/ai/ai-criteria.ts`; `filterKnownCriteria`,
   `src/domain/coach/evaluation-reference-validation.ts` for the coach). This is
   what stops a judge's prose opinion about a deterministic fact — "this
   requirement is probably covered" — from ever reaching a stored outcome; see
   `docs/EVALUATION_BENCHMARK.md#hybrid-grounding-a-judge-cannot-move-a-fact`.

Learner-authored text (the design, and the coach's question) is treated as
untrusted data, never as instructions: it is fenced with clear delimiters in
every prompt, and `neutraliseFences()` strips anything that could fake a
section boundary. The system prompt is assembled from versioned constants only
— no learner text is ever concatenated into it. Regression tests for this live
in `ai-prompt.test.ts`, `rag-integration.test.ts`, `design-coach.test.ts`, and
at the integration level in `tests/integration/learner-journey.test.ts`.

## No canonical solution

No file in this codebase holds a reference design, a model answer, or a scored
rubric structure for any problem. `AIDesignEvaluator`'s and `LLMDesignCoach`'s
prompts state this directly and instruct the model that a design differing from
some other design is not, by itself, a defect. `docs/EVALUATION_BENCHMARK.md`'s
valid-alternative and over-engineering cases exist specifically to catch a
regression of this rule, should one ever be introduced.

## Worked examples of AI-assisted engineering decisions

This project was built with an AI coding assistant (Claude Code) acting as
the implementer, working from a detailed human-authored specification and
milestone-by-milestone review. The examples below are real decision points
from that process, not a fabricated conversation — each names the actual
files and behaviour that resulted, which can be checked against the code.

### 1. Deterministic vs. semantic evaluation split

**Decision:** how should structural facts (does every relationship's
endpoints exist? is a requirement mapped to anything?) and design judgements
(is this abstraction justified? is this class doing too much?) be evaluated?

**What AI suggested:** the straightforward approach — one AI evaluator judging
every criterion, including requirement coverage, from the submission and the
requirements together.

**What we accepted:** splitting into two evaluators behind one
`DesignEvaluator` port — `RuleBasedEvaluator` for five criteria a fact-checker
can settle, `AIDesignEvaluator` for nine that need judgement — joined by
`HybridEvaluator`, with the two criterion sets kept disjoint by construction.

**What we rejected:** a single evaluator deciding everything, including
requirement coverage.

**Why:** requirement coverage has one checkable answer (is there an explicit
mapping?), and asking a judge to also decide it invites the judge to
contradict — or paper over — a fact it should never have been asked to
re-decide. `tests/benchmarks/hybrid-grounding.test.ts` exercises exactly this:
a scripted judge claiming a requirement is "probably covered" cannot move the
deterministic finding. See ADR-003.

### 2. Rejecting canonical-answer matching

**Decision:** how to judge whether a learner's design decomposition is good.

**What AI suggested, and initially built into early benchmark scaffolding:**
comparing a submission's structure against a reference/expected design for
the problem was the fastest thing to implement and the easiest to reason
about mechanically.

**What we accepted:** no reference design anywhere in the system, ever — not
in the evaluator's prompt, not in the coach's context, not in any test
fixture used as a target to match against. Evaluation instead reasons from
the problem's stated requirements, constraints, and a rubric.

**What we rejected:** any form of "compare against a stored correct design"
scoring, including using the project's own `validParkingLotDesign()` test
fixture as an implicit reference — its doc comment explicitly states it is
"one valid answer, not the answer."

**Why:** two structurally different decompositions can both be strong designs
if both satisfy the requirements. A canonical-answer approach would penalize
a learner for a different, equally valid choice — the exact failure mode
`docs/EVALUATION_BENCHMARK.md`'s valid-alternative benchmark case exists to
catch, and the one behaviour every non-canonical prompt (the evaluator's, the
coach's) states directly to the model.

### 3. Modular monolith over microservices

**Decision:** how to structure the codebase given clearly separable concerns
(problems, attempts, evaluation, knowledge/RAG, comparison, coaching).

**What AI suggested:** because the domain has clean seams, it would be
technically straightforward to split evaluation, knowledge retrieval, and the
coach into separately deployable services from the start.

**What we accepted:** one Next.js application with the seams enforced by
layering and automated architecture tests (`tests/architecture/layering.test.ts`)
instead of network boundaries.

**What we rejected:** microservices, a service mesh, or any per-domain
deployable unit.

**Why:** the assignment's centre of gravity is low-level design, not
distributed-systems engineering, and this project's actual scale does not
demonstrate a need multiple services would solve. The ports at each seam
(`DesignEvaluator`, `LLMProvider`, `KnowledgeContextProvider`) are already the
right extraction points if that ever changes. See ADR-001.

### 4. RAG for grounding, not for retrieving a canonical answer

**Decision:** what the knowledge base should contain and what retrieval
should be used for.

**What AI suggested:** retrieval could plausibly include problem-specific
worked guidance ("for a parking lot, consider a PricingStrategy interface"),
which would make evaluations feel more specific and helpful.

**What we accepted:** a knowledge base of general LLD/OOP/SOLID/pattern/
design-smell principles, with retrieval filtered by topic — never
problem-specific worked solutions — and the prompt explicitly tells the model
that a retrieved passage is background reasoning material, never a checklist
or an answer.

**What we rejected:** problem-specific "expected design" guidance in the
knowledge base, and letting retrieved knowledge become citable "evidence"
about what the learner did (a knowledge citation and a design-evidence
citation are kept in structurally separate fields on every result, on
purpose).

**Why:** the moment retrieval starts resembling an answer key for a specific
problem, the product's core "no canonical solution" guarantee is undermined
through a side door — the model doesn't need a reference design in its
prompt if retrieval quietly hands it a description of one.

### 5. Handling a retired model id (this milestone)

**Decision:** the configured Groq model (`llama-3.3-70b-versatile`) had been
retired by the provider, discovered via a real integration-test failure
during this milestone's verification pass.

**What AI suggested:** query Groq's own `/v1/models` endpoint live with the
project's actual key to see which ids the key could really use, rather than
guessing a replacement from memory or documentation that could itself be
stale.

**What we accepted:** switching the default to `openai/gpt-oss-120b`,
verified with a real, live call through this project's actual
`GroqLLMProvider` and `AIDesignEvaluator` (not a synthetic test) before
committing to it. That live call also surfaced a second, real problem: the
new model rejects `strict: true` structured-output mode under an OpenAI-style
schema unless every optional property is also listed as `required` (expressed
as nullable) — a stricter contract than the Zod-generated schemas here use.
`GroqLLMProvider` was changed to request `strict: false` instead of loosening
the domain's own Zod validation to match the stricter dialect.

**What we rejected:** weakening `aiReviewSchema` or `coachAnswerSchema` to
satisfy the provider's strict-mode contract, and guessing a replacement model
id without a live check.

**Why:** `strict` is the provider's constraint on what it *generates* — the
Zod schema re-validates the answer regardless ("a provider's schema mode is a
hint, not a guarantee"), so relaxing the provider-side constraint costs
nothing in actual safety, while loosening the domain's own validation would
have been a real, unjustified reduction in what this project can guarantee
about model output. Automated tests were left entirely on `FakeLLMProvider`
throughout — the live check was a manual, one-off verification, never made a
requirement for `npm test` to pass.

## Limitations, stated honestly

- **This is not a claim of general accuracy.** The benchmark suite in
  `tests/benchmarks/` provides curated behavioural coverage for representative
  design cases; it does not establish that the AI evaluator or the Design Coach
  is accurate in general, on problems or design shapes the suite does not
  cover. See `docs/EVALUATION_BENCHMARK.md` for exactly what is and is not
  claimed.
- **A judge's semantic assessment is a judgement, not a fact**, and the product
  says so wherever one is shown: semantic criteria are labelled `SEMANTIC`
  (never `FACTUAL`), carry a confidence, and the UI never presents them as
  settled the way a structural finding is.
- **Model behaviour is not deterministic**, and this is not papered over: the
  benchmark suite scripts a fixed answer via `FakeLLMProvider` specifically
  because a live model's wording, and sometimes its judgement, can vary between
  runs on the same input. What the codebase can and does guarantee
  deterministically is schema validity, evidence grounding, criterion
  restriction, and safe rejection of a malformed answer — not the model's
  reasoning itself.
- **No model is ever asked to grade its own or another model's answer.** Every
  validation in this codebase is deterministic, structural, or a
  human-authored fixture expectation — see
  `docs/EVALUATION_BENCHMARK.md#no-model-grading-itself`.
- **`HybridEvaluator`'s persisted version does not separately record its two
  inner evaluators' own version constants** when they change independently of
  the join logic or the prompt wording — a known, narrow traceability gap, not
  fixed in M10 because the fix would touch a persisted idempotency-key format
  and several pre-existing integration tests for a currently theoretical
  benefit. See `docs/EVALUATION_BENCHMARK.md`'s "Honest limitations".

## Testing without live model calls

`npm test`, `npm run test:integration`, `npm run verify` and CI never require a
Groq or OpenAI credential. Every test exercising AI-dependent code paths uses
`FakeLLMProvider` (`src/testing/fake-llm-provider.ts`) or
`FakeKnowledgeContextProvider` (`src/testing/fake-knowledge.ts`) — deterministic
test doubles that record what they were asked and return a scripted answer or a
scripted failure. The only place a real provider is constructed is the
composition root (`src/infrastructure/composition-root.ts`), gated on whether a
Groq key is configured in the environment; without one, the deterministic
evaluator runs alone and the Design Coach reports itself unavailable rather
than degrading silently.
