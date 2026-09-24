# DesignReview — Master Engineering Specification

> **Project:** DesignReview — LLD Design Practice & Review Platform  
> **Repository name:** `designreview`  
> **Document:** Master Engineering Specification  
> **Status:** Implementation-ready blueprint  
> **Last updated:** 2026-09-24

---

## 1. Executive Summary

DesignReview is a focused practice platform for Low-Level Design (LLD).

The learner follows this loop:

**Choose Problem → Understand Requirements → Design → Submit → Evaluate → Review Feedback → Refine → Compare Attempts → Repeat**

The platform is not primarily a question bank and not primarily an AI chatbot.

Its central product idea is **design evolution**:

> Help learners understand why their design works, identify concrete weaknesses with evidence from their own submission, and improve the design across attempts.

The platform should evaluate designs against:

- explicit problem requirements,
- constraints and edge cases,
- design principles,
- a problem-specific rubric,
- relevant engineering knowledge,

rather than comparing every submission to one supposedly correct reference design.

The system combines:

1. deterministic structural checks,
2. rubric-based AI evaluation,
3. evidence-grounded feedback,
4. optional RAG-based design coaching,
5. attempt history and comparison.

The implementation should be technically strong enough to demonstrate senior engineering judgment while avoiding architecture added only for presentation.

---

# 2. Product Thesis

## 2.1 Problem

LLD practice commonly stops at:

> "Here is a problem. Draw classes. Submit an answer."

That does not adequately answer:

- Did I understand the requirements?
- Why is this responsibility placed here?
- Is my abstraction justified?
- Where is coupling becoming problematic?
- What happens when requirements change?
- Which part of my design should I improve next?
- Did my second attempt actually improve over my first?

## 2.2 Product Hypothesis

DesignReview tests the hypothesis that LLD practice becomes more useful when evaluation focuses on:

- requirements coverage,
- design evidence,
- trade-offs,
- actionable feedback,
- iterative refinement,
- comparison between attempts.

This is a product hypothesis, not a claim that the approach is universally superior.

## 2.3 Differentiation

Generic LLD features such as:

- problem libraries,
- UML diagrams,
- AI scoring,
- code execution,
- design-pattern explanations,

are already available in existing products.

Therefore DesignReview should differentiate through:

### Evidence-grounded review

Feedback must point to concrete elements in the learner's design.

### Requirement-aware evaluation

The evaluator reasons from requirements and constraints instead of blindly matching a canonical solution.

### Design evolution

The platform compares attempts and shows what changed.

### Structured evaluation

AI output is validated against a schema and combined with deterministic checks.

### Learner-aware coaching

The optional Design Coach uses the learner's actual submission, feedback, and relevant design knowledge.

---

# 3. Goals

## Primary Goals

1. Provide a small but meaningful LLD problem set.
2. Allow learners to create structured designs.
3. Persist every attempt.
4. Evaluate submissions using deterministic checks + AI reasoning.
5. Produce actionable, evidence-backed feedback.
6. Support retries after failed evaluation.
7. Preserve complete attempt history.
8. Compare designs across attempts.
9. Provide a clear architecture for future evaluator/submission types.
10. Demonstrate sound LLD/domain modelling.

## Secondary Goals

1. Ground AI feedback in engineering knowledge using RAG.
2. Provide a Socratic Design Coach.
3. Build a learner skill profile from repeated evaluation signals.
4. Recommend future practice problems based on recurring weaknesses.

---

# 4. Non-Goals

The MVP should NOT become:

- a Kubernetes project,
- a microservices showcase,
- a distributed-systems project,
- a multi-region deployment,
- a full UML modelling suite,
- an arbitrary code-execution sandbox,
- a social network,
- a leaderboard product,
- an enterprise authentication platform,
- a 100+ problem question bank,
- a Kafka-dependent system.

These may become future extensions only when an actual product requirement justifies them.

---

# 5. Target Users

## Primary User

A software-engineering learner preparing for:

- LLD interviews,
- software design interviews,
- object-oriented design rounds,
- practical design reasoning.

## Secondary User

Potential future reviewer/mentor who wants to inspect:

- learner attempts,
- evaluation evidence,
- feedback,
- design evolution.

Human review is not required for MVP but the architecture must not prevent it.

---

# 6. Core User Journey

```text
Problem List
    ↓
Problem Details
    ↓
Start Attempt
    ↓
Understand Requirements
    ↓
Create Structured Design
    ↓
Save Draft
    ↓
Submit
    ↓
Persist Submission
    ↓
Evaluation
    ├── Deterministic Checks
    ├── Requirement Analysis
    ├── Knowledge Retrieval
    ├── AI Design Analysis
    └── Evidence Validation
    ↓
Completed / Failed
    ↓
Feedback
    ↓
Refine Design
    ↓
New Attempt
    ↓
Compare Attempts
```

---

# 7. MVP Problem Set

Start with four problems.

## 7.1 Parking Lot

Primary concepts:

- composition,
- responsibility boundaries,
- allocation strategy,
- pricing strategy,
- interfaces,
- extensibility.

Example variation points:

- vehicle types,
- spot types,
- allocation strategy,
- pricing policy,
- payment methods.

## 7.2 Vending Machine

Primary concepts:

- state modelling,
- transitions,
- encapsulation,
- invalid operations,
- inventory responsibility.

## 7.3 Elevator System

Primary concepts:

- state,
- scheduling strategy,
- responsibilities,
- request modelling,
- extensibility.

## 7.4 Notification System

Primary concepts:

- interfaces,
- channel abstraction,
- observer-style relationships,
- extensibility,
- failure handling.

Four high-quality problems are preferable to a large shallow library.

---

# 8. What a Learner Must Submit

