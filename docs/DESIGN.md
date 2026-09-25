# Design note

A concise technical design summary. For depth, see `docs/RESEARCH.md` (why),
`docs/ARCHITECTURE.md` (how the layers fit together and why), `AI_USAGE.md`
(where AI is used and how its output is validated), `docs/EVALUATION_BENCHMARK.md`
(how evaluation quality is checked), and `docs/adr/` (specific decisions).

## MVP scope

A learner can: browse a small library of LLD problems, start an attempt,
build a structured design (classes, interfaces, relationships, decisions,
edge cases, requirement mappings), save a draft, submit it, run a review that
combines deterministic checks with an AI semantic judge, read evidence-backed
feedback, retry a failed review, start a second attempt, and compare two
attempts to see what changed, what improved, and what regressed. An optional
Design Coach answers a specific question about the current attempt.

Explicitly out of scope for this MVP: authentication (single seeded learner),
a diagram or code submission format, a background evaluation queue, and any
distributed infrastructure (Kafka, Redis, a separate vector database,
microservices) — see ADR-001, ADR-005, ADR-006, ADR-008.

## User journey

```text
Choose Problem
  → Understand Requirements   (context, constraints, requirements, priorities)
  → Build Design               (classes, interfaces, relationships, decisions, edge cases, requirement mapping)
  → Save Draft                 (server-validated, advisory — never blocks saving)
  → Submit                     (frozen from here on; server-validated, blocking)
  → Evaluate                   (deterministic + AI, or deterministic alone with no model configured)
  → Review Evidence            (strengths, priority improvements, structural checks, semantic judgements, what grounded it)
  → Ask the Coach (optional)   (a specific question, grounded in the same design + evaluation)
  → Refine                     (a new attempt on the same problem)
  → Compare Attempts           (what changed, what improved, what regressed, what remains)
```

## Domain model

```text
Problem
  ├── Requirement[]           (code, title, description, priority MUST/SHOULD)
  ├── constraints, context
  └── Rubric                  (which criteria this problem is judged on)

Attempt                        (state machine: IN_PROGRESS → SUBMITTED → EVALUATING → COMPLETED | FAILED)
  ├── draftDesign              (mutable while IN_PROGRESS)
  └── Submission[]             (immutable once created; one per attempt in the MVP)
        ├── StructuredDesign   (classes, interfaces, relationships, decisions, edgeCases, requirementMappings)
        └── Evaluation         (own lifecycle: PENDING → EVALUATING → COMPLETED | FAILED)
              ├── CriterionResult[]   (criterion, assessment, evidence, confidence?, concern?, suggestion?)
              ├── FeedbackItem[]      (priority improvements, each with evidence and a "why")
              └── KnowledgeCitation[] (provenance of retrieved guidance, when any was used)
```

Important classes/interfaces (all in `src/domain` and `src/application/ports`
unless noted):

- `Attempt`, `Submission`, `Evaluation` — entities with their own explicit
  state machines and invariants (`assertOperationAllowed`,
  `assertEvaluationTransition`); no implicit state.
- `StructuredDesign` and its sub-shapes — the typed submission format
  (ADR-002); `validateStructuredDesign` is the one place its rules live.
- `DesignEvaluator` (port) — implemented by `RuleBasedEvaluator`,
  `AIDesignEvaluator`, and `HybridEvaluator` (`src/evaluation-engine`).
- `LLMProvider` (port) — implemented by `GroqLLMProvider`
  (`src/infrastructure/ai`) and `FakeLLMProvider` (tests only).
- `KnowledgeContextProvider` / `KnowledgeRepository` (ports) — the RAG layer.
- `DesignCoach` (port) — implemented by `LLMDesignCoach`
  (`src/coach-engine`).
- `buildAttemptComparison` (pure function, `src/domain/comparison`) — the
  M8 evolution/regression comparator; no port, because it needs nothing but
  plain values already loaded by its one caller.

## Evaluation architecture

```text
Submission (frozen)
  → Deterministic validation      (validateStructuredDesign, RuleBasedEvaluator)
  → Knowledge retrieval           (if a knowledge layer is configured)
  → AI semantic evaluation        (AIDesignEvaluator, given the deterministic outcome + retrieved knowledge)
  → Evidence validation           (validateEvidence — reject anything not traceable to the submission)
  → Feedback composition          (HybridEvaluator concatenates both outcomes; never a blended score)
  → Persistence                   (with evaluator/prompt/provider/model/knowledge versions recorded)
```

