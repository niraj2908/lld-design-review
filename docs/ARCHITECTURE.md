# Architecture

DesignReview is a modular monolith inside one Next.js application, arranged as
ports and adapters.

```text
              ┌─────────────────────────────┐
              │ Next.js pages + API routes  │
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
              ┌──────────────┴──────────────┐
              │ Evaluation engine           │
              │  RuleBasedEvaluator         │
              │  AIDesignEvaluator          │
              │  HybridEvaluator            │
              │  (implement DesignEvaluator)│
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

## The evaluation engine

`src/evaluation-engine` implements the `DesignEvaluator` port. It sits beside the
domain rather than inside infrastructure: it is pure logic over entities, needs no
database, no network and no framework, and the same architecture test that guards
the domain guards it.

```text
EvaluateAttempt  →  DesignEvaluator (port)  →  RuleBasedEvaluator
                                                (5 rule modules + composer)
```

The engine reports on five criteria it can settle from the submission alone:
`STRUCTURAL_VALIDITY`, `REQUIREMENT_COVERAGE`, `DESIGN_COMPLETENESS`,
`EDGE_CASE_COVERAGE` and `DESIGN_DECISIONS`. They are a separate set from the
rubric's ten semantic criteria, and `natureOf(criterion)` derives which kind a
stored result is. Three rules follow from that split and are each covered by a
test:

- The deterministic evaluator **never emits STRONG**. "The check passes" is a
  fact; "this is strong design" is a judgement.
- It **never attaches confidence**. There is nothing to hedge about a fact.
- It **adds no design rules of its own**. `validateStructuredDesign` is still the
  only place design rules live; the engine routes each of its issues to a
  criterion and resolves evidence back to the submitted design.

Coverage is decided only by explicit requirement mappings. A class whose name
merely sounds relevant is not evidence, so a design with different names, fewer
classes or no interfaces is never marked down for the shape it chose.

## The semantic evaluator

```text
                 ┌── RuleBasedEvaluator ──── deterministic findings ──┐
Submission ──────┤                                                   ├── merged outcome
                 └── AIDesignEvaluator ──── LLMProvider (port) ───────┘
                          │                        │
                          │                  GroqLLMProvider
                          └── evidence validation against the submission
```

`HybridEvaluator` runs the rule evaluator, hands its outcome to the judge through
`EvaluationContext.deterministicOutcome`, and concatenates the two results.

**The judge cannot overwrite a fact, and not by policing.** The two evaluators
report on disjoint criterion sets — five deterministic, nine semantic — so no
criterion exists that both can speak about. A test asserts the sets stay disjoint.
`REQUIREMENT_UNDERSTANDING` is deliberately outside the judge's remit: coverage is
settled from the mappings, and asking a model to re-decide it invites a
contradiction.

**Nothing the model says is trusted because it said it.** Three things happen to
an answer before it becomes an outcome:

1. it is parsed against a Zod schema, and a malformed answer fails the evaluation
   rather than producing a partial one — confidence outside 0–1 is rejected, not
   clamped;
2. every evidence item is checked against the submitted design by
   `validateEvidence` — an unknown entity, a field the submission format does not
   have, or a quote that is not in the named element is discarded and counted in
   `unverifiedEvidenceCount`;
3. an improvement left without verified evidence is dropped, and a concern with
   nothing to point at is not carried as one.

**Learner text is data.** The system prompt is assembled from constants only, so
nothing a learner writes can reach it. Their design is rendered inside a fenced
section, and any fence-like run of dashes inside it is neutralised so a submission
cannot close its own section and start issuing instructions.

**Groq lives in exactly one file.** `src/infrastructure/ai/groq-llm-provider.ts`
is the only place that imports the SDK, enforced by lint and by an architecture
test that asserts the import appears in that path and no other. The API key is
passed to the client and never stored on the provider, logged, or included in an
error.

## The presentation layer

```text
browser ──▶ /api/… route handler ──▶ presentation handler ──▶ application use case
                (3 lines)              (parse, delegate, map)        (the rules)