A meaningful attempt should not be only free-form prose.

The MVP uses a **Structured Design Submission**.

## Required sections

### Classes

Each class contains:

- name,
- responsibility,
- attributes,
- methods.

### Interfaces

Each interface contains:

- name,
- responsibility,
- method contracts.

### Relationships

Each relationship contains:

- source,
- target,
- relationship type,
- optional cardinality,
- optional rationale.

Supported relationship types:

- association,
- aggregation,
- composition,
- inheritance,
- implementation,
- dependency.

### Design Decisions

Each decision contains:

- decision,
- rationale,
- trade-off.

### Edge Cases

Learner records relevant edge cases.

### Requirement Mapping

Learner can map design elements to requirements.

This makes the design evaluable without requiring a full UML editor.

---

# 9. Why Structured Submission Is MVP

Structured submission gives us:

- deterministic validation,
- reliable evidence references,
- requirement mapping,
- comparison between attempts,
- machine-readable evaluation,
- future diagram/code adapters.

A full drag-and-drop UML editor is intentionally deferred.

The system can later accept additional formats through a submission-format abstraction.

---

# 10. Submission Format Abstraction

Define:

```ts
interface SubmissionFormat {
  type: string;

  validate(input: unknown): ValidationResult;

  normalize(input: unknown): NormalizedSubmission;
}
```

MVP:

```text
StructuredDesignSubmission
```

Future:

```text
DiagramSubmission
CodeSubmission
TextSubmission
```

The application layer should not depend directly on a specific submission representation.

---

# 11. Domain Model

Core entities:

```text
Problem
Requirement
Attempt
Design
ClassDefinition
InterfaceDefinition
Relationship
DesignDecision
EdgeCase
Submission
Evaluation
CriterionResult
Evidence
FeedbackItem
```

Optional P1 entities:

```text
SkillSignal
LearnerSkillProfile
Recommendation
KnowledgeDocument
KnowledgeChunk
```

---

# 12. Problem

A `Problem` defines the practice context.

Properties:

```ts
Problem {
  id
  slug
  title
  description
  context
  constraints
  requirements
  edgeCases
  rubric
  acceptedSubmissionFormats
  version
  createdAt
  updatedAt
}
```

A problem must have explicit requirements.

---

# 13. Requirement

A requirement represents one meaningful business/design expectation.

```ts
Requirement {
  id
  problemId
  code
  title
  description
  priority
}
```

Example:

```text
PL-REQ-01
Vehicle should be assigned to a compatible parking spot.
```

Requirements are central to evaluation.

---

# 14. Attempt

An `Attempt` represents one practice cycle.

```ts
Attempt {
  id
  problemId
  learnerId
  attemptNumber
  status
  currentSubmissionId
  createdAt
  submittedAt
  completedAt
}
```

## Attempt State Machine

```text
IN_PROGRESS
     |
     v
SUBMITTED
     |
     v
EVALUATING
   /     \
  v       v
COMPLETED FAILED
             |
             v
         EVALUATING
```

Invalid transitions must be rejected by the domain layer.

---

# 15. Submission

A submission is an immutable version of learner work at submission time.

```ts
Submission {
  id
  attemptId
  version
  formatType
  payload
  createdAt
}
```

Drafts may be mutable.

Submitted versions must be immutable.

---

# 16. Design Model

```ts
Design {
  classes: ClassDefinition[]
  interfaces: InterfaceDefinition[]
  relationships: Relationship[]
  decisions: DesignDecision[]
  edgeCases: EdgeCase[]
  requirementMappings: RequirementMapping[]
}
```

---

# 17. Class Definition

```ts
ClassDefinition {
  id
  name
  responsibility
  attributes[]
  methods[]
}
```

Each class must communicate what it owns and what it is responsible for.

---

# 18. Interface Definition

```ts
InterfaceDefinition {
  id
  name
  responsibility
  methods[]
}
```

Example:

```text
PricingStrategy
    calculateFee(ticket, duration)
```

---

# 19. Relationship

```ts
Relationship {
  source
  target
  type
  cardinality?
  rationale?
}
```

The domain must validate:

- source exists,
- target exists,
- relationship type is supported,
- self-references are allowed only when valid,
- duplicate invalid relationships are rejected.

---

# 20. Design Decision

```ts
DesignDecision {
  decision
  rationale
  tradeoff
}
```

Example:

```text
Decision:
Use Strategy for parking allocation.

Rationale:
Different allocation policies may change independently.

Trade-off:
Adds an abstraction for a variation point that may be unnecessary
if allocation rules remain fixed.
```

---

# 21. Evaluation Philosophy

The platform must NOT ask:

> "Does the learner match our reference solution?"

Instead:

> "Does the design satisfy the requirements and demonstrate sound design reasoning?"

Multiple valid designs must be accepted.

---

# 22. Evaluation Layers

Evaluation pipeline:

```text
Submission
   ↓
Normalization
   ↓
Deterministic Validation
   ↓
Requirement Coverage
   ↓
Knowledge Retrieval
   ↓
AI Design Evaluation
   ↓
Evidence Validation
   ↓
Feedback Composition
   ↓
Persist Evaluation
```

---

# 23. Deterministic Evaluation

Deterministic checks should handle facts that do not require subjective reasoning.

Examples:

- required sections exist,
- class names are unique,
- relationship endpoints exist,
- interface implementations reference existing interfaces,
- required requirement mappings exist,
- supported submission format,
- valid attempt state,
- submission is not empty,
- submission size is within limits.

Deterministic checks should never pretend to determine subjective design quality.

---

# 24. AI Evaluation

AI evaluates areas requiring design reasoning.

Suggested criteria:

