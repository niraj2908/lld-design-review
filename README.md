# DesignReview

An LLD design practice and review platform. A learner picks a problem, submits a
structured design, and gets evidence-grounded review feedback they can act on and
resubmit — the product is the review loop, not a score.

Full product and engineering intent lives in `DESIGNREVIEW_MASTER_SPEC.md`.

## Status: milestone 8 — design evolution

Milestone 1 delivered the framework-independent core: domain model, attempt and
evaluation state machines, deterministic design validation, application ports and
the first use cases.

Milestone 2 added PostgreSQL behind those ports:

- Prisma schema and the initial migration (20 tables, pgvector enabled),
- Prisma adapters for the four repository ports,
- a local PostgreSQL container,
- a deterministic, rerunnable seed with the four MVP problems,
- integration tests that run the milestone-1 use cases against a real database.

Milestone 3 added the first evaluator:

- `src/evaluation-engine` — a `RuleBasedEvaluator` that reports only what can be
  checked from the submission, behind the `DesignEvaluator` port,
- the `EvaluateAttempt` use case, running synchronously and idempotently,
- five deterministic criteria kept separate from the rubric's semantic ones.

Milestone 4 added a semantic evaluator beside it:

- `LLMProvider` port with a `GroqLLMProvider` adapter — the only file that knows
  Groq exists,
- `AIDesignEvaluator`, which judges the nine criteria rules cannot settle and
  discards any evidence it cannot find in the submission,
- `HybridEvaluator`, which runs both and cannot let the judge overwrite a fact,
- versioned prompts, schema-validated output, and provider/model recorded on
  every evaluation.

The whole test suite runs without a Groq key: only the provider is faked.

Milestone 5 added the knowledge layer:

- a curated knowledge base of design guidance — 31 documents, 46 chunks — stored
  in PostgreSQL with pgvector,
- `EmbeddingProvider` and `KnowledgeRepository` ports, with an OpenAI-compatible
  embedding adapter and a local lexical one for offline work,
- deterministic chunking and rerunnable ingestion,
- semantic retrieval with topic, problem and source filters,
- a `KnowledgeContextBuilder` that renders retrieved passages as cited reference
  material.

Milestone 6 connected the two:

```text
Deterministic checks  +  Semantic AI judgment  +  Grounded design knowledge
                      =  Hybrid Design Review
```

The pipeline is: submission → deterministic evaluation → knowledge retrieval → AI
semantic evaluation → evidence validation → merged outcome → persisted evaluation
with knowledge provenance.

What that does and does not mean:

- **RAG supplies design guidance, not a solution.** The knowledge base explains how
  to reason about a decision. It holds no class list or worked answer for any
  problem, and the prompt tells the judge that a passage which reads like a
  prescription is not one.
- **Deterministic findings stay authoritative.** The two evaluators report on
  disjoint criterion sets, so the judge has no criterion on which it could
  contradict a fact.
- **AI findings are judgements, not truth.** They carry confidence and are marked
  `SEMANTIC`; the structural results carry neither.
- **Learner evidence and reference knowledge are separate.** Evidence must resolve
  to something in the submitted design; a retrieved passage can never become
  evidence that the learner did anything. A finding that loses its evidence is
  dropped.
- **Every evaluation records what informed it** — evaluator, prompt, provider,
  model, knowledge version, embedding model, and one citation row per passage the
  judge was shown.

Milestone 7 made it usable: a Next.js application and a JSON API over the same
application use cases, so a learner can go from the problem library to a completed
review in a browser.

Milestone 8 adds design evolution — comparing two of a learner's own attempts at the
same problem:

- a pure, framework-free comparator in `src/domain/comparison` that diffs classes,
  interfaces, relationships, decisions and edge cases; tracks requirement coverage
  transitions; and checks a prior evaluation's findings against a later design,
  deterministically, with no model call,
- `CompareAttempts`, the one use case allowed to call it, which loads both
  attempts, enforces ownership and the same-problem rule, and orders them
  chronologically regardless of which id was requested first,
- `GET /api/attempts/:id/compare/:otherId` and a comparison page at
  `/attempts/compare`, reachable from a picker on the attempts history screen,
