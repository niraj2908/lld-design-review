# LLD Practice Platform --- Engineering Requirements & Product Specification

**Version:** 1.0\
**Date:** 24 September 2026\
**Status:** Frozen baseline for implementation

------------------------------------------------------------------------

## 1. Executive Decision

We are building an **AI-assisted LLD Design Review & Practice
Platform**.

The product is intentionally **not** another generic LLD problem
library, UML editor, or AI score generator.

The core product loop is:

> **Choose → Understand → Design → Submit → Evaluate → Review → Refine →
> Compare → Repeat**

The central product concept is **design evolution**: the learner should
be able to see not only what is wrong with an attempt, but how a
subsequent design improves in response to evidence-backed feedback.

### Product thesis

LLD practice is difficult to evaluate because multiple designs can be
valid. A useful platform therefore should not compare a learner's
solution to one canonical class diagram. It should evaluate the design
against the problem's requirements and engineering principles, identify
evidence from the learner's actual design, explain trade-offs, and
support another iteration.

This thesis is directly aligned with the assignment's questions around
meaningful submissions, useful feedback for multiple valid solutions,
deterministic versus LLM evaluation, evaluator extensibility, and
slow/failed evaluation.

------------------------------------------------------------------------

# 2. Assignment Alignment Audit

The original assignment weights:

  ------------------------------------------------------------------------------------------
  Area                                        Weight Our response
  --------------------- ---------------------------- ---------------------------------------
  Problem understanding                          15% Research note + competitive analysis +
  & research                                         explicit product thesis

  Product thinking /                             15% Design-evolution loop + evidence-backed
  creativity                                         feedback + optional Socratic coach

  LLD / domain design                            25% Explicit domain model, invariants,
                                                     evaluator abstraction, submission
                                                     abstraction

  Evaluation & feedback                          15% Hybrid deterministic + AI evaluation +
                                                     evidence grounding

  Extensibility &                                10% Ports/adapters, evaluator strategies,
  engineering judgement                              submission formats, async dispatcher

  Implementation                                 10% Modular monolith with
  quality                                            technology-independent core

  Testing & reliability                           5% Domain/application/evaluation/failure
                                                     tests

  AI usage                                        5% AI_USAGE.md + benchmarked AI-assisted
                                                     decisions
  ------------------------------------------------------------------------------------------

### Verdict

The proposed product is **actually aligned with the assignment**.

The strongest alignment is not the amount of technology. It is that the
architecture directly answers the assignment's five design questions.

------------------------------------------------------------------------

# 3. Research Findings

## 3.1 Existing products already cover the obvious feature set

Current LLD platforms already offer substantial combinations of:

-   UML editing
-   design-pattern support
-   problem libraries
-   timed interview practice
-   runnable code
-   AI grading
-   requirements analysis
-   collaborative design

For example, LLDCanvas currently provides a UML editor, 23 design
patterns, interview mode, code execution, notes, collaboration and a
large problem library. citeturn0search0turn0search4turn0search6

LLD Arena provides 32 LLD problems, a Java compiler, hidden tests, UML
diagrams, design rubrics and an optional AI design grader.
citeturn0search1

LLD Prep combines requirements analysis, AI evaluation, a Socratic
tutor, dependency graphs and UML design. citeturn0search7

### Consequence

Building:

> "LLD problems + UML + AI score"

would not be a meaningful product distinction.

We therefore **do not compete on feature count**.

------------------------------------------------------------------------

# 4. Validated Product Direction

## 4.1 What we are actually building

### DesignReview

A learner submits a structured LLD design.

The platform:

1.  Validates objective structure.
2.  Maps the design to problem requirements.
3.  Retrieves relevant LLD/OOP/design knowledge.
4.  Uses an LLM for judgment-heavy analysis.
5.  Requires evidence for substantive feedback.
6.  Produces actionable design-review feedback.
7.  Stores the evaluation.
8.  Lets the learner refine the design.
9.  Compares attempts.
10. Optionally coaches the learner through Socratic questions.