server component ──▶ read-model ──▶ the same application use cases
```

**Route handlers are delegations.** Each one reads its params and calls one
presentation handler; an architecture test asserts every file under `src/app/api` is
under 18 non-blank lines, imports nothing from `@/application` or `@/domain`, and
goes through `getApiServices()`. The handlers themselves parse with Zod, call one use
case, map to a DTO and return — no branch in them decides anything about a design, a
lifecycle or an evaluation.

**Server components read through the same use cases.** A page calls the read model,
which calls a use case and maps with the same DTO functions the API uses; an HTTP hop
back into our own process would add a round trip for nothing. What no page does is
reach for a repository.

**Infrastructure is built in exactly one file.** `src/presentation/api/services.ts`
is the only place in the presentation layer that mentions `getPrismaClient`,
`createRepositories`, `createKnowledgeServices` or `createDefaultEvaluator` — again
asserted by a test, so a component cannot grow its own Prisma client.

**Client validation is for typing, server validation decides.** The editor says a
class still needs a name; the domain decides whether a design can be submitted, and
the workspace shows what the server said rather than predicting it.

**Learner text is data in the browser too.** Nothing uses `dangerouslySetInnerHTML`
or `innerHTML` — a test enforces that across `src/app` — so a design that contains
markup or an instruction renders as the text it is.

**Styling is one hand-written stylesheet.** Tailwind was named in the original stack
note but is not installed; adding a styling toolchain in the milestone that builds
the learner loop would have bought risk rather than speed, so `src/app/globals.css`
carries the design tokens and the component rules. A utility framework can be layered
on top later without touching a component's behaviour.

## The interface

The product has to read as a technical review workspace rather than a dashboard, so
the visual decisions are written down here instead of being made per screen.

**Two typefaces, with a job each.** IBM Plex Sans is the interface; IBM Plex Mono is
reserved for what the learner wrote — class names, requirement codes, evidence
quotations — and for provenance strings. The split is not decoration: a review page
is the product's prose about the learner's words, and the reader has to be able to
tell which is which at a glance. Both are loaded through `next/font`, so they are
self-hosted from the application's own origin with fallback metrics that avoid a
layout shift; the trade is that the first build needs network access to fetch them.

**One accent, three semantic hues, no gradients.** Colour is state, never decoration:
`--ok`, `--attention` and `--danger` say what happened, and the single accent marks
what is interactive. No status is ever carried by colour alone — every state pill
pairs a hue with a word and a shape, so it still reads for someone who cannot
separate green from amber. Both themes are defined as tokens on `:root`, with dark
values under `prefers-color-scheme`.

**Surfaces are bordered regions, not floating cards.** A hairline and a change of
ground separate areas; radii stay small and differentiated (controls tighter than
containers) and there are no drop shadows. A panel exists only where the grouping is
real, which is why the problem catalogue is a table rather than a grid of cards.

**Icons are semantic.** `lucide-react` — one library, consistent stroke and optical
size, each icon tied to a meaning the product already has (requirements, classes,
relationships, decisions, edge cases, review, retry, save). No emoji, no decorative
icons, and no icon that is the only carrier of a meaning.

**Layouts are two-pane where the work needs context.** The problem page keeps the
start action and previous attempts in a sticky rail; the workspace keeps live
requirement coverage there; the review page keeps section navigation and provenance
there. Under 960px the rail becomes an ordinary block *above* the work, because on a
phone the requirements are what you read before you start typing — a stacked desktop
layout would put them after it.

**States are designed, not defaulted.** Empty, loading, saving, saved, blocked,
reviewing, failed and read-only each have their own copy and their own visual
treatment. The workspace reports progress through an `aria-live` region rather than
by relabelling its buttons, so a screen reader hears the change without the control
losing its accessible name.

## Hybrid review, grounded

```text
Submission
   │
   ▼  RuleBasedEvaluator ───────────────▶ deterministic findings (authoritative)
   │                                          │
   │                                          ▼ (query mentions the codes)
   ├──▶ buildKnowledgeRequests ──▶ KnowledgeContextProvider (port) ──▶ retrieval
   │         two bounded queries:                                        │
   │         principles (topic filter)                                   │
   │         problem guidance (problemSlug filter)                       │
   │                                                                     ▼
   └──▶ AIDesignEvaluator ◀── reference knowledge, fenced and cited ─────┘
             │
             ▼  schema validation, then evidence validation against the submission
        semantic judgements + citations
             │
             ▼  HybridEvaluator concatenates (disjoint criteria)
        one outcome, persisted with provenance