1. Requirement Understanding
2. Responsibility
3. Encapsulation
4. Cohesion
5. Coupling
6. Abstraction
7. Extensibility
8. Edge Cases
9. Design Reasoning
10. Testability

Not every problem must use identical weights.

Problem-specific rubrics are allowed.

---

# 25. Evidence-Grounded AI Feedback

Every substantive concern must reference evidence from the learner's design.

Bad:

> "Your design has poor encapsulation."

Good:

> `ParkingLot.calculateFee()` contains vehicle-type pricing logic. If pricing rules are expected to vary independently, this creates a responsibility that could be isolated behind a pricing policy.

Evidence:

```json
{
  "entity": "ParkingLot",
  "field": "methods",
  "value": "calculateFee"
}
```

The evaluator must distinguish:

- observation,
- concern,
- recommendation,
- confidence.

---

# 26. AI Evaluation Output

Use strict structured output.

Example:

```json
{
  "criteria": [
    {
      "criterion": "Responsibility",
      "assessment": "NEEDS_IMPROVEMENT",
      "evidence": [
        {
          "entity": "ParkingLot",
          "field": "methods",
          "value": "calculateFee"
        }
      ],
      "concern": "ParkingLot owns pricing logic.",
      "suggestion": "Consider isolating pricing policy if pricing rules are expected to vary.",
      "confidence": 0.86
    }
  ],
  "strengths": [
    "Parking allocation is separated from vehicle modelling."
  ],
  "priorityImprovements": [
    "Separate pricing policy from ParkingLot."
  ],
  "summary": "The design covers the core flow but has a potential responsibility boundary issue around pricing."
}
```

The JSON must be validated before persistence.

---

# 27. Confidence

AI confidence is advisory.

It must NOT be presented as objective truth.

Confidence helps communicate uncertainty.

Example:

```text
High confidence:
Requirement clearly missing.

Medium confidence:
Potential responsibility overlap.

Low confidence:
Possible abstraction concern requiring learner judgment.
```

---

# 28. Avoid Canonical-Solution Bias

Do not compare the learner to one stored answer.

Instead provide the AI:

```text
Problem Requirements
+
Constraints
+
Learner Design
+
Deterministic Findings
+
Evaluation Rubric
+
Relevant Design Knowledge
```

The AI then evaluates the submitted design.

---

# 29. Evaluation Schema Versioning

Persist:

- evaluator version,
- rubric version,
- prompt version,
- knowledge context version.

Example:

```text
evaluatorVersion = "hybrid-v1"
rubricVersion = "parking-lot-v2"
promptVersion = "design-review-v4"
knowledgeVersion = "llm-design-kb-v1"
```

This allows reproducibility and debugging.

---

# 30. Evaluation Entity

```ts
Evaluation {
  id
  submissionId
  status
  evaluatorVersion
  rubricVersion
  promptVersion
  knowledgeVersion
  criterionResults
  strengths
  priorityImprovements
  summary
  confidence
  createdAt
  completedAt
  error
}
```

---

# 31. Evaluation Status

```text
PENDING
EVALUATING
COMPLETED
FAILED
```

A failed evaluation must preserve the submission.

---

# 32. Retry Semantics

Retry should:

1. keep original submission immutable,
2. create a new evaluation execution/version,
3. avoid duplicate evaluation,
4. preserve failure history,
5. expose the latest successful evaluation.

---

# 33. Idempotency

Evaluation requests should be idempotent.

Logical identity:

```text
attemptId + submissionVersion + evaluatorVersion
```

or an explicit idempotency key.

Repeated requests must not create uncontrolled duplicate evaluations.

---

# 34. Evaluation Dispatcher

Use:

```ts
interface EvaluationDispatcher {
  dispatch(request: EvaluationRequest): Promise<void>;
}
```

MVP implementation:

```text
InProcessEvaluationDispatcher
```

Future:

```text
KafkaEvaluationDispatcher
```

Kafka should NOT be introduced merely to make the architecture look advanced.

---

# 35. Why Kafka Is Not MVP

The product does not initially require:

- high-volume event streaming,
- multiple independently scaling consumers,
- cross-service event choreography,
- durable distributed event processing.

An abstraction allows future adoption without coupling the domain to Kafka.

If actual load or product requirements justify it later, the adapter can change.

---

# 36. Evaluation Failure Handling

Expected behavior:

```text
Submit
  ↓
Persist Submission
  ↓
Dispatch
  ↓
Evaluation Fails
  ↓
Status = FAILED
  ↓
Show Retry
  ↓
Retry Evaluation
```

The learner's work must never disappear because an LLM provider failed.

---

# 37. LLM Provider Abstraction

```ts
interface LLMProvider {
  generateStructured<T>(
    request: LLMRequest
  ): Promise<T>;
}
```

Possible adapters:

```text
GroqProvider
OpenAIProvider
MockLLMProvider
```

Provider credentials remain server-side.

---

# 38. RAG Strategy

RAG is useful, but it must be scoped carefully.

RAG provides grounded engineering knowledge.

It does NOT define a single correct LLD answer.

---

# 39. RAG Knowledge Base

Initial knowledge categories:

### OOP

- encapsulation,
- abstraction,
- inheritance,
- composition.

### SOLID

- SRP,
- OCP,
- LSP,
- ISP,
- DIP.

### Design Patterns

- Strategy,
- State,
- Observer,
- Factory,
- Decorator,
- Adapter.

### Design Quality

- cohesion,
- coupling,
- dependency direction,
- testability,
- responsibility boundaries.

### Design Smells

- God Object,
- Tight Coupling,
- Shotgun Surgery,
- Anemic Domain Model,
- Premature Abstraction.

### Problem-specific guidance

- parking allocation,
- vending states,
- elevator scheduling,
- notification channels.

---

# 40. RAG Architecture

