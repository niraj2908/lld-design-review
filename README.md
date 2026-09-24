# DesignReview

An LLD design practice and review platform. A learner picks a problem, submits a
structured design, and gets evidence-grounded review feedback they can act on and
resubmit — the product is the review loop, not a score.

Full product and engineering intent lives in `DESIGNREVIEW_MASTER_SPEC.md`.

## Status: milestone 3 — deterministic evaluation engine

Milestone 1 delivered the framework-independent core: domain model, attempt and
evaluation state machines, deterministic design validation, application ports and
the first use cases.

Milestone 2 added PostgreSQL behind those ports:

- Prisma schema and the initial migration (20 tables, pgvector enabled),
- Prisma adapters for the four repository ports,
- a local PostgreSQL container,
- a deterministic, rerunnable seed with the four MVP problems,
- integration tests that run the milestone-1 use cases against a real database.

Milestone 3 adds the first evaluator:

- `src/evaluation-engine` — a `RuleBasedEvaluator` that reports only what can be
  checked from the submission, behind the `DesignEvaluator` port,
- the `EvaluateAttempt` use case, running synchronously and idempotently,
- five deterministic criteria kept separate from the rubric's semantic ones.

Not yet built: the Groq provider, retrieval, the async dispatcher, API routes and
the UI. pgvector is enabled but no vector column, index or retrieval code exists.

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

## Environment

`.env.example` is the single source of truth for configuration. `DATABASE_URL` is
the application and CLI database; `TEST_DATABASE_URL` is used only by integration
tests. Never commit a filled-in `.env`.