```

**Retrieval happens inside the judge, after the facts.** The deterministic outcome
arrives in `EvaluationContext`, so the query can name the structural findings that
are already settled. The judge reaches retrieval through
`KnowledgeContextProvider`, a port — it never learns that retrieval is pgvector, and
an architecture test asserts it does not import the builder that implements it.

**The query is built from data, never from learner prose.** It carries the problem
title, the author's MUST requirement titles, the criterion vocabulary, the
deterministic finding codes, and *shapes* read off the design — element counts,
which relationship kinds appear, whether decisions and edge cases were recorded. A
submission therefore cannot steer retrieval, maliciously or otherwise, and a test
asserts no learner text reaches the query.

**Two queries, not nine.** Design principles and guidance written for the problem
compete for the same slots in a single query, so they are separated by metadata
filter; one query per criterion would multiply latency for heavily overlapping
material. Results are merged by chunk, ordered by score then chunk id, and bounded
to 5 000 characters.

**Knowledge is not evidence, and the model is told so.** Evidence must resolve to an
element of the submitted design; a passage title offered as evidence is rejected and
counted, and a finding left without evidence is dropped. The prompt separates
evaluator rules, reference knowledge, requirements, deterministic findings and the
learner submission into distinct sections, and both the knowledge block and the
learner block are fenced with their fence sequences neutralised.

**Provenance, not a transcript.** `evaluation_knowledge_citations` records ref, rank,
chunk id, document id, title, source, topic, document version, score and embedding
model — enough to fetch the passage back exactly as it was, without copying text that
could then drift. It is not a foreign key to `knowledge_chunks`: a stored evaluation
must stay explicable after the knowledge base is re-ingested. `(evaluationId,
chunkId)` is unique and the whole set is replaced with the outcome, so a retry cannot
leave two runs' citations side by side.

**Failure is explicit.** Retrieval that finds nothing is reported to the judge in
words — "No relevant reference knowledge was retrieved" — so it neither assumes
material was withheld nor invents a citation. Retrieval that fails propagates and
fails the evaluation, like any other dependency; there is no silent ungrounded
review and no partial state.

## The knowledge layer

```text
knowledge catalogue (curated guidance)
        │
        ▼  chunkDocument — deterministic, paragraph-packed
   KnowledgeChunk[]
        │
        ▼  EmbeddingProvider (port)  ──  OpenAI-compatible adapter | local lexical
   EmbeddedKnowledgeChunk[]
        │
        ▼  KnowledgeRepository (port)  ──  PrismaKnowledgeRepository (pgvector)
   PostgreSQL

query ──▶ SemanticKnowledgeRetriever ──▶ KnowledgeContextBuilder ──▶ cited context
             (embed, then search)            (bound, fence, cite)