### The differentiator

**Design evolution rather than one-shot grading.**

------------------------------------------------------------------------

# 5. Why This Is Actually LLD

This is important because the assignment explicitly distinguishes LLD
from HLD.

The core design concerns are:

-   objects
-   classes
-   interfaces
-   responsibilities
-   relationships
-   encapsulation
-   behavior
-   state
-   invariants
-   composition
-   extensibility
-   patterns
-   testability
-   dependency direction

Those are LLD concerns.

The platform's domain model therefore deliberately represents the
learner's design as a structured object model.

We are **not** primarily solving:

-   load balancing
-   sharding
-   CDN
-   multi-region replication
-   Kubernetes
-   service mesh
-   large-scale distributed storage

Those are explicitly outside the assignment's center of gravity.

Current LLD guidance similarly emphasizes requirements,
responsibilities, class boundaries, behavior, invariants, extensibility
and code-level decisions rather than infrastructure scale.
citeturn1search5turn1search16

------------------------------------------------------------------------

# 6. Core Domain Model

``` text
Problem
│
├── Requirement[]
├── Constraint[]
├── Assumption[]
├── EdgeCase[]
└── EvaluationRubric
        │
        │
        ▼
      Attempt
        │
        ├── Submission
        │      │
        │      └── Design
        │             ├── ClassDefinition[]
        │             ├── InterfaceDefinition[]
        │             ├── Relationship[]
        │             ├── DesignDecision[]
        │             └── EdgeCase[]
        │
        └── Evaluation
               ├── RequirementCoverage[]
               ├── CriterionResult[]
               ├── Evidence[]
               └── FeedbackItem[]
```

------------------------------------------------------------------------

# 7. Domain Objects

## Problem

Owns the problem statement and the knowledge required to evaluate a
solution.

Responsibilities:

-   expose requirements
-   expose constraints
-   expose assumptions
-   expose evaluation rubric
-   define acceptable submission formats

It does **not** evaluate a submission itself.

------------------------------------------------------------------------

## Requirement

Represents one explicit business/design requirement.

Example:

``` text
R5:
The system must support multiple pricing policies.
```

A requirement can be linked to evidence found in a submission.

------------------------------------------------------------------------

## Attempt

Represents one learner practice cycle.

Responsibilities:

-   manage lifecycle
-   own the current submission
-   enforce valid state transitions
-   expose attempt identity and timestamps

State:

``` text
IN_PROGRESS
    ↓
SUBMITTED
    ↓
EVALUATING
    ↓
COMPLETED

EVALUATING
    ↓
FAILED
    ↓
EVALUATING
```

Invalid transitions must be rejected.

------------------------------------------------------------------------

# 8. Design Model

A submission is not a giant text blob.

It is structured.

``` text
Design
├── ClassDefinition[]
├── InterfaceDefinition[]
├── Relationship[]
├── DesignDecision[]
└── EdgeCase[]
```

### ClassDefinition

Contains:

-   name
-   attributes
-   methods
-   responsibilities

### InterfaceDefinition

Contains:

-   name
-   method contracts
-   implementing classes

### Relationship

Contains:

-   source
-   target
-   relationship type
-   cardinality where applicable

### DesignDecision

Contains:

-   decision
-   rationale
-   trade-off

This structure allows deterministic analysis, graph analysis, AI
analysis and attempt comparison.

------------------------------------------------------------------------

# 9. Why We Do Not Start With a Full UML Editor

Existing products already have mature UML-focused workflows.
citeturn0search3turn0search6

A full editor would also consume implementation effort without directly
addressing the assignment's hardest question:

> What makes feedback useful?

Our MVP therefore uses a **structured design workspace**.

Future support:

``` text
Submission
├── StructuredDesign
├── DiagramDesign
└── CodeDesign
```

This directly satisfies the assignment's change test:

> "Today the learner submits text. Later the platform supports a class
> diagram."