**Deterministic vs. AI responsibilities** (see ADR-003):

| Deterministic (`RuleBasedEvaluator`) | Semantic (`AIDesignEvaluator`) |
|---|---|
| `STRUCTURAL_VALIDITY`, `REQUIREMENT_COVERAGE`, `DESIGN_COMPLETENESS`, `EDGE_CASE_COVERAGE`, `DESIGN_DECISIONS` | Responsibility, cohesion, coupling, encapsulation, abstraction, extensibility, design reasoning, edge-case reasoning, testability |
| Facts a reader could verify by hand | Judgements requiring reasoning about intent and trade-offs |
| Never `STRONG`, never a confidence | Carries an assessment, a confidence, and evidence |
| Runs with no model configured | Requires `GROQ_API_KEY`; the coach reports itself unavailable without one |

The two criterion sets are disjoint by construction, so the AI evaluator can
never overwrite a deterministic fact — proven behaviourally in
`tests/benchmarks/hybrid-grounding.test.ts`.

## RAG

Retrieval supplies grounding, never a canonical answer: the knowledge base
holds general LLD/OOP/SOLID/pattern/design-smell guidance, never a worked
solution for any specific problem. `KnowledgeContextBuilder` retrieves a
bounded number of passages by embedding similarity, filtered by topic, and
renders them into the prompt as clearly labelled reference material with
provenance (document, chunk, topic, score) recorded on the stored evaluation.
The Design Coach reuses the same retrieval stack, adding only the learner's
own (fenced, untrusted) question to the query — see `docs/ARCHITECTURE.md`'s
"The design coach" section.

## Design Coach

The coach answers one question about one attempt, grounded in that attempt's
actual problem, current design, current evaluation (if any), and a bounded
summary of the immediately preceding attempt. It never redesigns the
learner's solution: its prompt states directly that a design differing from
another is not automatically worse, and it is expected to say "your current
design does not show this problem" when that is the honest answer. See
`docs/ARCHITECTURE.md#the-design-coach` and README's "Design coach" section
for the full grounding and injection-defence detail.

## Attempt comparison

A pure, deterministic function (`buildAttemptComparison`) diffs two designs
element by element (classes, interfaces, relationships, decisions, edge
cases), tracks requirement-coverage transitions, and checks whether the
earlier attempt's own findings still apply to the later design. It is
**derived, not persisted** — recomputed from two already-immutable
submissions and evaluations, so it is always current and costs nothing to
keep in sync. See `docs/ARCHITECTURE.md`'s "Design evolution" section for the
full identity, feedback-resolution and criterion-comparison rules.

## Extensibility

- **New evaluator**: implement `DesignEvaluator`; `EvaluateAttempt` needs no
  change.
- **New submission format**: extend `SubmissionFormatType`; the domain model
  already treats format as a variant, not an assumption (ADR-002).
- **New LLM provider**: implement `LLMProvider`; nothing above the port
  changes (ADR-004).
- **New knowledge store**: implement `KnowledgeRepository`; retrieval logic
  is unaffected (ADR-005).

## Failure handling

An evaluation's own lifecycle (`PENDING → EVALUATING → COMPLETED | FAILED`) is
independent of the attempt's: a failed evaluation never invalidates or
discards the submission it was run against. `RetryEvaluation` re-runs a
failed evaluation idempotently, keyed by `attemptId:submissionVersion:evaluatorVersion`,
so a duplicate request cannot produce two competing evaluations. A judge
timeout, rate limit, or malformed answer surfaces as a typed, safe error
(never a stack trace or provider detail) with a message that states plainly
that nothing about the attempt was lost.

## Major trade-offs

- **Synchronous, in-process evaluation** over a queue (ADR-006) — simpler,
  fully testable today; revisit only if a real volume or latency problem
  appears.
- **No canonical solution** over scoring against a reference design (§5 in
  `docs/RESEARCH.md`) — the harder, more honest evaluation problem, chosen
  because the easier one would misjudge every valid alternative design.
- **Strict evidence grounding** over trusting a model's fluent claim
  (ADR-007) — a true finding phrased loosely can be lost to this strictness;
  accepted as the safer failure direction.
- **A behavioural benchmark, not a numeric accuracy score**
  (`docs/EVALUATION_BENCHMARK.md`) — because no ground truth exists for LLD
  quality to measure accuracy against; the trade-off is a benchmark that
  proves specific behaviours rather than a headline number.