Use:

```text
Knowledge Document
    ↓
Chunking
    ↓
Embedding
    ↓
PostgreSQL + pgvector
    ↓
Retriever
    ↓
Relevant Knowledge
```

No separate vector database is required for MVP.

---

# 41. Knowledge Retrieval Port

```ts
interface KnowledgeRetriever {
  retrieve(query: KnowledgeQuery): Promise<KnowledgeChunk[]>;
}
```

The evaluation engine must not know whether retrieval uses:

- pgvector,
- another vector store,
- keyword search,
- hybrid retrieval.

---

# 42. RAG Quality Controls

Do not blindly inject many documents.

Track:

- retrieved document IDs,
- similarity/relevance,
- knowledge version,
- retrieval query.

Avoid irrelevant context.

Evaluation quality should be tested with retrieval benchmarks.

---

# 43. Design Coach

The Design Coach is a learner-facing assistant.

It receives:

```text
Problem
+
Learner Design
+
Evaluation Feedback
+
Attempt History
+
Relevant Knowledge
```

The coach should be Socratic.

Instead of:

> "Use Strategy pattern."

Prefer:

> "Which part of your design would change if the pricing rules changed independently?"

Then reveal progressively more guidance.

---

# 44. Coach Safety Against Answer Dumping

The coach should have levels:

```text
LEVEL 1 — Question
LEVEL 2 — Hint
LEVEL 3 — Concept
LEVEL 4 — Example
LEVEL 5 — Detailed guidance
```

This preserves learning value.

---

# 45. Attempt Comparison

This is a core product feature.

Compare:

```text
Attempt 1
vs
Attempt 2
```

Show:

- added classes,
- removed classes,
- changed responsibilities,
- changed relationships,
- changed interfaces,
- requirement coverage changes,
- evaluation changes,
- recurring weaknesses,
- improvements,
- regressions.

Example:

```text
Attempt 1:
ParkingLot.calculateFee()

Attempt 2:
ParkingLot → PricingStrategy

Detected change:
Pricing responsibility extracted.

Likely improvement:
Lower responsibility concentration.

Trade-off:
Additional abstraction introduced.
```

---

# 46. Skill Profile — P1

Do not make the skill profile an MVP dependency.

Potential dimensions:

```text
Responsibility
Encapsulation
Coupling
Cohesion
Abstraction
Extensibility
State Modelling
Edge Cases
Design Reasoning
Testability
```

The profile should represent observed practice signals, not an objective measurement of engineering ability.

---

# 47. Personalized Recommendations — P1

After several attempts:

```text
Recurring weakness:
State modelling

Recommended next problem:
Vending Machine

Reason:
Your previous attempts showed repeated issues modelling
state transitions and invalid operations.
```

This closes the learning loop.

---

# 48. Architecture

Use a **Modular Monolith with Ports and Adapters**.

Dependency direction:

```text
UI
 ↓
Application
 ↓
Domain
 ↑
Ports
 ↑
Adapters
```

More concretely:

```text
Next.js UI
    ↓
Application Use Cases
    ↓
Domain
    ↓
Ports
    ↑
Infrastructure Adapters
```

Domain must not import Prisma, Next.js, provider SDKs, or Kafka.

---

# 49. Why Modular Monolith

It gives:

- clear module boundaries,
- easy local development,
- simpler deployment,
- transactional consistency,
- low operational complexity,
- easy future extraction.

It demonstrates architectural judgment without unnecessary distributed infrastructure.

---

# 50. Application Use Cases

Explicit use cases:

```text
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

Avoid a giant:

```text
PracticeService
```

containing every operation.

---

# 51. Domain Services

Potential services:

```text
DesignValidator
RequirementCoverageAnalyzer
AttemptStateMachine
DesignComparator
EvaluationResultValidator
```

Use domain services only where logic does not naturally belong to one entity.

---

# 52. Repository Ports

```ts
interface ProblemRepository
interface AttemptRepository
interface SubmissionRepository
interface EvaluationRepository
```

Infrastructure provides implementations.

---

# 53. Infrastructure

```text
PostgreSQL
Prisma
pgvector
LLM provider
Embedding provider
Evaluation dispatcher
```

Infrastructure code must remain behind ports.

---

# 54. Database

Primary relational entities:

```text
problems
requirements
problem_rubrics
attempts
submissions
evaluations
criterion_results
evidence
design_classes
design_interfaces
design_relationships
design_decisions
edge_cases
```

Depending on implementation, the structured submission may be stored as JSONB with relational indexes rather than fully normalizing every nested field.

Prefer pragmatic persistence over needless normalization.

---

# 55. Suggested Prisma Direction

Core relational identity:

```text
Problem
Requirement
Attempt
Submission
Evaluation
```

Structured design can initially be stored as validated JSONB.

Example:

```text
Submission.payload
```

contains:

```json
{
  "classes": [],
  "interfaces": [],
  "relationships": [],
  "decisions": [],
  "edgeCases": [],
  "requirementMappings": []
}
```

This provides flexibility while preserving schema validation at the application/domain boundary.

---

# 56. API Contracts

## Problems

```http
GET /api/problems
GET /api/problems/:slug
```

## Attempts

```http
POST /api/problems/:problemId/attempts
GET /api/attempts/:attemptId
PATCH /api/attempts/:attemptId/draft
POST /api/attempts/:attemptId/submit
```

## Evaluation

```http
GET /api/attempts/:attemptId/evaluation
POST /api/attempts/:attemptId/evaluation/retry
```

## History

```http
GET /api/problems/:problemId/attempts
GET /api/problems/:problemId/compare?left=:id&right=:id
```

## Coach

```http
POST /api/attempts/:attemptId/coach
```

---

# 57. Submit API Semantics

```http
POST /api/attempts/:attemptId/submit
```

Server sequence:

```text
1. Authenticate/identify learner
2. Load attempt
3. Validate state
4. Validate submission format
5. Validate structured design
6. Persist immutable submission
7. Transition attempt → SUBMITTED
8. Dispatch evaluation
9. Return accepted response
```

Important:

**Persist before evaluation.**

Do not call an LLM first and then attempt to save the learner's work.

---

# 58. Submit Response

Example:

```json
{
  "attemptId": "att_123",
  "submissionId": "sub_456",
  "status": "SUBMITTED"
}
```

The UI can then poll or subscribe to evaluation status.

MVP polling is acceptable.

---

# 59. Evaluation Worker

Logical workflow:

```text
Receive EvaluationRequest
    ↓