The practice/evaluation domain does not need to be rewritten.

------------------------------------------------------------------------

# 10. Evaluation Architecture

Evaluation is a first-class subsystem.

``` text
Submission
    │
    ▼
Normalize
    │
    ▼
Structural Validation
    │
    ▼
Requirement Coverage
    │
    ▼
Design Analysis
    │
    ├── deterministic analysis
    │
    └── AI analysis
            │
            ▼
       RAG Knowledge
            │
            ▼
      Evidence Validation
            │
            ▼
      Feedback Composition
            │
            ▼
        Evaluation
```

------------------------------------------------------------------------

# 11. Deterministic Evaluation

The system should not ask an LLM questions that code can answer
reliably.

Examples:

-   required fields present
-   class names unique
-   relationship endpoints exist
-   interface implementations exist
-   no orphaned design elements where prohibited
-   required sections supplied
-   requirement evidence supplied
-   state transitions valid
-   duplicate evaluation request handling
-   submission format validity

These checks are deterministic.

------------------------------------------------------------------------

# 12. AI Evaluation

The LLM handles judgment-heavy questions:

### Requirement understanding

Does the design adequately address the stated requirements?

### Responsibility quality

Are responsibilities assigned to sensible objects?

### Cohesion

Does a class have a focused purpose?

### Coupling

Are classes unnecessarily dependent on each other?

### Encapsulation

Are state and behavior appropriately owned?

### Abstraction

Are interfaces/abstractions justified by actual variation?

### Extensibility

Can a likely requirement change be handled without widespread
modification?

### Edge cases

Does the design account for meaningful failure paths?

### Reasoning

Does the learner's explanation demonstrate understanding of the
trade-offs?

------------------------------------------------------------------------

# 13. We Do NOT use a Reference Solution as Ground Truth

This is a fundamental product decision.

Bad:

``` text
Candidate Design
       ↓
Compare with Reference Diagram
       ↓
Score
```

Better:

``` text
Candidate Design
       │
       ├── Problem Requirements
       ├── Constraints
       ├── Design Principles
       ├── Relevant Knowledge
       └── Evaluation Rubric
              ↓
         Evaluation
```

Two different designs can receive strong evaluations if both satisfy the
requirements and demonstrate sound engineering judgment.

------------------------------------------------------------------------

# 14. Evidence-Grounded AI

Every meaningful AI concern must point to candidate evidence.

Bad:

``` text
"Your design has poor abstraction."
```

Better:

``` text
Criterion:
Abstraction

Evidence:
ParkingLot.calculateFee()

Concern:
ParkingLot owns a pricing policy that may vary
independently from parking allocation.

Suggestion:
Consider introducing a pricing policy abstraction
only if pricing variation is a real requirement.

Confidence:
0.86
```

The final clause is important.

The system must avoid recommending patterns merely because they are
fashionable.

------------------------------------------------------------------------

# 15. Why AI Cannot Be Treated as Ground Truth

Current research finds significant reliability and bias challenges in
LLM-as-a-judge systems. A 2026 survey describes reliability and bias as
major practical challenges. citeturn0search5turn0search9

Recent work also finds that even strong LLM judges can exhibit
substantial noise when verifying rubrics. citeturn0academia82

Another recent study reports that high apparent agreement between LLM
judges can conceal fragile sample-level judgments and argues for
stronger domain grounding. citeturn0academia83

### Architectural response

We therefore use:

``` text
Deterministic checks
+
Structured candidate representation
+
Problem-specific rubric
+
Retrieved engineering knowledge
+
Evidence requirement
+
AI confidence
+
Evaluation benchmark
```

rather than:

``` text
"GPT, rate this design."
```

------------------------------------------------------------------------

# 16. RAG Decision

## RAG: YES

RAG is justified because the evaluator benefits from a controlled
engineering knowledge base.

Knowledge categories:

``` text
OOP
SOLID
Composition
Inheritance
Design Patterns
Coupling
Cohesion
Encapsulation
State modelling
Testability
Design smells
Problem-specific guidance
```

