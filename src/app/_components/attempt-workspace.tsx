"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Link2,
  LoaderCircle,
  Save,
  SearchCheck,
  Send,
  TriangleAlert,
} from "lucide-react";
import type { AttemptStatus } from "@/domain/attempt/attempt-status";
import type { EvaluationStatus } from "@/domain/evaluation/evaluation-status";
import type { StructuredDesign } from "@/domain/design/structured-design";
import type { ProblemResponse } from "@/presentation/api/dto";
import { postJson, putJson } from "./api-client";
import { DesignEditor } from "./design-editor";
import { AttemptStatusPill, EvaluationStatusPill } from "./status-pill";

interface DraftIssue {
  readonly path: string;
  readonly message: string;
  readonly severity?: string;
}

export interface AttemptWorkspaceProps {
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly status: AttemptStatus;
  readonly evaluationStatus: EvaluationStatus | null;
  readonly problem: ProblemResponse;
  readonly design: StructuredDesign | null;
}

type Busy = null | "save" | "submit" | "evaluate";

/**
 * The learner's working screen.
 *
 * It holds the edited design in local state and talks to the API for everything that
 * changes the world: saving the draft, submitting, and asking for a review. It never
 * decides whether a design is submittable — it shows what the server said.
 */
export function AttemptWorkspace({
  attemptId,
  attemptNumber,
  status,
  evaluationStatus,
  problem,
  design,
}: AttemptWorkspaceProps) {
  const router = useRouter();
  const [current, setCurrent] = useState<StructuredDesign | null>(design);
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<
    null | { readonly kind: "good" | "bad" | "warn"; readonly text: string }
  >(null);
  const [issues, setIssues] = useState<readonly DraftIssue[]>([]);

  const editable = status === "IN_PROGRESS";

  /*
   * Coverage is read off the design being edited rather than fetched: it is the one
   * piece of feedback a learner wants continuously while writing, and a round trip
   * per keystroke would be a poor trade for a count the client can already see.
   */
  const requirementIds = new Set(
    problem.requirements.map((requirement) => requirement.id),
  );
  const mapped = new Set(
    (current?.requirementMappings ?? [])
      .filter(
        (mapping) =>
          mapping.references.length > 0 &&
          // A draft can carry a mapping for a requirement this problem no longer
          // has; counting it would report more coverage than there is to cover.
          requirementIds.has(mapping.requirementId),
      )
      .map((mapping) => mapping.requirementId),
  );

  async function saveDraft(): Promise<void> {
    if (current === null) return;
    setBusy("save");
    setMessage(null);

    const result = await putJson<{ readonly issues: readonly DraftIssue[] }>(
      `/api/attempts/${attemptId}/draft`,
      { design: current },
    );
    setBusy(null);

    if (!result.ok) {
      setIssues(result.issues);
      setMessage({ kind: "bad", text: result.message });
      return;
    }

    setIssues(result.data.issues);
    const blocking = result.data.issues.filter(
      (issue) => issue.severity === "ERROR",
    );
    setMessage(
      blocking.length === 0
        ? { kind: "good", text: "Draft saved. Nothing is blocking a submission." }
        : {
            kind: "warn",
            text: `Draft saved. ${blocking.length} ${blocking.length === 1 ? "thing" : "things"} would block a submission.`,
          },
    );
  }

  async function submit(): Promise<void> {
    if (current === null) return;
    setBusy("submit");
    setMessage(null);

    const result = await postJson(`/api/attempts/${attemptId}/submissions`, {
      design: current,
    });
    setBusy(null);

    if (!result.ok) {
      setIssues(result.issues);
      setMessage({ kind: "bad", text: result.message });
      return;
    }

    setIssues([]);
    setMessage({ kind: "good", text: "Submitted. Run the review when you are ready." });
    router.refresh();
  }

  async function evaluate(): Promise<void> {
    setBusy("evaluate");
    setMessage(null);

    const result = await postJson<{ readonly status: EvaluationStatus }>(
      `/api/attempts/${attemptId}/evaluate`,
    );
    setBusy(null);

    if (!result.ok) {
      setMessage({ kind: "bad", text: result.message });
      router.refresh();
      return;
    }

    router.push(`/attempts/${attemptId}/review`);
  }

  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/problems">Problems</Link>
        <ChevronRight size={13} strokeWidth={2} aria-hidden="true" />
        <Link href={`/problems/${problem.slug}`}>{problem.title}</Link>
        <ChevronRight size={13} strokeWidth={2} aria-hidden="true" />
        <span aria-current="page">Attempt {attemptNumber}</span>
      </nav>

      <div className="page-head">
        <div>
          <h1>{problem.title}</h1>
          <p className="lede">
            {editable
              ? "Write the design, save as often as you like, and submit when it says what you mean."
              : "This attempt is submitted, so the design is frozen exactly as it was reviewed."}
          </p>
        </div>
        <div className="head-actions">
          <AttemptStatusPill status={status} />
          <EvaluationStatusPill status={evaluationStatus} />
        </div>
      </div>

      <div className="split">
        <div>
          {!editable && (
            <div className="banner spaced">
              <CircleAlert aria-hidden="true" />
              <div className="banner-body">
                <span>
                  <strong>Read-only.</strong> Submitting freezes a design so the
                  review and the design it reviewed cannot drift apart. Start another
                  attempt on this problem to iterate — earlier attempts are kept.
                </span>
              </div>
            </div>
          )}

          {issues.length > 0 && (
            <div className="banner banner-attention spaced" role="status">
              <TriangleAlert aria-hidden="true" />
              <div className="banner-body">
                <strong>
                  {issues.length} {issues.length === 1 ? "issue" : "issues"} the server
                  found
                </strong>
                <ul className="checklist">
                  {issues.map((issue) => (
                    <li key={`${issue.path}:${issue.message}`}>
                      <code>{issue.path}</code>
                      <span>{issue.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <DesignEditor
            design={current}
            requirements={problem.requirements}
            disabled={!editable}
            onChange={setCurrent}
          />

          <div className="actionbar">
            <p className="actionbar-status" role="status" aria-live="polite">
              {busy === "save" && (
                <>
                  <LoaderCircle className="spin" aria-hidden="true" />
                  Saving…
                </>
              )}
              {busy === "submit" && (
                <>
                  <LoaderCircle className="spin" aria-hidden="true" />
                  Submitting…
                </>
              )}
              {busy === "evaluate" && (
                <>
                  <LoaderCircle className="spin" aria-hidden="true" />
                  Reviewing your design. This checks structure, requirement coverage
                  and design quality.
                </>
              )}
              {busy === null && message !== null && (
                <span
                  className={
                    message.kind === "good"
                      ? "actionbar-status status-ok"
                      : message.kind === "bad"
                        ? "actionbar-status status-danger"
                        : "actionbar-status"
                  }
                >
                  {message.kind === "good" ? (
                    <CircleCheck aria-hidden="true" />
                  ) : message.kind === "bad" ? (
                    <CircleAlert aria-hidden="true" />
                  ) : (
                    <TriangleAlert aria-hidden="true" />
                  )}
                  {message.text}
                </span>
              )}
              {busy === null && message === null && editable && (
                <span className="section-note">
                  {mapped.size} of {problem.requirements.length} requirements mapped
                </span>
              )}
            </p>

            <div className="btn-row">
              {editable ? (
                <>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void saveDraft()}
                    disabled={busy !== null}
                  >
                    <Save aria-hidden="true" />
                    Save draft
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void submit()}
                    disabled={busy !== null}
                  >
                    <Send aria-hidden="true" />
                    Submit design
                  </button>
                </>
              ) : (
                <>
                  <Link href={`/problems/${problem.slug}`} className="btn">
                    Start another attempt
                  </Link>
                  {evaluationStatus === "COMPLETED" ? (
                    <Link
                      href={`/attempts/${attemptId}/review`}
                      className="btn btn-primary"
                    >
                      Open the review
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void evaluate()}
                      disabled={busy !== null}
                    >
                      <SearchCheck aria-hidden="true" />
                      Run the review
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <aside className="rail">
          <div className="panel">
            <div className="panel-head">
              <h3>
                <Link2 size={15} strokeWidth={1.75} aria-hidden="true" />
                Requirement coverage
              </h3>
              <span className="section-note tabular">
                {mapped.size}/{problem.requirements.length}
              </span>
            </div>
            <div className="panel-body tight">
              <div
                className="meter"
                role="img"
                aria-label={`${mapped.size} of ${problem.requirements.length} requirements mapped`}
              >
                <span
                  style={{
                    transform: `scaleX(${problem.requirements.length === 0 ? 0 : mapped.size / problem.requirements.length})`,
                  }}
                />
              </div>
              <ul className="checklist">
                {problem.requirements.map((requirement) => {
                  const isMapped = mapped.has(requirement.id);
                  return (
                    <li
                      key={requirement.id}
                      className={isMapped ? "is-mapped" : "is-unmapped"}
                    >
                      {isMapped ? (
                        <Check aria-hidden="true" />
                      ) : (
                        <CircleDashed aria-hidden="true" />
                      )}
                      <span>
                        <code>{requirement.code}</code> {requirement.title}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3>What a review can say</h3>
            </div>
            <div className="panel-body">
              <p className="section-note">
                Structural checks are facts about the submission. The design review is
                a judgement, and every concern it raises has to quote your own design.
                Neither compares your design to a model answer.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