Load Submission
    ↓
Load Problem + Rubric
    ↓
Deterministic Checks
    ↓
Requirement Coverage
    ↓
Retrieve Knowledge
    ↓
LLM Evaluation
    ↓
Validate LLM Schema
    ↓
Validate Evidence
    ↓
Compose Feedback
    ↓
Persist Evaluation
    ↓
Mark Attempt COMPLETED
```

Failure:

```text
catch
  ↓
Persist FAILED evaluation
  ↓
Preserve submission
  ↓
Allow retry
```

---

# 60. Deterministic + AI Responsibility Matrix

| Concern | Deterministic | AI |
|---|---:|---:|
| Required fields | Yes | No |
| Duplicate class names | Yes | No |
| Invalid relationships | Yes | No |
| Missing requirement mapping | Yes | No |
| Requirement interpretation | Support | Yes |
| Responsibility quality | No | Yes |
| Cohesion | No | Yes |
| Coupling | Support | Yes |
| Abstraction quality | No | Yes |
| Extensibility | No | Yes |
| Edge-case reasoning | Support | Yes |
| Design rationale | No | Yes |
| Schema validity | Yes | No |

---

# 61. Evaluation Benchmark

Create a local benchmark dataset.

Minimum cases:

```text
1. Strong design
2. Weak design
3. Valid alternative design
4. Over-engineered design
5. Missing requirement
6. Edge-case-heavy design
7. Ambiguous but reasonable design
```

Test:

- requirement detection,
- evidence grounding,
- valid alternative acceptance,
- schema compliance,
- consistency,
- false-positive rate.

The benchmark is more valuable than claiming the LLM is always correct.

---

# 62. AI Evaluation Test Example

Given:

```text
ParkingLot has calculateFee()
```

The evaluator should NOT automatically criticize it.

It should ask:

```text
Does the problem require pricing policies to vary independently?
```

If yes:

```text
Potential responsibility issue.
```

If no:

```text
Do not penalize merely because another design could extract PricingStrategy.
```

This is essential for avoiding pattern cargo-culting.

---

# 63. Evaluation Ground Truth Philosophy

There is no universal ground truth for LLD.

Therefore benchmark expected behavior should focus on:

- identifying explicit requirement violations,
- detecting objectively invalid structure,
- grounding concerns,
- recognizing valid alternatives,
- avoiding unjustified pattern recommendations.

---

# 64. Testing Strategy

## Domain Tests

Test:

- valid attempt creation,
- invalid state transitions,
- submission requirements,
- retry state,
- immutable submitted submission.

## Design Validation Tests

Test:

- duplicate class names,
- missing class names,
- invalid relationship endpoint,
- unsupported relationship type,
- missing required responsibility,
- invalid interface implementation.

## Application Tests

Test:

- submission persisted before dispatch,
- dispatch failure preserves submission,
- retry does not duplicate submission,
- completed evaluation updates attempt state,
- failed evaluation exposes retry.

## AI Tests

Test:

- schema validation,
- evidence requirement,
- valid alternatives,
- missing requirement detection,
- hallucinated evidence rejection.

## Integration Test

```text
Problem
 → Attempt
 → Draft
 → Submit
 → Evaluation
 → Feedback
```

## E2E Test

One complete learner flow through the UI.

---

# 65. Security

MVP security requirements:

- server-side API keys only,
- input validation with Zod,
- submission size limits,
- strict structured input validation,
- sanitize AI-rendered content,
- prevent arbitrary code execution,
- protect evaluation endpoints,
- validate attempt ownership,
- avoid exposing internal evaluator prompts unnecessarily.

---

# 66. No Arbitrary Code Execution in MVP

Learner code execution is intentionally excluded.

Reasons:

- security complexity,
- sandboxing complexity,
- resource limits,
- little value for the core LLD-review thesis.

A future isolated execution service can be added through the submission/evaluator abstraction.

---

# 67. Frontend Information Architecture

## Pages

```text
/
  Problem Library

/problems/:slug
  Problem Details

/attempts/:id
  Design Workspace

/attempts/:id/evaluation
  Evaluation & Feedback

/problems/:id/history
  Attempt History

/problems/:id/compare
  Attempt Comparison
```

---

# 68. Problem Details UX

Show:

- problem context,
- requirements,
- constraints,
- expected deliverables,
- concepts being practiced,
- start attempt button.

Do not reveal an answer.

---

# 69. Design Workspace

Sections:

```text
Requirements
Classes
Interfaces
Relationships
Design Decisions
Edge Cases
Requirement Mapping
```

Save draft continuously or through explicit Save.

Submission requires validation.

---

# 70. Evaluation UX

Prioritize:

### Summary

What is working and what needs attention.

### Strengths

Concrete positive observations.

### Priority Improvements

Ordered actionable issues.

### Evidence

Where the evaluator saw the issue.

### Rationale

Why the issue matters.

### Suggested direction

Possible ways to improve, without pretending there is only one answer.

### Confidence

Optional advisory confidence.

---

# 71. Feedback Priority

Do not dump 20 comments on the learner.

Rank:

```text
P0 — Requirement violation
P1 — Major responsibility/design issue
P2 — Important improvement
P3 — Optional refinement
```

Show the highest-value improvements first.

---

# 72. Feedback Quality Rule

Every improvement should answer:

```text
What?
Where?
Why?
What could I reconsider?
```

Example:

```text
What:
Pricing logic is concentrated in ParkingLot.