The retrieval system supplies relevant context to the evaluator.

### Important limitation

RAG is **not** used to create a "correct answer."

It provides:

> **relevant engineering principles against which the candidate's
> reasoning can be examined.**

Research on educational RAG suggests that learner-state-aware, curated
RAG can improve expert-rated instructional quality compared with
prompt-only tutoring, while also warning about evidence-boundary risks.
citeturn0search14

That supports our approach but does **not** prove learning gains. We
will not claim that it does.

------------------------------------------------------------------------

# 17. Vector Database Decision

## PostgreSQL + pgvector: YES

PostgreSQL's pgvector extension provides vector similarity search,
allowing relational product data and knowledge embeddings to live in the
same database. citeturn1search3

This is preferable for the initial architecture to introducing:

``` text
PostgreSQL
+
Pinecone
+
Redis
+
another infrastructure dependency
```

unless future workload demonstrates a need.

------------------------------------------------------------------------

# 18. Kafka Decision

## Kafka: NOT CORE

This is a deliberate rejection.

Kafka is technically appropriate for durable event streaming and
decoupled processing pipelines. citeturn1search2turn1search9

However, the assignment explicitly warns against turning the project
into a distributed-systems exercise.

Therefore:

``` text
EvaluationDispatcher
```

is the abstraction.

Initial implementation:

``` text
InProcessEvaluationDispatcher
```

Possible future implementation:

``` text
KafkaEvaluationDispatcher
```

Kafka will only be introduced if we can demonstrate a concrete benefit
such as independent worker scaling, durable event replay, or multiple
independent consumers.

We will **not deploy Kafka merely to impress the evaluator**.

This is itself an engineering judgment.

------------------------------------------------------------------------

# 19. Architecture

We use a **modular monolith with ports and adapters**.

``` text
┌─────────────────────────────────────────────┐
│                 Presentation                │
│             Next.js / React                 │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│              Application Layer              │
│                                             │
│ StartAttempt                                │
│ SaveDraft                                   │
│ SubmitAttempt                               │
│ EvaluateAttempt                             │
│ RetryEvaluation                             │
│ CompareAttempts                             │
│ AskDesignCoach                              │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│                 Domain Core                 │
│                                             │
│ Problem                                     │
│ Requirement                                 │
│ Attempt                                     │
│ Design                                      │
│ Evaluation                                  │
│ Feedback                                    │
│ Learner Profile                             │
└──────────────────────┬──────────────────────┘
                       │
                  Ports / Interfaces
             ┌─────────┼─────────┐
             ▼         ▼         ▼
        Persistence    LLM      Events
          Adapter    Adapter   Adapter
             │         │         │
             ▼         ▼         ▼
         PostgreSQL   LLM      Dispatcher
                      API
```

Hexagonal architecture is appropriate here because it keeps
domain/application logic independent from persistence, APIs and other
external systems. citeturn0search2turn0search8

------------------------------------------------------------------------

# 20. Important LLD Abstractions

## Evaluator

``` typescript
interface DesignEvaluator {
  evaluate(context: EvaluationContext): Promise<EvaluationResult>;
}
```

Implementations:

``` text
RuleBasedEvaluator
AIDesignEvaluator
HybridEvaluator
HumanEvaluator (future)
```

This answers the assignment's:

> "How would your design accommodate another evaluation approach?"

------------------------------------------------------------------------

## Submission Format

``` typescript
interface SubmissionContent {
  format: SubmissionFormat;
}
```

Future:

``` text
StructuredDesign
DiagramDesign
CodeDesign
```

This answers the assignment's second change test.

------------------------------------------------------------------------

## LLM Provider

``` typescript
interface LLMProvider {
  generateStructured<T>(
    request: LLMRequest
  ): Promise<T>;
}
```

Adapters:

``` text
GroqProvider
OpenAIProvider
MockLLMProvider
```

The domain never knows which vendor is used.

