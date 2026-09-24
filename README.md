# DesignReview

An LLD design practice and review platform. A learner picks a problem, submits a
structured design, and gets evidence-grounded review feedback they can act on and
resubmit — the product is the review loop, not a score.

Full product and engineering intent lives in `DESIGNREVIEW_MASTER_SPEC.md`.

## Status: milestone 1 — domain + application core

What exists today runs with no database, no LLM, no network and no UI:

- the domain model (problem, requirement, attempt, structured design, submission,
  evaluation, feedback),
- the attempt and evaluation state machines,
- deterministic structured-design validation,
- application ports (repositories, LLM provider, retriever, dispatcher,
  evaluator, submission format),
- the first use cases: start attempt, save draft, submit attempt, get attempt,
  get attempt history, retry evaluation.

Not yet built: persistence adapters, evaluation engine, Groq provider, RAG,
API routes, UI. `src/infrastructure/` is deliberately empty.

## Commands

```bash
npm install
npm run verify      # typecheck + lint + tests
npm run typecheck
npm run lint
npm test
npm run test:coverage
```

## Layout

```text
src/
  domain/        framework-independent entities, invariants, state machines
  application/   ports (interfaces) and use cases
  infrastructure/  adapters — empty until milestone 2
  testing/       in-memory doubles and fixtures used by tests only
tests/
  architecture/  asserts the dependency direction holds
```

## Dependency direction

```text
API/UI → application → domain
                ↑
        infrastructure implements application ports
```

`src/domain` imports no framework, no SDK, no Node built-in, and nothing from
`src/application`. That rule is enforced twice: by `no-restricted-imports` in
`.oxlintrc.json` and by `tests/architecture/layering.test.ts`, so it fails in
both lint and CI rather than eroding quietly.

## Environment

`.env.example` lists the variables later milestones need. Milestone 1 needs none.