Where:
ParkingLot.calculateFee()

Why:
Pricing rules may vary independently.

Reconsider:
Could pricing policy be isolated behind a strategy or policy abstraction?
```

---

# 73. Design Comparison UX

Use a side-by-side or diff view.

Show:

```text
Added
Removed
Changed
Improved
Regressed
Unchanged
```

Also compare evaluation findings.

---

# 74. Repository Structure

Recommended:

```text
designreview/
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
│   │   ├── save-draft/
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
├── knowledge/
├── evaluation-benchmark/
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
├── AI_USAGE.md
└── DESIGNREVIEW_MASTER_SPEC.md
```

This can be simplified if the monorepo overhead becomes counterproductive.

---

# 75. Technology Stack

## Frontend

```text
Next.js
React
TypeScript
Tailwind CSS
shadcn/ui
```

## Backend

```text
Next.js server/application layer
TypeScript
Zod
```

## Database

```text
PostgreSQL
Prisma
pgvector
```

## AI

```text
Configurable LLM provider
Structured output
Embedding provider
RAG
```

## Testing

```text
Vitest
Integration tests
E2E tests
Evaluation benchmark
```

## Async Processing

```text
EvaluationDispatcher
In-process implementation initially
Kafka adapter only if justified
```

---

# 76. Environment Variables

Expected configuration:

```env
DATABASE_URL=
LLM_PROVIDER=
LLM_API_KEY=
LLM_MODEL=
EMBEDDING_MODEL=
```

Optional future:

```env
KAFKA_BROKERS=
KAFKA_TOPIC_EVALUATION=
```

Never commit secrets.

---

# 77. Error Model

Use structured application errors.

Example:

```ts
class InvalidAttemptStateError extends Error {}
class SubmissionValidationError extends Error {}
class EvaluationNotFoundError extends Error {}
class EvaluationFailedError extends Error {}
class UnsupportedSubmissionFormatError extends Error {}
```

API responses should expose safe error information.

---

# 78. Observability

MVP:

- structured logs,
- evaluation execution duration,
- evaluation failure reason,
- LLM provider latency,
- retrieval latency,
- retry count.

Future:

- tracing,
- metrics dashboard,
- distributed tracing.

Do not introduce a complex observability stack without need.

---

# 79. Performance Expectations

The product is learning-focused, not latency-critical.

Targets:

- problem pages: fast server-rendered response,
- draft save: low latency,
- submit: immediate acknowledgement after persistence,
- evaluation: asynchronous,
- feedback: eventually consistent after evaluation.

The user must never wait synchronously for an LLM request before the submission is safely stored.

---

# 80. Evaluation Lifecycle

```text
POST /submit
     ↓
SUBMITTED
     ↓
EVALUATING
     ↓
+-------------+
|             |
v             v
COMPLETED    FAILED
               |
               v
             RETRY
               |
               v
          EVALUATING