------------------------------------------------------------------------

# 21. Application Use Cases

The application layer contains explicit use cases:

``` text
StartAttempt
SaveDraft
SubmitAttempt
EvaluateAttempt
RetryEvaluation
GetEvaluation
GetAttemptHistory
CompareAttempts
AskDesignCoach
```

We do not create one giant `PracticeService`.

------------------------------------------------------------------------

# 22. Attempt State Machine

``` text
IN_PROGRESS
     │
     │ submit
     ▼
SUBMITTED
     │
     │ start evaluation
     ▼
EVALUATING
   ┌─┴────────────┐
   ▼              ▼
COMPLETED       FAILED
                  │
                  │ retry
                  ▼
              EVALUATING
```

The state transition logic belongs to the domain rather than the UI.

------------------------------------------------------------------------

# 23. Asynchronous Evaluation

Submission must be durable before evaluation starts.

``` text
POST /attempt/:id/submit

1. Validate submission.
2. Persist submission.
3. Change state to SUBMITTED.
4. Dispatch evaluation request.
5. Return accepted response.
```

Worker:

``` text
EvaluationRequested
        ↓
Deterministic analysis
        ↓
RAG retrieval
        ↓
LLM analysis
        ↓
Evidence validation
        ↓
Persist evaluation
        ↓
COMPLETED
```

If evaluation fails:

``` text
FAILED
```

The learner's submission remains available.

------------------------------------------------------------------------

# 24. Idempotency

Retrying an evaluation must not create duplicate evaluations.

We will use an evaluation run identity such as:

``` text
attemptId + submissionVersion
```

or an explicit idempotency key.

This is a real reliability requirement, not distributed-systems theatre.

------------------------------------------------------------------------

# 25. Design Coach

The Design Coach is optional P1 functionality but recommended.

It should be:

-   problem-aware
-   submission-aware
-   feedback-aware
-   knowledge-grounded
-   Socratic

It should prefer:

``` text
Question
→ learner reasoning
→ hint
→ deeper question
→ explanation
```

over:

``` text
Question
→ complete answer
```

------------------------------------------------------------------------

# 26. Attempt Comparison

This is a core differentiator.

Example:

``` text
Attempt #1
ParkingLot
 ├── parkVehicle()
 ├── calculateFee()
 └── processPayment()

Attempt #2
ParkingLot
 ├── parkVehicle()

FeeStrategy
 └── calculateFee()

PaymentProcessor
 └── processPayment()
```

System reports:

``` text
Improved:
✓ Responsibility separation
✓ Extensibility

Potential regression:
⚠ Payment abstraction now introduces
  a concrete gateway dependency.
```

The system is therefore evaluating **change**, not merely snapshots.

------------------------------------------------------------------------

# 27. Learner Skill Profile

This is **P1**, not a required MVP dependency.

Possible dimensions:

``` text
Responsibility
Encapsulation
Coupling
Cohesion
Abstraction
Extensibility
State modelling
Edge cases
Reasoning
```

The profile should be based on multiple attempts and clearly labelled as
an internal learning signal, not an objective measure of engineering
ability.

------------------------------------------------------------------------

# 28. Problem Set

Initial curated set:

### 1. Parking Lot

Tests:

-   composition
-   allocation policy
-   pricing strategy
-   responsibility boundaries

### 2. Vending Machine

Tests:

-   state
-   transitions
-   encapsulation
-   invalid operations

### 3. Elevator System

Tests:

-   state
-   scheduling strategy
-   responsibilities
-   concurrent requests

### 4. Notification System

Tests:

-   interfaces
-   Observer-style relationships
-   channel extensibility
-   failure handling

Four problems are enough for the prototype.

------------------------------------------------------------------------

# 29. Evaluation Rubric