```

**Why PostgreSQL with pgvector, and not a vector database.** The knowledge base is
small — tens of documents, dozens of chunks — and it already shares a transaction
boundary with the data it supports. A separate store would add a service to run, a
second consistency problem, and a second place for an ingestion to half-succeed, in
exchange for scale this product does not have. pgvector gives cosine search and an
HNSW index inside the database that is already there. `KnowledgeRepository` is the
seam that makes this reversible: if the knowledge base ever outgrows Postgres, one
adapter changes.

**The local embedding fallback is not a production mode.** Outside production a
missing `EMBEDDING_API_KEY` yields local lexical embeddings so everything runs
offline; in production `createEmbeddingProvider` throws instead. The two produce
vectors of the same width and go through the same pgvector query, so a silent
substitution would be undetectable downstream — the result would still be ranked and
cited, just chosen by word overlap. Refusing to start is the only signal that
reaches an operator.

**Retrieval is two ports, not a service.** `SemanticKnowledgeRetriever` embeds the
question and asks the repository for neighbours; it contains no SQL and no vendor,
so it lives in the application layer. Metadata filters — topic, problem, source —
are applied before similarity, so a query is only ranked among passages that can
apply at all. Every result carries its chunk id, document, source and version, so a
claim can be traced back.

**Dimensions are checked, not assumed.** The vector column is `vector(1536)`, fixed
by migration, and `KNOWLEDGE_EMBEDDING_DIMENSIONS` is the single place that says so.
A provider whose width disagrees is rejected when the retriever or the ingester is
constructed, not when a query returns nonsense.

**Ingestion is rerunnable by construction.** Document and chunk ids derive from the
document slug and the chunk's position, and each document is written by replacing
its whole chunk set — so a second run produces the same rows, and a document whose
text shrank loses the chunks that no longer exist.

**Retrieved text is reference material, not instruction.** The context builder
labels the block as background, states that nothing in it changes the evaluator's
rules or is a solution, fences it, and neutralises fence-like runs inside a passage.
Curated content is still content being pasted into a prompt, and treating it as
trusted because of where it came from is how the next injection works.

**Guidance, never solutions.** No table holds a reference design, and none should be
added. Every catalogue entry explains how to reason about a decision — what a
concept means, what evidence suggests it applies, what it costs. The problem-specific
entries name each problem's variation points and difficulties and stop short of
naming elements; one of them says so in as many words, and a test asserts no entry
contains an answer-key phrase or a class declaration. A stored answer would quietly
turn retrieval into comparison and contradict the product's premise that several
designs can be right.

## Design evolution

Milestone 8 compares two of a learner's own attempts at the same problem. The
architecture question it raises is where "comparison" belongs, and the answer
follows the same rule as everything else in this document: a pure semantic
operation over value objects is domain; touching a repository, an evaluation or an
attempt's lifecycle is application; wire shape is presentation; rendering is UI.

```text
CompareAttempts (application)
  loads both attempts, checks ownership + same problem + not-the-same-attempt,
  loads their designs and evaluations
        │
        ▼
buildAttemptComparison (domain, src/domain/comparison)
  a pure function of two designs, one requirement list, one attempt's prior
  findings and both attempts' criterion results — no repository, no evaluator,
  no HTTP, nothing it could not be handed as plain values in a unit test
        │
        ▼
toAttemptComparisonResponse (presentation, src/presentation/api/comparison-dto.ts)
  maps the result to the wire shape; the comparison page renders it
```

**Comparison is derived from immutable data, never persisted as its own
aggregate.** There is no migration for milestone 8. A submission is deep-frozen
once created and an evaluation's outcome is written once it completes, so the two
inputs to a comparison never change under it — recomputing on every request is
exactly as current as a cached row would be, at the cost of nothing to keep in
sync and nothing that could silently go stale after a retry re-evaluates one side.
Two architecture tests hold this: one restates the domain sweep specifically for
`src/domain/comparison`, and one asserts `buildAttemptComparison` is called from
exactly `CompareAttempts` and nowhere else — a route handler or a page calling it
directly would bypass the ownership and same-problem checks that only the use
case performs.

**Identity is name-based, and the domain says so rather than hiding it.** A class
or interface's `id` in the structured-design wire format is a client-generated
editor session key (see `structuredDesignSchema`), never persisted identity, and a
decision or edge case has no id or name at all. `src/domain/comparison/identity.ts`
makes the resulting rule explicit: two elements are "the same" only when their
trimmed name (or, for a relationship, both endpoints; for a decision or edge case,
the exact statement) matches. A rename with nothing else changed is indistinguishable
from a removal and a fresh addition, and is reported as exactly that — the
alternative, guessing at continuity from a name alone, risks the opposite mistake of
treating two unrelated elements that happen to share a name as continuous.

**Feedback resolution stays inside the domain and stays conservative.** It reuses
`buildDesignElementIndex` — the same lookup `validateEvidence` uses to ground new
evidence — to ask whether a prior finding's named entities still exist under that
name in the later design. The full rule, and why `STILL_PRESENT` is checked before
`ADDRESSED`, is in `feedback-resolution.ts`'s own doc comment and in the README's
[Design evolution](../README.md#design-evolution) section.

**No LLM in the comparison path.** Every comparator in `src/domain/comparison` is
deterministic: same two inputs, same output, every time, and testable without a
key, a network call, or a fixture that records a real model's answer. A narrative
layer over the structured comparison — "here is what this evolution means" in
prose — is a plausible later milestone, but it would sit in front of this output,
never inside it.

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
