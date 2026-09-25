# DesignReview

An LLD (Low-Level Design) practice and review platform. A learner picks a
problem, builds a structured design, submits it, and gets evidence-grounded
review feedback they can act on and resubmit — the product is the review
loop, not a score.

Full product and engineering intent lives in `DESIGNREVIEW_MASTER_SPEC.md`;
this README is the practical entry point. See also `docs/RESEARCH.md` (why),
`docs/DESIGN.md` (concise technical design note), `docs/ARCHITECTURE.md` (how
the layers fit together), `AI_USAGE.md` (where AI is used and how its output
is validated), `docs/EVALUATION_BENCHMARK.md` (how evaluation quality is
checked), and `docs/adr/` (specific architectural decisions).

**Status:** milestone 11 — final product & submission readiness. Milestones
1–10 delivered the full learner loop below; this milestone is documentation,
UX, and deployment-readiness work, not a new feature. See
`docs/DESIGN.md`'s "MVP scope" for what is and is not built.

## 1. Overview

Learners practising low-level design commonly get one of two things: a
problem with no feedback loop at all, or a numeric AI-generated score with no
way to see *why*. DesignReview is built around a different premise — a
learner should be able to design, submit, receive feedback that names the
specific class, relationship, or requirement it is about, refine the design,
and see whether their next attempt actually addressed what was raised.

A learner can: browse a small library of LLD problems, start an attempt,
build a structured design directly (classes, interfaces, relationships,
decisions, edge cases, requirement mappings), save a draft, submit it, run a
review combining deterministic structural checks with an AI semantic judge,
read evidence-backed feedback, retry a failed review, start a second attempt,
compare two attempts to see what changed, and optionally ask a Design Coach a
specific question about the current attempt.

## 2. Product thesis

> Design quality cannot always be judged against one canonical answer.

Two structurally different designs can both be strong solutions if both
satisfy a problem's stated requirements and demonstrate sound engineering
judgement. A platform that scores every submission against one reference
design would penalize a learner for choosing a different, equally valid
decomposition — which is exactly the mistake this platform is built to avoid
(see `docs/RESEARCH.md` §5, and the "valid alternative" benchmark case in
`docs/EVALUATION_BENCHMARK.md`).

DesignReview instead evaluates a design against:

- the problem's explicit requirements and constraints,
- objective structural validity (do relationships resolve, is everything
  named, is a requirement actually mapped to something),
- responsibility, coupling, cohesion, abstraction, and extensibility —
  judged as reasoning about trade-offs, not compliance with a template,
- edge-case coverage and the design decisions the learner actually recorded,

while preserving that more than one design can be correct. See
`docs/RESEARCH.md` for the full reasoning and what existing LLD tools already
cover that this platform deliberately does not try to out-feature.

## 3. Core workflow

```text
Choose Problem
  → Understand Requirements
  → Build Design
  → Submit
  → Evaluate
  → Review Evidence
  → Refine
  → Compare Attempts
```

Submitting freezes a design. A second attempt on the same problem sits
alongside the first, which is what makes comparing the two — seeing what
changed, what improved, what regressed — possible. See `docs/DESIGN.md`'s
"User journey" for the full flow including the optional Design Coach step.

## 4. Features

Only what is actually implemented and tested:

- **Problem library** — four curated LLD problems (Parking Lot, Vending
  Machine, Elevator System, Notification System), each with explicit
  requirements, constraints, and context.
- **Structured LLD editor** — the learner directly manipulates classes,
  interfaces, relationships, design decisions, edge cases, and requirement
  mappings; there is no free-text submission and no AI-generated starting
  point.
- **Draft persistence** — a draft saves to the server, is validated
  advisorily (issues are shown but never block saving), and survives leaving
  and returning.
- **Submission** — a structured design, validated and frozen; the attempt's
  lifecycle (`IN_PROGRESS → SUBMITTED → EVALUATING → COMPLETED | FAILED`) is
  enforced by the domain, not by the UI.
- **Deterministic evaluation** — five criteria checkable from the submission
  alone: structural validity, requirement coverage, design completeness,
  edge-case coverage, and design-decision coverage.
- **AI semantic evaluation** — nine criteria requiring judgement:
  responsibility, cohesion, coupling, encapsulation, abstraction,
  extensibility, design reasoning, edge-case reasoning, testability.
- **Grounded knowledge retrieval (RAG)** — general LLD/OOP/SOLID/pattern/
  design-smell guidance retrieved and cited, never a worked answer for any
  specific problem.
- **Evidence-backed feedback** — every substantive AI concern names a real
  class, field, relationship, decision, or edge case in the submission;
  anything that cannot be verified is dropped, never shown as if confirmed.
- **Evaluation status, failure, and retry** — a failed evaluation never
  discards the submission it ran against, and retry is idempotent.
- **Attempt history** — every attempt is kept; nothing is overwritten by a
  later one.