Each problem can customize weights, but the default rubric is:

  -----------------------------------------------------------------------
  Criterion                           Description
  ----------------------------------- -----------------------------------
  Requirement Understanding           Coverage and interpretation of
                                      requirements

  Responsibility                      Appropriate ownership of behavior

  Encapsulation                       State protected by meaningful
                                      behavior

  Cohesion                            Related behavior stays together

  Coupling                            Avoid unnecessary dependencies

  Abstraction                         Interfaces/policies justified by
                                      actual variation

  Extensibility                       Likely changes localized
                                      appropriately

  Edge Cases                          Important failure paths considered

  Design Reasoning                    Trade-offs explained clearly

  Testability                         Design supports meaningful tests
  -----------------------------------------------------------------------

We will avoid pretending that these dimensions produce an objectively
precise engineering score.

------------------------------------------------------------------------

# 30. AI Evaluation Output

Canonical structure:

``` json
{
  "criteria": [
    {
      "criterion": "responsibility",
      "assessment": "needs_improvement",
      "evidence": [
        {
          "entity": "ParkingLot",
          "field": "methods",
          "value": "calculateFee()"
        }
      ],
      "concern": "Pricing policy is coupled to parking management.",
      "suggestion": "Consider a pricing policy abstraction if pricing varies.",
      "confidence": 0.86
    }
  ],
  "strengths": [],
  "priorityImprovements": [],
  "summary": "..."
}
```

------------------------------------------------------------------------

# 31. AI Evaluation Benchmark

We will not assume that the AI evaluator works.

Create a benchmark containing:

``` text
strong-design
weak-design
valid-alternative-design
over-engineered-design
missing-requirement-design
edge-case-heavy-design
```

Test:

-   requirement detection
-   evidence grounding
-   valid alternative acceptance
-   obvious flaw detection
-   schema compliance
-   consistency across repeated evaluations

This is one of the strongest engineering additions to the project.

------------------------------------------------------------------------

# 32. Testing Strategy

### Domain tests

``` text
Attempt cannot move from COMPLETED to SUBMITTED.
Attempt cannot evaluate without submission.
Failed evaluation can be retried.
```

### Design tests

``` text
Duplicate class names rejected.
Unknown relationship endpoints rejected.
Missing required responsibility detected.
```

### Application tests

``` text
SubmitAttempt persists before evaluation.
Evaluation failure preserves submission.
Retry creates no duplicate evaluation.
```

### AI tests

``` text
LLM output conforms to schema.
Unsupported evidence is rejected/flagged.
Valid alternative design is not automatically penalized.
```

### Integration

``` text
Problem → Attempt → Submission → Evaluation → Feedback
```

------------------------------------------------------------------------

# 33. Security / Reliability

Even for a prototype:

-   validate all structured input
-   limit submission size
-   never expose LLM API keys to the browser
-   sanitize rendered AI content
-   validate structured LLM output
-   store evaluator version
-   store prompt/rubric version
-   avoid executing arbitrary learner code in the MVP
-   protect evaluation endpoints from duplicate requests

------------------------------------------------------------------------

# 34. What We Explicitly Rejected

These were considered and rejected as MVP requirements:

### Full UML editor

Reason: already solved by competitors and not central to feedback
quality. citeturn0search3

### Code execution

Reason: useful, but changes the assignment into sandbox/security
engineering.

### Kafka

Reason: assignment explicitly warns against distributed-system
overengineering.

### Separate vector DB

Reason: PostgreSQL + pgvector is sufficient initially.
citeturn1search3

### Redis

Reason: no demonstrated MVP requirement.

### Microservices

Reason: domain boundaries can be demonstrated inside a modular monolith.

### 100+ problems

Reason: content breadth is not our differentiation.

### Generic chatbot

Reason: disconnected from the practice loop.

### Single 0--100 AI score

Reason: weak pedagogical value and unreliable as a sole evaluation
mechanism.

------------------------------------------------------------------------

# 35. Architecture Quality Bar

We will judge every abstraction using this question:

> **What change does this abstraction protect us from?**

