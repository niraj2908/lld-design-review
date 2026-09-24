# Architecture

DesignReview is a modular monolith inside one Next.js application, arranged as
ports and adapters.

```text
              ┌─────────────────────────────┐
              │ API routes / UI  (later)    │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │ Application                 │
              │  use cases + ports          │
              └──────────────┬──────────────┘
                             │  depends on
              ┌──────────────▼──────────────┐
              │ Domain                      │
              │  entities, invariants,      │
              │  state machines, validation │
              └─────────────────────────────┘
                             ▲
                             │  implements the ports
              ┌──────────────┴──────────────┐
              │ Infrastructure              │
              │  Prisma repositories        │
              │  mappers, client, seed      │
              └──────────────┬──────────────┘
                             │
                      ┌──────▼──────┐
                      │ PostgreSQL  │
                      │  + pgvector │
                      └─────────────┘
```

Arrows point the way dependencies point. Infrastructure knows about the domain
and the application's ports; neither knows about infrastructure.

## Application ports → persistence adapters → Prisma → PostgreSQL

The application layer declares what it needs as interfaces in
`src/application/ports`:

```text
ProblemRepository      AttemptRepository
SubmissionRepository   EvaluationRepository
Clock                  IdGenerator
```

`src/infrastructure/persistence/repositories` provides one Prisma-backed class per
repository port. Each one:

1. issues a single query per read, loading a whole aggregate through a shared
   `include` tree, so rebuilding an entity never turns into a query per child;
2. hands the resulting rows to a mapper in
   `src/infrastructure/persistence/mappers`, which rebuilds the domain entity
   through its own factory — `Problem.create`, `Attempt.restore`,
   `Submission.restore`, `Evaluation.restore` — so a row that violates a domain
   invariant fails at the boundary instead of flowing into a use case;
3. translates the handful of driver error codes the application can act on
   (`P2002`, `P2003`, `P2025`) into `UniqueConstraintError`,
   `ForeignKeyConstraintError` and `RecordNotFoundError`, and rethrows anything
   else untouched rather than mislabelling it.

`src/infrastructure/composition-root.ts` is the only file that knows both the use
cases and the adapters that satisfy their ports.

## Why Prisma stays outside the domain and application layers

**The domain is the part worth protecting.** Attempt lifecycle rules, design
validation and the evidence model are the substance of this project. If they
imported Prisma, they could only be exercised with a database running, and the
fast unit suite that proves them would become an integration suite.

**Storage is a decision with a shorter life than the model.** Ports mean swapping
Prisma, splitting a table, or moving the structured design between normalized rows
and a document column is a change in one directory. The use cases do not move.

**Prisma's types are a schema shape, not a domain shape.** They carry persistence
concerns the domain has no use for — `position` columns that preserve list order,
`elementId` alongside a database key, nullable columns where the domain has absent
properties. Mappers exist so those never reach a use case; that is also why the
mappers read locally declared row interfaces rather than the generated client,
which keeps mapping unit-testable with no database at all.

**It keeps the evaluation seam honest.** Later milestones add an LLM provider, a
retriever and a dispatcher behind the same kind of port. A domain that already
depends on no infrastructure is one those adapters can be added to without
touching it.

The rule is checked mechanically, not by convention: `.oxlintrc.json` restricts
imports per directory, and `tests/architecture/layering.test.ts` scans every
non-test source file under `src/domain` and `src/application` for forbidden
specifiers — including anything matching `prisma` and the generated client path.

## Persistence design notes

**Normalized design elements.** Classes, interfaces, relationships, decisions,
edge cases and requirement mappings are real tables, so a design is queryable and
the database enforces unique element names per design, valid requirement
references and cascade ownership. Each ordered child carries a `position` column,
so a rebuilt design equals the one that was stored.

**Two deliberate JSON columns.** A class's `attributes` and a class's or
interface's `methods` are JSON arrays. They are ordered leaf lists, always read
with their owning element, never queried on their own, and their only invariant —
a non-empty name — is enforced by domain validation. Two more tables and two more
joins per element would buy no integrity and no queryability.

**Domain timestamps are not defaulted.** Columns the domain owns (`createdAt`,
`updatedAt`, `submittedAt`, `completedAt`) have no `@default(now())` or
`@updatedAt`: the clock is injected into the application layer, and the database
must not silently overwrite what the domain decided.

**A draft and a submission never share a design row.** An attempt points at a
mutable draft design; a submission owns its own immutable copy. That is what makes
"submitted work cannot change" true in storage and not just in the entity.

**One `Learner` table, no authentication.** There is no Learner domain entity. The
table exists so attempt ownership is a real foreign key instead of an unchecked
string, and it holds exactly the one seeded learner the MVP runs with.

## Transaction boundaries

Atomic today:

- **Replacing a draft design** — creating the new design, repointing the attempt
  and deleting the previous design happen in one transaction, so a rejected child
  row leaves the old draft intact.
- **Writing a submission with its design** — one nested create, so a submission
  can never exist without the design it recorded.
- **Rewriting an evaluation outcome** — clearing the previous run's criterion
  results and feedback and writing the new ones happen together, so the rows
  always describe exactly one run.
- **Seeding one problem** — problem, requirements, rubric and criteria per
  transaction, so a half-seeded problem is not possible.

Known gap: `SubmitAttempt` writes through two ports — it saves the submission,
then updates the attempt — so the two writes are not one transaction. The order is
deliberate: the learner's work is persisted first, which is the invariant that
matters, and a crash between them leaves a stored submission with an attempt still
`IN_PROGRESS` rather than a lost design. Closing it properly needs a
transaction-scope port the use case can open, which is the same seam the
evaluation dispatcher will need in order to dispatch only after commit. It is
deferred to that milestone rather than solved by giving the application layer a
Prisma transaction.
