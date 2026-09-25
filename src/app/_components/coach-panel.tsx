"use client";

import { useState } from "react";
import {
  BookOpen,
  Check,
  CircleAlert,
  CircleHelp,
  LoaderCircle,
  MessagesSquare,
  Send,
} from "lucide-react";
import { READABLE_CRITERION } from "@/app/_components/criterion-labels";
import { EvidenceBlock } from "@/app/_components/evidence-block";
import { postJson } from "./api-client";
import type { CoachAnswerResponse } from "@/presentation/api/coach-dto";

// Mirrors MAX_QUESTION_LENGTH in ask-design-coach.ts — a client-side cap only;
// the server is the actual authority and re-checks this on every request.
const MAX_QUESTION_LENGTH = 500;

export interface CoachPanelProps {
  readonly attemptId: string;
}

/**
 * A focused question-and-answer panel scoped to this one attempt — not a
 * conversation history, not a general assistant. Each question is answered
 * from scratch, grounded in the current design, the current evaluation and
 * retrieved knowledge; asking again replaces the answer rather than adding to
 * a transcript, which is the shape a stateless coach actually has.
 */
export function CoachPanel({ attemptId }: CoachPanelProps) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<CoachAnswerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask(): Promise<void> {
    const trimmed = question.trim();
    if (trimmed.length === 0 || busy) {
      return;
    }
    setBusy(true);
    setError(null);

    const result = await postJson<CoachAnswerResponse>(
      `/api/attempts/${attemptId}/coach`,
      { question: trimmed },
    );

    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setAnswer(result.data);
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>
          <MessagesSquare size={15} strokeWidth={1.75} aria-hidden="true" />
          Design coach
        </h3>
      </div>
      <div className="panel-body">
        <div className="field">
          <label htmlFor="coach-question">Ask about this design</label>
          <textarea
            id="coach-question"
            rows={2}
            value={question}
            maxLength={MAX_QUESTION_LENGTH}
            disabled={busy}
            placeholder="Why is PaymentService highly coupled?"
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void ask();
              }
            }}
          />
          <span className="field-hint">
            Answered from your current design, your evaluation if one has run, and
            relevant design knowledge — never a reference solution.
          </span>
        </div>

        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || question.trim().length === 0}
            onClick={() => void ask()}
          >
            {busy ? (
              <LoaderCircle className="spin" aria-hidden="true" />
            ) : (
              <Send aria-hidden="true" />
            )}
            {busy ? "Thinking…" : "Ask"}
          </button>
        </div>

        {busy && (
          <p className="section-note" role="status" aria-live="polite">
            Reading your design, your evaluation and relevant design guidance…
          </p>
        )}

        {error !== null && (
          <div className="banner banner-danger" role="alert">
            <CircleAlert aria-hidden="true" />
            <div className="banner-body">
              <strong>The coach couldn't answer that</strong>
              <span>{error}</span>
              <div className="btn-row">
                <button type="button" className="btn btn-small" onClick={() => void ask()}>
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {!busy && error === null && answer === null && (
          <p className="section-note">
            Ask a question about your design — a specific class, a relationship, or
            why the evaluator raised something.
          </p>
        )}

        {answer !== null && <CoachAnswerCard answer={answer} />}
      </div>
    </section>
  );
}

function CoachAnswerCard({ answer }: { readonly answer: CoachAnswerResponse }) {
  const isUncertain = answer.certainty !== "SUFFICIENT_CONTEXT";

  return (
    <article className="finding">
      <div className="finding-head">
        <div className="finding-title">
          <span>{answer.answer}</span>
        </div>
        {isUncertain && (
          <span className="chip chip-attention">
            <CircleHelp size={13} strokeWidth={2} aria-hidden="true" />
            {answer.certainty === "AMBIGUOUS" ? "Needs clarification" : "Limited context"}
          </span>
        )}
      </div>
      <div className="finding-body">
        {answer.followUpQuestion !== undefined && (
          <div className="finding-block">
            <h4>The coach is asking</h4>
            <p>{answer.followUpQuestion}</p>
          </div>
        )}

        {answer.observations.length > 0 && (
          <div className="finding-block">
            <h4>Observed in your design</h4>
            <ul className="strengths">
              {answer.observations.map((observation) => (
                <li key={observation.text}>
                  <Check strokeWidth={2.25} aria-hidden="true" />
                  <span>
                    {observation.text}
                    <EvidenceBlock evidence={observation.evidence} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {answer.recommendation !== undefined && (
          <div className="finding-block">
            <h4>Possible direction</h4>
            <p>{answer.recommendation.suggestion}</p>
            <p className="section-note">{answer.recommendation.rationale}</p>
          </div>
        )}

        {answer.evaluationReferences.length > 0 && (
          <div className="finding-block">
            <h4>From your evaluation</h4>
            <div className="btn-row">
              {answer.evaluationReferences.map((reference) => (
                <span className="chip" key={reference.criterion}>
                  {READABLE_CRITERION[reference.criterion] ?? reference.criterion}
                </span>
              ))}
            </div>
          </div>
        )}

        {answer.knowledgeCitations.length > 0 && (
          <details className="grounding">
            <summary>
              <BookOpen aria-hidden="true" />
              Grounded in {answer.knowledgeCitations.length}{" "}
              {answer.knowledgeCitations.length === 1 ? "principle" : "principles"}
            </summary>
            <div className="grounding-body">
              {answer.knowledgeCitations.map((citation) => (
                <span className="chip" key={citation.ref}>
                  {citation.title}
                </span>
              ))}
            </div>
          </details>
        )}
      </div>
    </article>
  );
}
