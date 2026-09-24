# DesignReview

An LLD design practice and review platform. A learner picks a problem, submits a
structured design, and gets evidence-grounded review feedback they can act on and
resubmit — the product is the review loop, not a score.

Full product and engineering intent lives in `DESIGNREVIEW_MASTER_SPEC.md`.

## Status: milestone 6 — RAG-integrated hybrid review

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

Milestone 6 connects the two:

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

Not yet built: the Design Coach, the async dispatcher, API routes and the UI.

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
