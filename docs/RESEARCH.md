# Research note

This note explains the learner problem DesignReview addresses, what existing
LLD practice tools already do, why that ruled out a few obvious product
shapes, and why the resulting design leans on evidence-grounded, non-canonical
evaluation instead of scoring against a reference answer. It is a product and
engineering rationale, not a literature review, and it does not claim to prove
that DesignReview's approach produces better learning outcomes — that would
need a controlled study this project has not run.

> **A note on sourcing.** Earlier drafts of this research pass referenced
> external sources inline. Those citation markers were not resolved to
> checkable links before this document was finalized, so they have been
> removed rather than left broken or replaced with invented ones — the
> instruction guiding this milestone's documentation work was explicit that
> citations must never be fabricated. The claims below about specific
> named products are informal observations from reviewing their public
> feature pages, not independently verified or formally cited; the general
> claim about LLM-as-judge reliability risk (see §4) reflects widely
> discussed, well-established concerns in AI evaluation practice rather than
> one specific paper. If this project is extended, resolving that gap with
> real, checked citations is a concrete, worthwhile follow-up.

## 1. The learner problem

LLD practice commonly stops at "here is a problem, draw some classes, submit
an answer." That format does not help a learner answer the questions that
actually matter for getting better at low-level design:

- Did I understand the requirements, or did I just draw something plausible?
- Why is this responsibility placed here rather than somewhere else?
- Is this abstraction actually justified by something the problem states?
- Where is coupling becoming a real problem, versus an acceptable dependency?
- What happens to this design if a stated requirement changes?
- Which part of my design is worth improving next?
- Did my second attempt actually improve on my first, or did it just move the
  problem somewhere else?

A one-shot score answers none of these. Improvement requires seeing *why*
something is a concern, grounded in the learner's own design, and then being
able to check whether a later attempt actually addressed it.

## 2. Existing product landscape

Reviewing publicly listed features of current LLD practice tools shows that
the obvious feature set is already well covered, in various combinations:

- UML/diagram editors,
- large problem libraries (dozens of problems),
- runnable code with hidden tests,
- a catalogue of named design patterns,
- AI-generated numeric or letter grades,
- timed interview-practice modes,
- collaborative or multiplayer design sessions,
- a Socratic-style AI tutor alongside the problem set.

**Consequence:** building "LLD problems + a UML editor + an AI score" would
not be a meaningful product distinction — it is close to the existing
baseline, not ahead of it. This ruled out competing on feature count or
problem-library size as this project's differentiator.

## 3. What DesignReview differentiates on

The stronger position, and the one this project actually took, is:

> An evidence-grounded design-review loop that helps a learner iteratively
> improve an LLD design and see how their reasoning changed across attempts —
> not another combination of the same features under a different name.

Concretely, that means:

- **Evidence-grounded review.** A concern is never just an opinion; it names
  a real class, interface, relationship, decision, or edge case in the
  learner's own submission (see ADR-007).
- **Requirement-aware evaluation.** The evaluator reasons from the problem's
  actual stated requirements and constraints, not from how closely the
  submission resembles a template answer.
- **Design evolution.** A second attempt is compared against the first —
  what was added, removed, or changed, which prior concerns look addressed,
  and what new concerns appeared (see `docs/ARCHITECTURE.md`'s
  "Design evolution" section).
- **Structured, validated AI output.** Every model answer is schema-checked
  and evidence-checked before anything reaches the learner (ADR-007).
- **A coach, not a solution generator.** The optional Design Coach answers a
  specific question about the learner's own attempt; it does not hand over a
  finished design (see `docs/ARCHITECTURE.md`'s "The design coach" section).

## 4. Why AI cannot be treated as ground truth

Using a language model to judge design quality carries real, well-known
risks: inconsistency between runs, a bias toward more verbose or more
"textbook-familiar" answers, sensitivity to how a prompt happens to be
phrased, and a tendency to hallucinate specific details (a class name, a
method) that sound plausible but are not actually present in what it was
given. These are widely discussed, general concerns about LLM-as-judge
systems, not specific to this project — and this project does not attempt to
resolve them by claiming its own model calls are exempt.

### Architectural response

Rather than "ask the model, trust the model," this project combines:

```text
Deterministic checks
+
A structured, typed candidate representation
+
A problem-specific rubric
+
Retrieved engineering knowledge (grounding, not an answer key)
+
Mandatory evidence on every substantive claim
+
A stated confidence, not a false sense of certainty
+
A curated behavioural benchmark (docs/EVALUATION_BENCHMARK.md)
```

See ADR-003 (hybrid evaluation) and ADR-007 (evidence-grounded feedback) for
how this is actually implemented, and `docs/EVALUATION_BENCHMARK.md` for how
it is checked without depending on a live model in every test run.

## 5. Why canonical-answer matching is insufficient

The most tempting simplification — "score the submission against one correct
reference design" — was considered and explicitly rejected as a foundational
product decision, not merely deprioritized:

```text
Bad:      Candidate Design → Compare with Reference Diagram → Score
Better:   Candidate Design → Requirements + Constraints + Principles
                            + Relevant Knowledge + Rubric → Evaluation
```

Two structurally different designs can both be strong evaluations if both
satisfy the stated requirements and demonstrate sound engineering judgement —
this is true of real LLD problems, not a hedge. A canonical-answer approach
would penalize a learner for choosing a different, equally valid
decomposition, which is exactly the failure mode
`docs/EVALUATION_BENCHMARK.md`'s valid-alternative benchmark case exists to
catch. See also `docs/RESEARCH.md`'s architectural response (§4) and ADR-003.

## 6. Product hypothesis and what this research does not claim

The product hypothesis this project tests is that LLD practice becomes more
useful when evaluation centres on requirement coverage, concrete evidence,
trade-offs, actionable feedback, and comparison across attempts — not that
this hypothesis is proven. This is a design rationale for what was built and
why, not a controlled study, and no claim in this document or in
`docs/EVALUATION_BENCHMARK.md` should be read as a general accuracy or
learning-outcome claim.

## 7. Design implications

The findings above map directly onto concrete decisions recorded as ADRs:

| Finding | Decision |
|---|---|
| Feature parity is not a differentiator | Build the review loop, not a bigger problem library or diagram editor (ADR-002) |
| A single LLM judge is unreliable alone | Hybrid deterministic + semantic evaluation (ADR-003) |
| A model can hallucinate specifics | Mandatory evidence grounding (ADR-007) |
| No universal ground truth exists for LLD | No canonical solution, ever (§5 above; see `docs/EVALUATION_BENCHMARK.md`) |
| The assignment's centre of gravity is LLD, not infrastructure scale | Modular monolith, no Kafka, no separate vector database (ADR-001, ADR-005, ADR-008) |
