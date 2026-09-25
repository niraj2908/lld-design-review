# ADR-002: Structured design submission, not free-form text or a full UML editor

## Status

Accepted.

## Context

A learner's LLD attempt has to be something a deterministic checker and a
semantic judge can both actually reason about. Free-form prose ("I would have
a ParkingLot class that...") cannot be validated for structural correctness
and gives an AI evaluator nothing firm to check evidence against. A full UML
diagram editor is the opposite problem: it is already well covered by existing
LLD products (see `docs/RESEARCH.md`), and building one competes for effort
with the review loop, which is this product's actual differentiator.

## Decision

Require a structured submission: explicit classes, interfaces, relationships,
design decisions, edge cases, and requirement mappings, captured as a typed
`StructuredDesign` (`src/domain/design/structured-design.ts`) and validated by
`validateStructuredDesign` before it can be submitted. `SubmissionFormatType`
(`src/domain/submission/submission-format-type.ts`) is its own small
abstraction specifically so a future format (a diagram, a code submission)
is an additive variant, not a rewrite.

## Consequences

- Deterministic checks (structural validity, requirement coverage, design
  completeness) are possible at all, because the shape of a submission is
  known and typed rather than parsed from prose.
- Evidence validation (`validateEvidence`) can check that an AI-cited class,
  field or value actually exists in what the learner wrote, which a free-text
  submission would not support.
- The editor UI (`DesignEditor`) is more constrained than a diagram tool, and
  deliberately so: the learner directly manipulates the same structured
  fields the evaluator reads, with no translation step in between.
- A richer diagram or code submission format remains a realistic later
  extension (see README's "Future evolution"), added behind the same
  `SubmissionFormatType` abstraction rather than by replacing this one.