```

---

# 81. Event Contracts

If events are introduced:

```text
AttemptSubmitted
EvaluationRequested
EvaluationStarted
EvaluationCompleted
EvaluationFailed
SkillProfileUpdated
RecommendationGenerated
```

Example:

```ts
type AttemptSubmitted = {
  eventId: string;
  attemptId: string;
  submissionId: string;
  occurredAt: string;
};
```

Events should represent meaningful domain facts.

---

# 82. Event Bus Rule

Do not publish events simply because event-driven architecture looks impressive.

Introduce an event only when:

- another module needs decoupling,
- processing is asynchronous,
- retry semantics benefit,
- future consumers are plausible.

---

# 83. ADRs

Create these Architecture Decision Records:

```text
ADR-001 Modular Monolith
ADR-002 Structured Design Submission
ADR-003 Hybrid Evaluation
ADR-004 LLM Provider Abstraction
ADR-005 PostgreSQL + pgvector
ADR-006 Asynchronous Evaluation
ADR-007 Evidence-Grounded Feedback
ADR-008 Evaluation Dispatcher Instead of Kafka
```

ADR-008 should explain why Kafka is intentionally deferred.

---

# 84. Research Note

Create:

```text
docs/RESEARCH.md
```

It should contain:

1. LLD learning problem.
2. Existing product landscape.
3. Existing approaches.
4. Strengths/weaknesses.
5. LLM-as-judge limitations.
6. Evidence-grounded evaluation rationale.
7. RAG rationale.
8. Product hypothesis.
9. Design implications.
10. Sources.

Do not claim that research proves DesignReview's product thesis.

---

# 85. Existing Product Landscape

Research has shown that existing tools already provide combinations of:

- LLD problem libraries,
- UML editors,
- design patterns,
- code execution,
- hidden tests,
- AI evaluation,
- design rubrics,
- Socratic assistance.

Therefore the project should not present:

> "We built an LLD platform with AI."

as its main innovation.

The stronger positioning is:

> "We built an evidence-grounded design-review loop that helps learners iteratively improve LLD designs and inspect how their reasoning changes across attempts."

---

# 86. LLM-as-Judge Limitation

AI evaluation has risks:

- inconsistency,
- verbosity bias,
- style bias,
- prompt sensitivity,
- preference for familiar patterns,
- hallucinated evidence,
- overconfidence.

Mitigations:

- deterministic checks,
- structured output,
- evidence validation,
- explicit requirements,
- problem-specific rubric,
- confidence,
- benchmark cases,
- versioned prompts/rubrics,
- valid-alternative test cases.

---

# 87. Design Review Principle

The evaluator should prefer:

```text
Requirement-driven reasoning
```

over:

```text
Pattern-driven criticism
```

For example:

Bad:

> "You didn't use Strategy, so your design is wrong."

Good:

> "Your pricing rules appear likely to vary independently. How would you isolate that variation while keeping ParkingLot focused on parking operations?"

---

# 88. Product Metrics

MVP metrics:

### Completion

Percentage of started attempts submitted.

### Evaluation reliability

Percentage of evaluations completed successfully.

### Retry recovery

Percentage of failed evaluations successfully recovered.

### Iteration

Percentage of learners making a second attempt.

### Improvement signal

Change in rubric criteria across attempts.

### Feedback interaction

Which feedback items lead to changed designs.

Do not claim these prove learning effectiveness.

They are product signals.

---

# 89. Definition of Done — MVP

The MVP is complete when a learner can:

- browse four LLD problems,
- open problem requirements,
- start an attempt,
- create structured design,
- save draft,
- submit,
- receive deterministic validation,
- receive AI evaluation,
- see evidence-grounded feedback,
- handle evaluation failure,
- retry evaluation,
- see previous attempts,
- compare two attempts,
- understand what changed.

---

# 90. Definition of Done — Engineering

Required:

- domain invariants,
- application use cases,
- repository ports,
- persistence,
- structured API validation,
- evaluator abstraction,
- LLM provider abstraction,
- evaluation dispatcher,
- deterministic checks,
- AI schema validation,
- evidence validation,
- tests,
- evaluation benchmark,
- README,
- research note,
- design note,
- AI_USAGE.md.

---

# 91. Implementation Phases

## Phase 1 — Domain Core

Build:

- Problem,
- Requirement,
- Attempt,
- Design,
- Submission,
- Evaluation,
- state transitions,
- validators.

Do not start with UI.

---

## Phase 2 — Persistence

Build:

- Prisma schema,
- PostgreSQL,
- repositories,
- seed data,
- four problems.

---

## Phase 3 — Application Layer

Implement:

```text
StartAttempt
SaveDraft
SubmitAttempt
GetEvaluation
RetryEvaluation
GetAttemptHistory
CompareAttempts
```

---

## Phase 4 — Evaluation Engine

Build:

```text
Normalizer
DeterministicValidator
RequirementAnalyzer
Evaluator
EvidenceValidator
FeedbackComposer
```

Start with a mock AI provider.

This lets the system work before connecting a real LLM.

---

## Phase 5 — LLM + RAG

Add:

- provider adapter,
- structured output,
- prompts,
- knowledge ingestion,
- embeddings,
- pgvector,
- retrieval,
- evidence validation.

---

## Phase 6 — Async Evaluation

Implement:

```text
EvaluationDispatcher
InProcessEvaluationDispatcher
```

Then:

- retry,
- failure states,
- idempotency.

Only implement Kafka if actual architecture requirements emerge.

---

## Phase 7 — Frontend

Build:

1. problem library,
2. problem detail,
3. design workspace,
4. submission,
5. evaluation,
6. history,
7. comparison.

---

## Phase 8 — Design Coach

Add:

- contextual questions,
- hints,
- relevant knowledge,
- feedback-aware coaching.

---

## Phase 9 — Benchmark + Tests

Build:

- benchmark cases,
- evaluator regression tests,
- integration tests,
- E2E flow,
- retry/failure tests.

---

## Phase 10 — Documentation + Polish

Finish:

- README,
- RESEARCH,
- ARCHITECTURE,
- DOMAIN_MODEL,
- EVALUATION,
- ADRs,
- AI_USAGE,
- screenshots,
- demo flow.

---

# 92. Implementation Order Within Code

The preferred sequence is:

```text
Types
  ↓
Domain
  ↓
Domain Tests
  ↓
Application Ports
  ↓
Use Cases
  ↓
Application Tests
  ↓
Persistence Adapters
  ↓
Integration Tests
  ↓
Evaluation Engine
  ↓
Mock Evaluation
  ↓
LLM Adapter
  ↓
RAG
  ↓
Async Dispatcher
  ↓
API
  ↓
UI
  ↓
Comparison
  ↓
Coach
  ↓