- **Attempt comparison / design evolution** — added, removed, modified, and
  unchanged elements; requirement-coverage transitions; whether a prior
  concern looks addressed; and new concerns, all in one comparison.
- **Design Coach** — answers one grounded question about the current attempt;
  never redesigns the learner's solution.
- **Evaluation benchmark suite** — nine curated design cases plus a
  regression scenario, checked behaviourally, with no live model call
  required and no numeric "accuracy" claim.

## 5. Architecture

```text
UI (Next.js pages, API routes, client components)
  ↓
Application (use cases + ports)
  ↓
Domain (entities, invariants, state machines, validation)
  ↑
Ports (interfaces: DesignEvaluator, LLMProvider, KnowledgeContextProvider, repositories, DesignCoach)
  ↑
Infrastructure adapters (Prisma repositories, GroqLLMProvider, embedding providers)
```

One Next.js application, arranged as ports and adapters — a modular monolith,
not microservices (ADR-001). Dependencies point one way: infrastructure knows
about the domain and the application's ports, but the domain and application
core know nothing about Next.js, React, Prisma, PostgreSQL, or Groq. This is
enforced twice — by `no-restricted-imports` overrides in `.oxlintrc.json` and
by `tests/architecture/layering.test.ts` — so a violation fails lint and the
test suite, not just a code review.

**Why the domain/application core has no framework or vendor dependency:**
every evaluator, the coach, and every repository are ports the domain and
application layer depend on as interfaces, never as concrete Prisma or Groq
calls. This is what lets `RuleBasedEvaluator`, `AIDesignEvaluator`,
`HybridEvaluator`, and every test double (`FakeLLMProvider`,
`FakeKnowledgeContextProvider`, `FakeDesignCoach`) implement the exact same
contract a real adapter does, and it is why the entire test suite runs
without a database or an API key.

See `docs/ARCHITECTURE.md` for the full layer diagram and per-layer rationale,
and `docs/adr/` for the specific decisions (modular monolith, structured
submission, hybrid evaluation, the LLM provider abstraction, PostgreSQL +
pgvector, synchronous evaluation, evidence grounding, and why Kafka is
deferred).

## 6. Evaluation architecture

```text
Submission (frozen)
  → Deterministic validation      (validateStructuredDesign, RuleBasedEvaluator)
  → Knowledge retrieval           (if a knowledge layer is configured)
  → AI semantic evaluation        (AIDesignEvaluator, given the deterministic outcome + retrieved knowledge)
  → Evidence validation           (validateEvidence — reject anything not traceable to the submission)
  → Feedback composition          (HybridEvaluator concatenates both outcomes; never a blended score)
  → Persistence                   (evaluator/prompt/provider/model/knowledge versions recorded)
```

**Deterministic vs. semantic evaluation:**

| Deterministic (`RuleBasedEvaluator`) | Semantic (`AIDesignEvaluator`) |
|---|---|
| Structural validity, requirement coverage, design completeness, edge-case coverage, design-decision coverage | Responsibility, cohesion, coupling, encapsulation, abstraction, extensibility, design reasoning, edge-case reasoning, testability |
| Facts a reader could verify by hand | Judgements about intent and trade-offs |
| Never `STRONG`, never a confidence score | Carries an assessment, a confidence, and evidence |
| Runs with no model configured | Needs `GROQ_API_KEY`; the deterministic evaluator runs alone without one |

The two criterion sets are disjoint by construction (`natureOf`, checked by
`criteriaAreDisjoint`), so the AI judge can never overwrite a deterministic
fact — demonstrated behaviourally in
`tests/benchmarks/hybrid-grounding.test.ts`, where a judge's prose claim that
a requirement is "probably covered" cannot move the actual, deterministic
finding. See ADR-003 for the full rationale.

## 7. RAG architecture

```text
Problem context
  +
Design
  +
Knowledge retrieval (topic-filtered, embedding-similarity)
  →
LLM evaluation
  →
Evidence-grounded feedback
```

Retrieval supplies **grounding, not a canonical answer**. The knowledge base
holds general design principles — OOP, SOLID, patterns, design smells,
problem-general LLD reasoning — and never a worked solution for any specific
problem. The prompt tells the judge directly that a retrieved passage which
reads like a prescription is not one, and a knowledge citation is recorded in
a structurally separate field from design evidence: a retrieved passage can
never become "evidence" of what the learner actually did. See
`docs/ARCHITECTURE.md`'s "Hybrid review, grounded" and "The knowledge layer"
sections, and ADR-005 for why PostgreSQL + pgvector rather than a separate
vector store.

## 8. Design Coach

The coach answers one question about one attempt at a time — "Why is
`PaymentService` so coupled?", "Should I add an interface here?" — grounded
in:

- the current problem (requirements, constraints, context),
- the current design (the draft while `IN_PROGRESS`, the frozen submission
  once it is not),