- the comparison is **derived, not persisted** — nothing new in the schema; see
  [Design evolution](#design-evolution) below for why.

Not yet built: the Design Coach, an AI-generated narrative over the comparison, the
async dispatcher and authentication.

## Running it

```bash
cp .env.example .env         # once
npm install                  # also runs `prisma generate`
npm run db:up                # PostgreSQL with pgvector, in Docker
npm run db:deploy            # apply the migrations
npm run db:seed              # the learner and the four problems
npm run knowledge:ingest     # the design-guidance knowledge base
npm run dev                  # http://localhost:3000
```

`npm run build` then `npm run start` for a production build. No API key is needed:
without one the review runs the structural checks alone, and the knowledge base is
embedded locally.

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

Submitting freezes a design. A second attempt on the same problem sits alongside the
first, which is what makes design evolution — comparing that first attempt against
the second — possible.

## The interface

The product is meant to read as a technical review workspace, so the visual system
is deliberately plain and the decisions are written down rather than improvised per
screen.

- **Typefaces.** IBM Plex Sans for the interface and IBM Plex Mono for anything the
  learner wrote — class names, requirement codes, evidence quotations, provenance
  versions. Setting learner content in mono keeps their words visually separate from
  the product's words about their words. Both are loaded with `next/font`, so they
  are self-hosted at build time: no runtime request to a font CDN and no layout
  shift as they load. The build does need network access the first time it fetches
  them.
- **Colour.** One cool-neutral ramp, one accent, and three semantic hues
  (`--ok`, `--attention`, `--danger`). Colour never carries a meaning on its own: a
  status is always a word and a shape as well as a hue, which is what makes the
  review readable for someone who cannot separate green from amber. No gradients.
- **Surfaces.** Regions are separated by a hairline and a change of ground rather
  than by a drop shadow and a large radius, and a panel only exists where the
  grouping is real. The problems list is a table, not a grid of cards.
- **Icons.** `lucide-react`, used semantically — requirements, classes,
  relationships, decisions, edge cases, review, retry, save — never as decoration,
  and never emoji.
- **States.** Every screen has a designed empty state, the workspace reports saving,
  saved, blocked and reviewing through a live region rather than by relabelling its
  buttons, and a failed review says the submission is still saved and offers a retry.
- **Responsive.** The two-pane screens collapse to one column under 960px and the
  context rail moves above the work rather than below it, because on a phone the
  requirement list is what you read before you start typing.

All of it lives in `src/app/globals.css` as design tokens. Tailwind was named in the
original stack note but is not installed; adding a styling toolchain in the milestone
that builds the learner loop would have bought risk rather than speed.

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

Errors are a single envelope — `{ error: { code, message, issues? } }` — mapped from
the typed application and domain errors: 400 invalid request, 404 not found, 409
invalid state, duplicate, or an impossible comparison (the same attempt twice, or
two different problems), 422 a design the domain refuses, 502 the review's
dependency failed, 500 anything unexpected. No stack trace, no driver message, and
no provider detail reaches a client.

## Prerequisites

- Node.js 20.9 or newer (developed on 26).
- Docker with Compose, for PostgreSQL. Integration tests need it; unit tests do
  not.

## Setup

```bash
cp .env.example .env     # once; defaults match docker-compose.yml
npm install              # also runs `prisma generate`
npm run db:up            # start PostgreSQL (waits until healthy)
npm run db:deploy        # apply the checked-in migrations
npm run db:seed          # insert the learner and the four problems
```

The Prisma client is generated into `src/infrastructure/persistence/prisma/client`
and is not committed. `npm install` generates it; run `npm run db:generate` after
changing `prisma/schema.prisma`.

`npm run db:seed` is deterministic and safe to rerun: it upserts by stable id and
never touches attempts, submissions or evaluations.

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

### Running the integration tests

```bash
npm run db:up
npm run test:integration
```

They use the separate `designreview_test` database, which the container creates on
first start, and truncate every table before each test. If PostgreSQL is not
running they fail with the commands above rather than being skipped silently.

## Layout

```text
src/
  app/                  Next.js pages, API routes, client components, design tokens
  presentation/         request handling, DTOs, HTTP error mapping
prisma/
  schema.prisma         persistence schema
  migrations/           checked-in SQL migrations
  seed.ts               seed entry point
src/
  domain/               framework-independent entities, invariants, state machines
  application/          ports (interfaces) and use cases
  infrastructure/       Prisma client, repositories, mappers, seed, composition root
  testing/              in-memory doubles and fixtures used by tests only
tests/
  architecture/         asserts the dependency direction holds
  integration/          use cases and repositories against real PostgreSQL
docker-compose.yml      local PostgreSQL (pgvector image)
```

## Architecture

See `docs/ARCHITECTURE.md` for how the layers fit together and why Prisma stays
out of the domain and application layers.

The dependency rule is enforced twice — by `no-restricted-imports` overrides in
`.oxlintrc.json` and by `tests/architecture/layering.test.ts` — so it fails in
both lint and CI rather than eroding quietly.

## Language model (optional)

With `GROQ_API_KEY` unset the application runs the deterministic evaluator alone,
and every test passes. Set a key to enable AI review; nothing else is required.

The model defaults to `llama-3.3-70b-versatile` (Llama 3.3 70B on Groq), declared
once in `src/infrastructure/ai/groq-config.ts` and overridable with `GROQ_MODEL`.
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

## Environment

`.env.example` is the single source of truth for configuration. `DATABASE_URL` is
the application and CLI database; `TEST_DATABASE_URL` is used only by integration
tests. Never commit a filled-in `.env`.