Benchmark
```

This avoids building a beautiful UI over unstable domain logic.

---

# 93. Senior Engineering Review Checklist

Before calling the project complete, verify:

## Domain

- Are invariants explicit?
- Are state transitions enforced centrally?
- Are entities responsible for their own rules?
- Are invalid states impossible or rejected?

## Architecture

- Does domain avoid infrastructure dependencies?
- Are external providers behind ports?
- Can LLM provider change without rewriting evaluation?
- Can submission format change without rewriting application logic?

## Evaluation

- Are deterministic checks separated from AI judgment?
- Is feedback grounded in evidence?
- Are valid alternative designs accepted?
- Are prompts/rubrics versioned?
- Is failure recoverable?

## Product

- Does feedback answer what/where/why?
- Can learner compare attempts?
- Is the next action obvious?
- Does the platform help iteration rather than only scoring?

## Testing

- Are domain invariants tested?
- Are evaluation failures tested?
- Are valid alternatives tested?
- Is AI output schema validated?
- Is the complete learner loop tested?

---

# 94. Things That Should Impress the Evaluator

The project should demonstrate:

### Product judgment

Knowing what NOT to build.

### Domain modelling

Clear entities, invariants, state transitions.

### Extensibility

Evaluator and submission format abstractions.

### AI engineering

Structured output, evidence grounding, RAG, provider abstraction.

### Reliability

Persistence-before-evaluation, retry, idempotency, failure state.

### Testing

Deterministic domain tests + AI benchmark.

### Learning design

Attempt comparison and actionable feedback.

The goal is not maximum technology count.

The goal is maximum **justified engineering depth**.

---

# 95. Things That Should NOT Be Added for Show

Avoid:

```text
Kubernetes
Microservices
Service mesh
Kafka cluster
Redis cluster
GraphQL
Event sourcing
CQRS everywhere
Multi-region
Multiple databases
Full UML drawing engine
Complex auth
Blockchain
Generic agent swarm
```

unless a genuine requirement emerges.

Architecture should be defensible in an interview.

---

# 96. Interview Explanation

A concise explanation:

> "DesignReview is a modular-monolith LLD practice platform focused on design evolution rather than one-shot scoring. Learners submit a structured design, which is first checked deterministically and then evaluated by a rubric-aware AI evaluator. The evaluator must ground substantive feedback in evidence from the learner's own design, and it evaluates against requirements rather than a canonical solution. Submissions are persisted before asynchronous evaluation, with retry and failure handling. We also preserve attempts so learners can compare how their responsibilities, abstractions, and relationships changed over time. The architecture uses ports for evaluators, LLM providers, retrieval, persistence, and dispatching so those infrastructure choices can evolve without contaminating the domain model."

---

# 97. Final Architectural Diagram

```text
                         ┌─────────────────────┐
                         │      Next.js UI     │
                         │ Problem / Workspace │
                         │ Feedback / Compare  │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ Application Layer   │
                         │                     │
                         │ StartAttempt        │
                         │ SaveDraft           │
                         │ SubmitAttempt       │
                         │ RetryEvaluation     │
                         │ CompareAttempts     │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │    Domain Layer     │
                         │                     │
                         │ Problem             │
                         │ Attempt             │
                         │ Design              │
                         │ Submission          │
                         │ Evaluation          │
                         │ Feedback            │
                         └──────────┬──────────┘
                                    │
                              Ports │
                 ┌──────────────────┼──────────────────┐
                 │                  │                  │
                 ▼                  ▼                  ▼
        ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
        │ Persistence    │ │ Evaluation     │ │ AI / RAG       │
        │ Adapter        │ │ Dispatcher     │ │ Adapters       │
        │                │ │                │ │                │
        │ Prisma         │ │ In Process    │ │ LLM Provider   │
        │ PostgreSQL     │ │ Future Kafka   │ │ pgvector       │
        └────────────────┘ └───────┬────────┘ └────────────────┘
                                   │
                                   ▼
                         ┌─────────────────────┐
                         │ Evaluation Engine   │
                         │                     │
                         │ Deterministic       │
                         │ Requirement         │
                         │ AI Evaluation       │
                         │ Evidence Validation │
                         │ Feedback Composition │
                         └─────────────────────┘
```

---

# 98. Final Product Loop

```text
┌──────────────┐
│ Choose       │
│ Problem      │
└──────┬───────┘
       ↓
┌──────────────┐
│ Understand   │
│ Requirements │
└──────┬───────┘
       ↓
┌──────────────┐
│ Design       │
│ Structured   │
└──────┬───────┘
       ↓
┌──────────────┐
│ Submit       │
└──────┬───────┘
       ↓
┌──────────────┐
│ Evaluate     │
│ Hybrid       │
└──────┬───────┘
       ↓
┌──────────────┐
│ Evidence-    │
│ Grounded     │
│ Feedback     │
└──────┬───────┘
       ↓
┌──────────────┐
│ Refine       │
│ Design       │
└──────┬───────┘
       ↓
┌──────────────┐
│ Compare      │
│ Attempts     │
└──────┬───────┘
       ↓
┌──────────────┐
│ Practice     │
│ Next Problem │
└──────────────┘
       │
       └──────────────→ Repeat
```

---

# 99. Final Decision Summary

| Decision | Choice | Reason |
|---|---|---|
| Product | DesignReview | Focuses on review + iteration |
| Architecture | Modular monolith | Strong boundaries without unnecessary ops |
| Domain | LLD design practice | Matches assignment |
| Submission | Structured design | Machine-evaluable + comparable |
| Evaluation | Hybrid | Deterministic facts + AI judgment |
| AI feedback | Evidence-grounded | Reduces unsupported criticism |
| Reference answer | No canonical matching | Allows valid alternatives |
| RAG | Yes, scoped | Ground engineering knowledge |
| Vector DB | PostgreSQL + pgvector | Avoids unnecessary infrastructure |
| Async | Dispatcher abstraction | Reliable without premature Kafka |
| Kafka | Deferred | No MVP requirement |
| Code execution | Deferred | Security/complexity not justified |
| UML editor | Deferred | Structured model is sufficient initially |
| Attempt comparison | Core feature | Supports design evolution |
| Skill profile | P1 | Useful after sufficient attempt data |
| Coach | P1 | Extends feedback into guided learning |
| Problem count | 4 initially | Depth over breadth |
| LLM score | Secondary | Feedback should dominate UX |

---

# 100. Immediate Next Step

The specification is now implementation-ready.

Implementation should begin with:

```text
1. Repository initialization
2. TypeScript configuration
3. Domain package
4. Domain entities
5. State machine
6. Design validators
7. Domain tests
8. Application ports
9. Use-case contracts
10. Prisma schema
```

Do not start by building the dashboard.

Build the **domain and evaluation contracts first**.

The first coding milestone is:

> **A fully tested domain/application core that can create a problem, start an attempt, construct a structured design, validate it, submit it, and represent the evaluation lifecycle without any UI or LLM dependency.**

That becomes the foundation for everything else.