- the current evaluation's evidence, when one has completed,
- a bounded summary of the immediately preceding attempt (assessments and
  improvement titles only — never that attempt's full design),
- the same grounded knowledge retrieval the evaluator uses.

It follows one rule throughout: **evidence first, knowledge second, reasoning
third, recommendation last.** It does not automatically redesign the
learner's solution — its prompt states directly that a different structure is
not automatically worse, and `design-coach.test.ts` proves this
behaviourally: given a design with one gateway implementation and no stated
requirement to swap it, the coach does not recommend an interface just
because a learner asked whether it should have one. The learner remains the
one who edits their own design; the coach has no way to change it and its
prompt instructs it never to write as though it did.

Full detail — grounding, prompt-injection defence for both the design and the
learner's question, and why the coach is stateless (no stored conversation) —
is below in [Design coach](#design-coach) and in
`docs/ARCHITECTURE.md#the-design-coach`.

## 9. Attempt evolution

A learner's second attempt is only useful if they can see what changed and
whether it addressed what the first attempt's review raised. The comparison
covers:

- **added / removed / modified / unchanged** elements — classes, interfaces,
  relationships, decisions, edge cases,
- **requirement coverage evolution** — which requirements gained or lost
  coverage between the two attempts,
- **feedback resolution** — whether each of the first attempt's findings
  looks addressed, is still present, or is uncertain,
- **regressions** — a criterion that got worse, reported independently of
  any criterion that got better; never collapsed into one verdict.

Full detail — why comparison is derived rather than persisted, how identity
across attempts is decided, and the exact feedback-resolution and
criterion-comparison rules — is below in [Design evolution](#design-evolution).

## 10. Database

Prisma models, not the full schema (see `prisma/schema.prisma` for exact
columns and indexes):

```text
Learner ──< Attempt >── Problem ──< Requirement
                │                └── ProblemRubric ──< RubricCriterion
                ├── draftDesign: Design (mutable while IN_PROGRESS)
                └──< Submission >── Design (immutable snapshot)
                          │            ├──< DesignClass
                          │            ├──< DesignInterface
                          │            ├──< DesignRelationship
                          │            ├──< DesignDecision
                          │            ├──< DesignEdgeCase
                          │            └──< DesignRequirementMapping >── DesignRequirementMappingReference
                          │
                          └──< Evaluation
                                  ├──< EvaluationCriterionResult >── EvaluationCriterionEvidence
                                  ├──< EvaluationFeedbackItem >── EvaluationFeedbackEvidence
                                  └──< EvaluationKnowledgeCitation

KnowledgeDocument ──< KnowledgeChunk   (embedded, pgvector similarity search)
```

Notable design points:

- **`Design` is shared shape, split ownership.** The same `Design` model
  backs both an attempt's mutable draft and a submission's immutable
  snapshot; a submission never shares a row with a draft, so submitted work
  cannot be edited through the draft path.
- **Structured elements are real tables**, not a JSON blob — classes,
  interfaces, relationships, decisions, and edge cases are each their own
  table, so a design is queryable and evidence can reference a specific row.
- **Every evaluation stores its own provenance** — evaluator, rubric,
  prompt, provider, model, and knowledge versions — directly on the
  `Evaluation` row, so a historical result stays interpretable even after
  those versions change.

See `docs/ARCHITECTURE.md`'s "Persistence design notes" and "Transaction
boundaries" sections for the full reasoning.

## 11. Technology stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Backend | Next.js API routes over the same application use cases, Zod for schema validation |
| Database | PostgreSQL, Prisma 7, pgvector (knowledge embeddings) |
| AI | `LLMProvider` port; `GroqLLMProvider` adapter (OpenAI-compatible structured output); OpenAI-compatible embedding provider, with a local lexical fallback for offline development and tests |
| Testing | Vitest (unit, architecture, and integration tests), `@testing-library/react` for components |
| Linting / types | oxlint, TypeScript strict mode |

Styling is hand-written CSS design tokens (`src/app/globals.css`), not a
component library — an earlier stack note mentioned Tailwind and shadcn/ui,
but neither was installed; adding a styling toolchain in the milestone that
built the learner loop would have bought risk rather than speed. Fonts are
IBM Plex Sans/Mono, self-hosted via `next/font`.

## 12. Repository structure

```text
src/
  app/                  Next.js pages, API routes, client components, design tokens
  presentation/         request handling, DTOs, HTTP error mapping
  domain/               framework-independent entities, invariants, state machines
  application/          ports (interfaces) and use cases
  evaluation-engine/     RuleBasedEvaluator, AIDesignEvaluator, HybridEvaluator
  coach-engine/          LLMDesignCoach
  infrastructure/        Prisma client, repositories, mappers, seed, composition root
  testing/               in-memory doubles and fixtures used by tests only
prisma/
  schema.prisma         persistence schema
  migrations/            checked-in SQL migrations
  seed.ts                seed entry point
tests/
  architecture/          asserts the dependency direction holds
  integration/           use cases and repositories against real PostgreSQL
  benchmarks/            the M10 evaluation benchmark suite
docs/
  RESEARCH.md            why: learner problem, product landscape, product direction
  DESIGN.md              concise technical design note
  ARCHITECTURE.md        how the layers fit together, and why
  EVALUATION_BENCHMARK.md  what the benchmark proves, and does not
  adr/                   architecture decision records
docker-compose.yml       local PostgreSQL (pgvector image)
```

## 13. Local setup

### Prerequisites

- Node.js 20.9 or newer (developed on 26).
- Docker with Compose, for PostgreSQL. Integration tests need it; unit tests
  do not.

### Setup

```bash
cp .env.example .env     # once; defaults match docker-compose.yml
npm install               # also runs `prisma generate`
npm run db:up             # start PostgreSQL (waits until healthy)
npm run db:deploy         # apply the checked-in migrations
npm run db:seed           # insert the learner and the four problems
npm run knowledge:ingest  # chunk, embed and store the curated knowledge base
npm run dev                # http://localhost:3000
```

`npm run build` then `npm run start` for a production build. No API key is
needed to run the product at all: without one, the review runs the
deterministic evaluator alone and the knowledge base is embedded locally.

The Prisma client is generated into
`src/infrastructure/persistence/prisma/client` and is not committed. `npm
install` generates it; run `npm run db:generate` after changing
`prisma/schema.prisma`.

`npm run db:seed` is deterministic and safe to rerun: it upserts by stable id
and never touches attempts, submissions, or evaluations.

## 14. Environment variables

`.env.example` is the single source of truth for names and defaults — never
committed with real values filled in. Variable names only, no secrets:

| Variable | Required? | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Application and CLI database connection |
| `TEST_DATABASE_URL` | Only for integration tests | Separate database, truncated before each test |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_TEST_DB` / `POSTGRES_PORT` | Only for `docker-compose.yml` | Local container configuration |
| `GROQ_API_KEY` | No | Enables AI semantic evaluation and the Design Coach; without it, the deterministic evaluator runs alone |
| `GROQ_MODEL` | No | Overrides the default Groq model id (see [Language model](#language-model-optional)) |
| `GROQ_TIMEOUT_MS` / `GROQ_MAX_RETRIES` | No | Provider call ceiling and retry count |
| `EMBEDDING_API_KEY` | Required in production, optional otherwise | Selects semantic vs. local lexical embeddings — see [Knowledge base](#knowledge-base) |
| `EMBEDDING_BASE_URL` | No | Any OpenAI-compatible embeddings endpoint |
| `EMBEDDING_MODEL` / `EMBEDDING_DIMENSIONS` / `EMBEDDING_TIMEOUT_MS` | No | Embedding provider configuration |

## 15. Testing

```bash
npm test                  # unit and architecture tests (no database needed)
npm run test:integration  # use cases and repositories against real PostgreSQL
npm run test:coverage
npm run benchmark         # human-readable evaluation benchmark summary
npm run typecheck
npx oxlint
npm run build
npm run verify             # typecheck + lint + unit tests, one command
```

`npm test`, `npm run test:integration`, `npm run verify`, and CI never
require a Groq or OpenAI credential — every AI-dependent code path is tested
against `FakeLLMProvider` and `FakeKnowledgeContextProvider`
(`src/testing/`), deterministic test doubles that record what they were
asked and return a scripted answer.

Test coverage by kind:

- **Domain tests** — entity invariants, state-machine transitions,
  structured-design validation, evidence validation.
- **Application tests** — submit/evaluate/retry flows, ownership checks,
  idempotency.
- **Evaluation tests** — deterministic rule coverage, AI schema validation,
  evidence grounding, hybrid composition, prompt-injection defence.
- **Architecture tests** (`tests/architecture/layering.test.ts`) — the
  dependency direction is asserted, not just documented; several guards are
  proven by deliberately planting a violation and confirming the test fails
  before reverting it.
- **Integration tests** (`tests/integration/`) — real PostgreSQL and
  pgvector, fake LLM and embeddings; the full API-layer learner journey
  (browse → attempt → submit → evaluate → review → coach → compare) runs
  end to end.
- **Benchmark suite** (`tests/benchmarks/`) — see below.

### Running the integration tests

```bash
npm run db:up
npm run test:integration
```

They use the separate `designreview_test` database, created on first
container start, and truncate every table before each test. If PostgreSQL is
not running they fail with the commands above rather than being skipped
silently.

## 16. Benchmark

`npm run benchmark` runs nine curated design cases (strong, weak,
valid-alternative, over-engineered, missing-requirement, edge-case-heavy,
plus a two-attempt regression scenario) through the real deterministic,
semantic, and hybrid evaluators, scripted with `FakeLLMProvider` — never a
live model — and prints a readable pass/fail summary.

**What it proves:** the deterministic evaluator never manufactures a
structural complaint or claims `STRONG`; the semantic evaluator can identify
a real god-class or an unjustified factory layer while leaving a justified
abstraction and a plain, pattern-free design alone; a judge's claim can never
overwrite a deterministic fact; hallucinated evidence is rejected while real
evidence survives; and a two-attempt comparison can show an improvement and a
regression at once.

**What it does NOT prove:** general evaluator accuracy. Nine designs against
one problem is curated behavioural coverage, not a statistically meaningful
sample, and every case scripts a hand-written judge answer rather than
querying a live model — so no claim here is a claim about what a real model
will say on a case the suite does not cover. See `docs/EVALUATION_BENCHMARK.md`
for the full case-by-case rationale, why there is no numeric accuracy score,
and the AI evaluator quality rubric.

## 17. Security

- **API keys are server-side only.** `GROQ_API_KEY` and `EMBEDDING_API_KEY`
  are read from the environment inside `src/infrastructure/`; no client
  component or API response ever includes a key, a raw provider error, or an
  internal prompt.
- **Input validation** — every API route parses its body against a Zod
  schema (`src/presentation/api/design-schema.ts` and neighbours) before any
  application code runs; a malformed request never reaches a use case.
- **Structured LLM output is never trusted at face value.** Every model
  answer is parsed against a Zod schema, and every cited piece of evidence is
  checked against the actual submitted design before it can reach a learner
  (ADR-007, `AI_USAGE.md`).
- **Prompt injection.** Learner-authored text — the design, and the coach's
  question — is treated as untrusted data, never as instructions: it is
  fenced with clear delimiters in every prompt, `neutraliseFences()` strips
  anything that could fake a section boundary, and the system prompt is
  built only from versioned string constants. Regression tests cover this at
  the unit and integration level (`ai-prompt.test.ts`, `rag-integration.test.ts`,
  `design-coach.test.ts`, `tests/integration/learner-journey.test.ts`).
- **No arbitrary code execution.** There is no code-submission or execution
  path in this product; a design is structured data, never a script.
- **Errors never leak internals.** API errors are one envelope
  (`{ error: { code, message, issues? } }`) mapped from typed application and
  domain errors; no stack trace, driver message, or provider detail reaches a
  client (`src/presentation/api/http-error.ts`).
- **Environment secrets** are never committed — `.env.example` documents
  names and safe defaults only, and `.env` is git-ignored.

## 18. Limitations

Stated honestly, not minimized:

- **Evaluation runs synchronously, in-process**, not behind a queue or
  background worker (ADR-006). This is a deliberate, revisitable choice for
  this project's current scale, not an oversight — see the ADR for what
  would change if evaluation volume or latency ever became a real problem.
- **No authentication.** A single seeded learner is used throughout; a real
  deployment with multiple learners would need this added.
- **The benchmark is behavioural coverage, not a general accuracy claim** —
  see [Benchmark](#benchmark) above and `docs/EVALUATION_BENCHMARK.md` for
  exactly what is and is not established.
- **Model behaviour is not deterministic.** A live model's exact wording,
  and sometimes its judgement, can vary between runs on the same input. What
  is guaranteed deterministically is schema validity, evidence grounding,
  criterion restriction, and safe rejection of a malformed answer — not the
  model's reasoning itself (`AI_USAGE.md`).
- **`HybridEvaluator`'s persisted version does not separately record its two
  inner evaluators' own version constants** when they change independently
  of the join logic or the prompt wording — a known, narrow traceability
  gap, documented in `docs/ARCHITECTURE.md`'s "The evaluation benchmark"
  section rather than silently left unmentioned.
- **Only one structured submission format exists.** A diagram or code
  submission is a realistic future extension (see below), not something this
  product accepts today.
- **The knowledge base is small and curated** (31 documents), by design —
  breadth was explicitly not the differentiation this project chose (see
  `docs/RESEARCH.md`).

## 19. Deployment

**Live demo: Coming soon.**

No live deployment exists yet; this section will be updated with a verified
production URL once one does; no URL is invented in the meantime.

Deployment readiness verified during this milestone:

- Production build succeeds (`npm run build`) with no development-only
  assumptions.
- All configuration is environment-variable driven (see
  [Environment variables](#environment-variables)); nothing is hardcoded.
- Prisma client generation and migrations run non-interactively (`prisma
  generate`, `prisma migrate deploy`), suitable for a build-time step.
- The application runs correctly with zero AI configuration (deterministic
  evaluator only) — a missing or invalid `GROQ_API_KEY` degrades gracefully
  rather than crashing the application.
- Embedding configuration fails fast in production if genuinely
  misconfigured (`EMBEDDING_API_KEY` unset with `NODE_ENV=production`)
  rather than silently falling back to a weaker retrieval mode — see
  [Knowledge base](#knowledge-base).
- No development-only infrastructure is required to run in production: one
  PostgreSQL database (with pgvector) and, optionally, one LLM provider key.

## 20. Future evolution

Realistic extensions, not implemented today:

- **Diagram or code submission** — a second `SubmissionFormatType`
  alongside the structured editor (ADR-002 already anticipates this).
- **A human evaluator** — `DesignEvaluator` is already an abstraction a
  human-in-the-loop implementation could satisfy without touching
  `EvaluateAttempt`.
- **More benchmark cases** — additional curated designs, and problems beyond
  Parking Lot, in `tests/benchmarks/`.
- **Richer design diffing** — the current comparison identifies elements by
  name (a stated limitation in `docs/ARCHITECTURE.md`'s "Design evolution"
  section); a more sophisticated identity heuristic is a possible
  improvement, not a rewrite.
- **A background evaluation queue** — only if real evaluation volume or
  latency demonstrates the need (ADR-006, ADR-008); the
  `EvaluationDispatcher` port already exists as the extraction point.

---

## The learner workflow

```text
/problems            browse the four problems
/problems/[slug]     read the context, requirements and constraints
                     → Start an attempt
/attempts/[id]       build the design: classes, interfaces, relationships,
                     decisions, edge cases, requirement mapping
                     → Save draft (server-validated, advisory)
                     → Submit design (frozen from here on)
                     → Run the review
/attempts/[id]/review  summary, what is working, priority improvements,
                     structural checks, design review, what grounded it
/attempts            every attempt, with its status and its review
                     → pick two attempts on the same problem
/attempts/compare    what changed, what improved, what regressed, what remains
```

## The interface

The product is meant to read as a technical review workspace, so the visual
system is deliberately plain and the decisions are written down rather than
improvised per screen.

- **Typefaces.** IBM Plex Sans for the interface and IBM Plex Mono for
  anything the learner wrote — class names, requirement codes, evidence
  quotations, provenance versions. Setting learner content in mono keeps
  their words visually separate from the product's words about their words.
  Both are loaded with `next/font`, so they are self-hosted at build time: no
  runtime request to a font CDN and no layout shift as they load. The build
  does need network access the first time it fetches them.
- **Colour.** One cool-neutral ramp, one accent, and three semantic hues
  (`--ok`, `--attention`, `--danger`). Colour never carries a meaning on its
  own: a status is always a word and a shape as well as a hue, which is what
  makes the review readable for someone who cannot separate green from
  amber. No gradients.
- **Surfaces.** Regions are separated by a hairline and a change of ground
  rather than by a drop shadow and a large radius, and a panel only exists
  where the grouping is real. The problems list is a table, not a grid of
  cards.
- **Icons.** `lucide-react`, used semantically — requirements, classes,
  relationships, decisions, edge cases, review, retry, save — never as
  decoration, and never emoji.
- **States.** Every screen has a designed empty state, a loading skeleton
  shaped like the page it precedes (every page is `force-dynamic` and reads
  PostgreSQL), a root error boundary for anything unexpected, the workspace
  reports saving, saved, blocked and reviewing through a live region rather
  than by relabelling its buttons, and a failed review says the submission is
  still saved and offers a retry.
- **Responsive.** The two-pane screens collapse to one column under 960px
  and the context rail moves above the work rather than below it, because on
  a phone the requirement list is what you read before you start typing.

All of it lives in `src/app/globals.css` as design tokens.

## Design evolution

A learner's second attempt at a problem is only useful if they can see what changed
and whether it addressed what the first attempt's review raised. That comparison —
not a generic JSON diff, but classes, interfaces, relationships, decisions, edge
cases, requirement coverage, prior feedback and evaluation criteria compared on their
own terms — is what milestone 8 adds.

**Comparison is derived, not persisted.** There is no `attempt_comparison` table.
Both attempts, their submissions and their evaluations are already immutable once
submitted, so a comparison recomputed from them is always current, always
reproducible from the same two ids, and costs nothing to store. Persisting it would
only invite the two to drift — a re-evaluated attempt whose stored comparison forgot
to update, for instance. If comparisons ever need to be fast at a scale where
recomputing them on every request is the bottleneck, that is a cache to add later
in front of an unchanged read, not a reason to model it as a stored aggregate now.

**The comparison model** lives entirely in `src/domain/comparison`, framework-free
and with no port of its own — it never touches a repository, an evaluator or a
provider, only plain values already loaded by `CompareAttempts`:

```text
buildAttemptComparison(designBefore, designAfter, requirements, previousFeedback, criteriaBefore, criteriaAfter)
  ├── compareDesigns          → classes, interfaces, relationships, decisions, edge cases
  ├── compareRequirementCoverage → per-requirement UNCOVERED_TO_COVERED / COVERED_TO_UNCOVERED / unchanged
  ├── resolveFeedback         → ADDRESSED / STILL_PRESENT / UNCERTAIN / NOT_COMPARABLE, per prior finding
  ├── evolveCriteria          → IMPROVED / REGRESSED / CHANGED / UNCHANGED / NOT_COMPARABLE, per criterion
  └── summarizeComparison     → counts, plus a reference (never prose) to the single most
                                significant addressed finding and the single most significant
                                regression, when either is clear enough to name
```

Every element kind carries one of four change kinds — `ADDED`, `REMOVED`,
`MODIFIED`, `UNCHANGED` — and the UI shows only the first three by default.

**Identity is by name, and that is a real limitation, stated rather than hidden.**
A class or interface's `id` in the wire format is a client-generated editor session
key, never persisted identity (see `structuredDesignSchema`), and a decision or edge
case has no id or name at all — only the text of the decision or the situation
described. So comparison identifies "the same element across two attempts" the only
way the stored data supports: by trimmed name for classes and interfaces, by
endpoints for a relationship, by exact statement text for a decision or edge case.
A learner who renames `ParkingLot` to `Garage` with nothing else changed sees one
class removed and one added, never a guessed-at "renamed" — the alternative would be
overclaiming an identity nothing in the submission actually establishes, and doing
that wrongly in the other direction (treating two unrelated classes that happen to
share a name as continuous) would be worse.

**Feedback resolution is deterministic and deliberately conservative.** Given a
prior finding and the later design, in priority order:

1. No evidence on the finding → `NOT_COMPARABLE`, nothing concrete to check.
2. The finding's exact quoted text is still present, verbatim, on the same named
   entity → `STILL_PRESENT`. Checked first, and wins over every other signal,
   because this is the one case where a false "addressed" would be a real harm —
   the literal problem is unmistakably still there.
3. Every entity the finding named is gone from the later design under that exact
   name → `ADDRESSED`. The strongest deterministic signal available, and still
   only ever shown as "likely addressed" — never "fixed" or "solved" — because a
   name disappearing proves the target changed, not that the underlying concern
   was resolved well.
4. Anything else → `UNCERTAIN`.

**Criteria are compared one at a time, never as a single score.** Assessments rank
`STRONG > ADEQUATE > NEEDS_IMPROVEMENT > MISSING`; a criterion missing from either
side is `NOT_COMPARABLE` rather than guessed at as an improvement or a new concern,
because the two evaluations may simply have run different evaluators — a
deterministic-only run has no semantic criteria at all, and treating that as a
design change would blame or credit the design for something else entirely.

**Ownership is enforced by the use case, not the route.** `CompareAttempts` takes
the requesting learner's id and checks both attempts belong to it before loading
anything else; a mismatch is `ATTEMPT_NOT_FOUND` (404), the same as a genuinely
missing attempt, never a 403 that would confirm the other attempt exists. Comparing
an attempt with itself, or two attempts on different problems, is `COMPARISON_INVALID`
(409) — a request that is well-formed but cannot describe an evolution.

## Design coach

The coach answers one question about one attempt at a time — "Why is
`PaymentService` so coupled?", "Should I add an interface here?" — the way a
senior engineer would in a design review, not the way a general chatbot would.
The rule it follows throughout is **evidence first, knowledge second, reasoning
third, recommendation last**: it never leads with an opinion, and it is
expected to say "your current design does not show this problem" or "there are
two reasonable approaches here" when that is the honest answer.

**Grounding reuses everything the evaluator already has.** `AskDesignCoach`
assembles a `CoachContext` — the problem, the current design (the draft while an
attempt is `IN_PROGRESS`, the frozen submission once it is not — `draftDesign`
is never cleared on submit, so the attempt's own status decides which one is
"current," not whether a draft field happens to be empty), the current
evaluation if one has completed, and a bounded summary of the immediately
preceding attempt (assessments and improvement titles only — never that
attempt's design, so one question never pays for loading a whole earlier
submission). `LLMDesignCoach` then retrieves knowledge through the same
`KnowledgeContextProvider` the evaluator uses, and validates the model's answer
with the same `validateEvidence` the evaluator uses: an observation whose
evidence cannot be found in the actual design is dropped, and a claimed
evaluation reference is checked against a set built from the stored
evaluation's own criterion results — the coach cannot cite a finding that was
never made.

**Learner content is untrusted, and that now includes the question, not just
the design.** Both are fenced into the prompt behind `-----` markers, and
`neutraliseFences()` disarms any run of dashes long enough to fake a section
boundary — otherwise a learner could end the "your question" section early and
write fake `SYSTEM INSTRUCTIONS` after it. The system prompt itself is built
only from versioned constants (`COACH_SYSTEM_PROMPT`), so no learner text — in
the design or in the question — is ever concatenated into it.

### Why there is no canonical solution

The coach is never given a reference design, a model answer, or a rubric
"correct" structure to diff against — there isn't one to give it. Its prompt
tells it directly that a different structure is not automatically a worse one,
and that recommending a pattern (an interface, a strategy object) is only
warranted when the current design's own evidence supports it, not by default.
`design-coach.test.ts` asserts this behaviourally: given a design with exactly
one gateway implementation and no stated requirement to swap it, the coach does
not recommend an interface just because a learner asked whether it should have
one. A design generator would defeat the product's purpose — the learner has to
be able to make the next edit themselves, from having understood why, not from
having been handed a diff.

### Why the coach is stateless

There is no `CoachConversation` table and no `conversationId` in the request.
Each question is answered fresh from the attempt's current state, for the same
reason the comparison in milestone 8 is derived rather than stored: an
attempt's design, submission and evaluation already change over the attempt's
lifetime, and a stored conversation would either go stale against them or need
its own invalidation logic for no product benefit — nothing about this coach
needs to remember what was asked five minutes ago to answer the next question
well. If a real multi-turn conversation ever becomes a product requirement,
that is a new, explicit `CoachConversation` aggregate to add — not a reason to
bolt persistence onto this milestone's request/response shape now.

## API

All JSON, all over the same application use cases the pages use. No endpoint touches
a repository.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/problems` | the problem library |
| GET | `/api/problems/:ref` | one problem, by id or slug |
| POST | `/api/problems/:ref/attempts` | start an attempt |
| GET | `/api/attempts` | the learner's attempts |
| GET | `/api/attempts/:id` | attempt, problem and current design |
| PUT | `/api/attempts/:id/draft` | save a draft, with advisory issues |
| POST | `/api/attempts/:id/submissions` | submit |
| POST | `/api/attempts/:id/evaluate` | run the review (idempotent) |
| GET | `/api/attempts/:id/evaluation` | the stored review |
| POST | `/api/attempts/:id/retry-evaluation` | retry a failed review |
| GET | `/api/attempts/:id/compare/:otherId` | design evolution between two attempts |
| POST | `/api/attempts/:id/coach` | ask the design coach a question about this attempt |

Errors are a single envelope — `{ error: { code, message, issues? } }` — mapped from
the typed application and domain errors: 400 invalid request, 404 not found, 409
invalid state, duplicate, or an impossible comparison (the same attempt twice, or
two different problems), 422 a design the domain refuses or a coach question outside
its length bounds, 502 the review's or the coach's dependency failed, 503 the coach
is not configured in this environment, 500 anything unexpected. No stack trace, no
driver message, and no provider detail reaches a client.

## Commands

```bash
npm run dev              # the application on http://localhost:3000
npm run build            # production build
npm run start            # serve the production build
npm run verify           # typecheck + lint + unit tests (no database needed)
npm run typecheck
npm run lint
npm test                 # unit and architecture tests
npm run test:coverage
npm run test:integration # needs PostgreSQL running
npm run benchmark        # human-readable evaluation benchmark summary, no API key needed

npm run db:up            # start PostgreSQL
npm run db:down          # stop it, keeping the volume
npm run db:destroy       # stop it and delete the volume
npm run db:generate      # prisma generate
npm run db:migrate       # create and apply a new migration in development
npm run db:deploy        # apply existing migrations
npm run db:seed          # seed problems and the single learner
npm run db:reset         # drop, re-migrate and re-seed
npm run db:studio        # browse the data
```

## Language model (optional)

With `GROQ_API_KEY` unset the application runs the deterministic evaluator alone,
and every test passes. Set a key to enable AI review; nothing else is required.

The model defaults to `openai/gpt-oss-120b` on Groq, declared once in
`src/infrastructure/ai/groq-config.ts` and overridable with `GROQ_MODEL`
(`openai/gpt-oss-20b` is a smaller, faster alternative on the same account).
Providers retire ids on their own schedule, so if a call starts failing with a
404, check what the key can use and set `GROQ_MODEL`:

```bash
curl -sH "Authorization: Bearer $GROQ_API_KEY" \
  https://api.groq.com/openai/v1/models | jq -r '.data[].id'
```

## Knowledge base

```bash
npm run knowledge:ingest     # chunk, embed and store the curated catalogue
```

Rerunnable: chunk ids derive from the document slug and position, and each
document's chunk set is replaced, so running it twice leaves the same rows.

`EMBEDDING_API_KEY` selects how text is embedded:

| | `NODE_ENV=production` | anything else |
|---|---|---|
| key set | semantic embeddings | semantic embeddings |
| no key | **fails to start** | local lexical embeddings |

Outside production a missing key gives a local lexical embedding — no key, no
network, no cost — which is what the tests use, and it reports its own model name so
a store filled that way is never mistaken for a semantic one. Set a key and re-run
`knowledge:ingest` to replace the vectors.

In production a missing key is an error, not a fallback. Lexical vectors retrieve by
word overlap, so a deployment that lost its key would keep returning ranked, cited
passages chosen on a different basis than the one it claims, with nothing in the
result or the database to reveal it. To run a production build offline, point
`EMBEDDING_BASE_URL` at a local embedding service instead.

See `docs/ARCHITECTURE.md` for why PostgreSQL and pgvector rather than a separate
vector database, and for the retrieval flow.