Examples:

  Abstraction               Change protected
  ------------------------- --------------------------------
  `DesignEvaluator`         Evaluation strategy
  `LLMProvider`             AI vendor/model
  `SubmissionContent`       New submission format
  `EvaluationDispatcher`    Sync/in-process vs queue/Kafka
  `ProblemRepository`       Persistence implementation
  `Attempt` state machine   Lifecycle invariants
  `Requirement`             Problem-specific evaluation
  `KnowledgeRetriever`      RAG/vector implementation

If an abstraction has no credible answer, we remove it.

------------------------------------------------------------------------

# 36. Proposed Repository

``` text
lld-design-review/
│
├── apps/
│   ├── web/
│   └── evaluation-worker/
│
├── packages/
│   ├── domain/
│   │   ├── problem/
│   │   ├── attempt/
│   │   ├── design/
│   │   ├── evaluation/
│   │   └── feedback/
│   │
│   ├── application/
│   │   ├── start-attempt/
│   │   ├── submit-attempt/
│   │   ├── evaluate-attempt/
│   │   ├── retry-evaluation/
│   │   └── compare-attempts/
│   │
│   ├── evaluation-engine/
│   │   ├── deterministic/
│   │   ├── ai/
│   │   ├── evidence/
│   │   └── pipeline/
│   │
│   ├── ai/
│   │   ├── provider/
│   │   ├── prompts/
│   │   └── schemas/
│   │
│   ├── rag/
│   │   ├── ingestion/
│   │   ├── retrieval/
│   │   └── knowledge/
│   │
│   └── infrastructure/
│       ├── persistence/
│       └── messaging/
│
├── prisma/
│
├── knowledge/
│
├── evaluation-benchmark/
│
├── tests/
│
├── docs/
│   ├── RESEARCH.md
│   ├── ARCHITECTURE.md
│   ├── DOMAIN_MODEL.md
│   ├── EVALUATION.md
│   └── ADR/
│
├── README.md
└── AI_USAGE.md
```

This is intentionally a **modular monolith**, even though the repository
has module boundaries that would permit later extraction.

------------------------------------------------------------------------

# 37. Final Technology Stack

## Frontend

-   Next.js
-   React
-   TypeScript
-   Tailwind CSS
-   shadcn/ui

## Backend

-   Next.js server/application layer
-   TypeScript
-   Zod

## Database

-   PostgreSQL
-   Prisma
-   pgvector

## AI

-   Configurable LLM provider
-   Structured output
-   Embeddings
-   RAG

## Evaluation

-   Deterministic rule engine
-   AI evaluator
-   Evidence validator
-   Evaluation benchmark

## Async processing

-   EvaluationDispatcher abstraction
-   In-process worker initially
-   Kafka adapter only if justified later

## Testing

-   Vitest
-   Integration tests
-   Evaluation benchmark

## Deployment

-   Vercel/web application
-   Managed PostgreSQL
-   Worker deployment appropriate to the selected async implementation

------------------------------------------------------------------------

# 38. Final Product Scope

### MVP

``` text
Problem selection
        ↓
Problem requirements
        ↓
Structured LLD workspace
        ↓
Draft
        ↓
Submit
        ↓
Deterministic analysis
        ↓
RAG
        ↓
AI design review
        ↓
Evidence-backed feedback
        ↓
History
        ↓
Retry / improved attempt
        ↓
Attempt comparison
```

### P1

``` text
Socratic Design Coach
Learner skill profile
Personalized problem recommendation
Richer design visualization
```

### P2

``` text
Diagram editor
Code submission
Code execution
Human review
Kafka-backed event streaming
Redis
Advanced analytics
```

------------------------------------------------------------------------

# 39. Definition of Done

The project is not complete merely because the UI works.

It is complete when:

