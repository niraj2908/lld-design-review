import { assertEvaluationTransition } from "./evaluation-status";
import type { EvaluationStatus } from "./evaluation-status";
import type {
  EvaluationFailure,
  EvaluationOutcome,
} from "./evaluation-outcome";
import type { EvaluationVersions } from "./evaluation-versions";

export interface EvaluationSnapshot {
  readonly id: string;
  readonly submissionId: string;
  readonly status: EvaluationStatus;
  readonly versions: EvaluationVersions;
  readonly idempotencyKey: string;
  readonly attemptCount: number;
  readonly outcome: EvaluationOutcome | null;
  readonly failure: EvaluationFailure | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
}

/**
 * The evaluation lifecycle is modelled separately from the attempt because the
 * two fail independently: a failed evaluation must never invalidate the
 * submission it was run against.
 */
export class Evaluation {
  private constructor(private state: EvaluationSnapshot) {}

  static request(input: {
    readonly id: string;
    readonly submissionId: string;
    readonly versions: EvaluationVersions;
    readonly idempotencyKey: string;
    readonly now: Date;
  }): Evaluation {
    return new Evaluation({
      id: input.id,
      submissionId: input.submissionId,
      status: "PENDING",
      versions: input.versions,
      idempotencyKey: input.idempotencyKey,
      attemptCount: 0,
      outcome: null,
      failure: null,
      createdAt: input.now,
      updatedAt: input.now,
      startedAt: null,
      completedAt: null,
    });
  }

  static restore(snapshot: EvaluationSnapshot): Evaluation {
    return new Evaluation({ ...snapshot });
  }

  get id(): string {
    return this.state.id;
  }

  get submissionId(): string {
    return this.state.submissionId;
  }

  get status(): EvaluationStatus {
    return this.state.status;
  }

  get versions(): EvaluationVersions {
    return this.state.versions;
  }

  get idempotencyKey(): string {
    return this.state.idempotencyKey;
  }

  get attemptCount(): number {
    return this.state.attemptCount;
  }

  get outcome(): EvaluationOutcome | null {
    return this.state.outcome;
  }

  get failure(): EvaluationFailure | null {
    return this.state.failure;
  }

  get startedAt(): Date | null {
    return this.state.startedAt;
  }

  get completedAt(): Date | null {
    return this.state.completedAt;
  }

  /** Covers both the first run and a retry after failure. */
  start(now: Date): void {
    assertEvaluationTransition(this.state.id, this.state.status, "EVALUATING");
    this.state = {
      ...this.state,
      status: "EVALUATING",
      attemptCount: this.state.attemptCount + 1,
      failure: null,
      startedAt: now,
      updatedAt: now,
    };
  }

  /**
   * Records the outcome, and with it the knowledge provenance the run discovered.
   *
   * Which documents were retrieved and which embedding model found them are not
   * knowable when the evaluation is requested — only after it has run — so they are
   * folded into the recorded versions here rather than guessed up front.
   */
  complete(outcome: EvaluationOutcome, now: Date): void {
    assertEvaluationTransition(this.state.id, this.state.status, "COMPLETED");
    this.state = {
      ...this.state,
      status: "COMPLETED",
      outcome,
      versions: withKnowledgeProvenance(this.state.versions, outcome),
      failure: null,
      completedAt: now,
      updatedAt: now,
    };
  }

  fail(failure: EvaluationFailure, now: Date): void {
    assertEvaluationTransition(this.state.id, this.state.status, "FAILED");
    this.state = {
      ...this.state,
      status: "FAILED",
      failure,
      completedAt: now,
      updatedAt: now,
    };
  }

  toSnapshot(): EvaluationSnapshot {
    return { ...this.state };
  }
}

function withKnowledgeProvenance(
  versions: EvaluationVersions,
  outcome: EvaluationOutcome,
): EvaluationVersions {
  const citations = outcome.knowledgeCitations ?? [];
  if (citations.length === 0) {
    return versions;
  }

  const documentVersions = [
    ...new Set(citations.map((citation) => citation.documentVersion)),
  ].toSorted();
  const embeddingModels = [
    ...new Set(citations.map((citation) => citation.embeddingModel)),
  ].toSorted();

  return {
    ...versions,
    knowledgeVersion: documentVersions.join("+"),
    ...(embeddingModels.length === 0
      ? {}
      : { embeddingModel: embeddingModels.join("+") }),
  };
}