-   [ ] learner can complete the full practice loop
-   [ ] submission is structured and persisted
-   [ ] evaluation is asynchronous/retryable
-   [ ] deterministic checks work
-   [ ] AI evaluation produces structured feedback
-   [ ] feedback references candidate evidence
-   [ ] valid alternative designs are supported
-   [ ] previous attempts can be inspected
-   [ ] two attempts can be compared
-   [ ] evaluation failures do not lose submissions
-   [ ] domain invariants have tests
-   [ ] AI output has schema validation
-   [ ] AI evaluator has benchmark cases
-   [ ] architecture has clear dependency direction
-   [ ] LLM provider is replaceable
-   [ ] evaluator implementation is replaceable
-   [ ] submission format is extensible
-   [ ] research note is complete
-   [ ] architecture/design note is complete
-   [ ] AI_USAGE.md is complete
-   [ ] README is complete
-   [ ] no unnecessary distributed infrastructure exists

------------------------------------------------------------------------

# 40. Final Senior-Engineer Verdict

### Is this the same thing the assignment asks for?

**Yes.**

It directly implements:

-   problem selection
-   meaningful LLD practice
-   submission
-   useful feedback
-   history
-   deterministic + AI evaluation
-   evaluator extensibility
-   submission-format extensibility
-   slow/failing evaluation handling
-   LLD/domain design

### Is the product idea proven?

**The exact product is still a hypothesis.**

That is important.

The research validates that the problem exists and that current tools
already cover many adjacent solutions. It does **not** prove that
learners will prefer our design-evolution approach.

Therefore we should describe it as a **research-informed product
hypothesis**, not a proven market gap.

### Is it actually LLD?

**Yes, if we keep the learner-design model and domain behavior
central.**

The platform's own architecture should demonstrate:

-   responsibilities
-   encapsulation
-   interfaces
-   state
-   composition
-   policies
-   invariants
-   extensibility
-   testability
-   dependency inversion

### Is RAG justified?

**Yes, conditionally.**

It has a concrete job: grounding design feedback in curated LLD
knowledge. Educational RAG research supports the direction while also
showing evidence-boundary risks, so we will benchmark and constrain it
rather than claim that RAG automatically improves learning.
citeturn0search14

### Is Kafka justified?

**Not as an MVP requirement.**

We retain the architectural seam for it, but adding Kafka solely for
presentation would violate the assignment's practical-scope guidance.
Kafka is designed for durable event streaming and decoupled processing,
but our current workload does not establish a need for it.
citeturn1search2turn1search9

### Is the architecture over-engineered?

**Not if we implement the core as a modular monolith and enforce a
strict rule: every abstraction must isolate a real variation.**

Hexagonal architecture is appropriate where it protects the domain from
infrastructure changes, but we should avoid adding layers merely for
ceremony. citeturn0search2turn0search10

### Is the proposed product a "killer" product?

I would **not claim that yet**.

What we can legitimately claim is:

> **It is a differentiated, research-informed prototype hypothesis with
> a strong alignment to the assignment and a technically defensible
> reason for each major component.**

That is the correct engineering position.

The thing that can make it genuinely impressive is **execution**:
evidence-backed evaluation, strong domain modelling, excellent UX around
design iteration, benchmarked AI behavior, and the ability to explain
every architectural decision under questioning.

------------------------------------------------------------------------

# 41. Source Set Used for This Decision

The research above included current LLD products and
architecture/AI-evaluation sources rather than relying on generic
assumptions:

-   LLDCanvas feature set and UML editor.
    citeturn0search0turn0search3
-   LLD Arena implementation and AI grader. citeturn0search1
-   LLD Prep requirements/UML/AI workflow. citeturn0search7
-   LLM-as-a-judge reliability survey. citeturn0search5turn0search9
-   Recent rubric-verification reliability research.
    citeturn0academia82turn0academia83
-   Educational RAG/tutoring research. citeturn0search14
-   Hexagonal architecture guidance. citeturn0search2turn0search8
-   Kafka's documented event-streaming/messaging use cases.
    citeturn1search2turn1search9
-   PostgreSQL/pgvector capability. citeturn1search3
-   Current LLD engineering guidance around responsibilities,
    extensibility and avoiding over-engineering.
    citeturn1search5turn1search10turn1search19
