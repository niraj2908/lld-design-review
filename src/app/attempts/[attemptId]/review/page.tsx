import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  FileText,
  MessageSquareText,
  SearchCheck,
  TriangleAlert,
} from "lucide-react";
import { RetryEvaluationButton } from "@/app/_components/retry-evaluation-button";
import { AttemptStatusPill, EvaluationStatusPill } from "@/app/_components/status-pill";
import { READABLE_CRITERION } from "@/app/_components/criterion-labels";
import { EvidenceBlock } from "@/app/_components/evidence-block";
import { CoachPanel } from "@/app/_components/coach-panel";
import type {
  CriterionResultResponse,
  FeedbackItemResponse,
} from "@/presentation/api/dto";
import { readAttemptReview } from "@/presentation/server/read-model";

export const dynamic = "force-dynamic";

const PASSING = new Set(["STRONG", "ADEQUATE"]);

export default async function ReviewPage({
  params,
}: {
  readonly params: Promise<{ readonly attemptId: string }>;
}) {
  const { attemptId } = await params;
  const review = await readAttemptReview(attemptId);

  if (review === null) {
    notFound();
  }

  const { attempt, problem, evaluation } = review;
  const outcome = evaluation?.outcome ?? null;
  const structural = (outcome?.criterionResults ?? []).filter(
    (result) => result.nature === "FACTUAL",
  );
  const judgements = (outcome?.criterionResults ?? []).filter(
    (result) => result.nature === "SEMANTIC",
  );

  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/attempts">My attempts</Link>
        <ChevronRight size={13} strokeWidth={2} aria-hidden="true" />
        <Link href={`/attempts/${attempt.id}`}>
          {problem.title} · attempt {attempt.attemptNumber}
        </Link>
        <ChevronRight size={13} strokeWidth={2} aria-hidden="true" />
        <span aria-current="page">Review</span>
      </nav>

      <div className="page-head">
        <div>
          <h1>Design review</h1>
          <p className="lede">
            {problem.title} · attempt {attempt.attemptNumber}
          </p>
        </div>
        <div className="head-actions">
          <AttemptStatusPill status={attempt.status} />
          <EvaluationStatusPill status={evaluation?.status ?? null} />
        </div>
      </div>

      <CoachPanel attemptId={attempt.id} />

      {evaluation === null && (
        <div className="empty">
          <span className="empty-icon">
            <SearchCheck size={17} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h3>This attempt has not been reviewed yet</h3>
          <p>
            Open the attempt and run the review. It checks structure, requirement
            coverage and design quality against what you submitted.
          </p>
          <Link href={`/attempts/${attempt.id}`} className="btn btn-primary">
            Open the attempt
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      )}

      {evaluation !== null && evaluation.status === "FAILED" && (
        <div className="banner banner-danger">
          <CircleAlert aria-hidden="true" />
          <div className="banner-body">
            <strong>The review could not be completed</strong>
            <span>
              {evaluation.failure === null
                ? "The reviewer stopped before it produced a result."
                : evaluation.failure.message}{" "}
              Your submitted design is saved and unchanged.
            </span>
            <RetryEvaluationButton attemptId={attempt.id} />
          </div>
        </div>
      )}

      {evaluation !== null && outcome !== null && (
        <div className="split">
          <div>
            <section className="section flush">
              <div className="section-head">
                <h2>Overall assessment</h2>
              </div>
              <p className="prose soft">
                {outcome.summary}
              </p>
            </section>

            {outcome.strengths.length > 0 && (
              <section className="section">
                <div className="section-head">
                  <h2>Strengths</h2>
                </div>
                <ul className="strengths">
                  {outcome.strengths.map((strength) => (
                    <li key={strength}>
                      <Check strokeWidth={2.25} aria-hidden="true" />
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="section" id="improvements">
              <div className="section-head">
                <h2>
                  <MessageSquareText size={18} strokeWidth={1.75} aria-hidden="true" />
                  Priority improvements
                </h2>
                <span className="section-note tabular">
                  {outcome.priorityImprovements.length}
                </span>
              </div>

              {outcome.priorityImprovements.length === 0 ? (
                <div className="banner banner-ok">
                  <CircleCheck aria-hidden="true" />
                  <div className="banner-body">
                    <span>
                      Nothing is blocking this design, and no improvement was raised
                      that could be grounded in what you submitted.
                    </span>
                  </div>
                </div>
              ) : (
                outcome.priorityImprovements.map((item, index) => (
                  <Improvement key={item.id} item={item} index={index + 1} />
                ))
              )}
            </section>

            {structural.length > 0 && (
              <section className="section" id="structural">
                <div className="section-head">
                  <h2>
                    <FileText size={18} strokeWidth={1.75} aria-hidden="true" />
                    Structural checks
                  </h2>
                  <span className="section-note">
                    Facts you can verify in your own submission
                  </span>
                </div>
                <div className="panel">
                  <div className="checks">
                    {structural.map((result) => (
                      <div
                        key={result.criterion}
                        className={
                          PASSING.has(result.assessment)
                            ? "check check-pass"
                            : "check check-fail"
                        }
                      >
                        {PASSING.has(result.assessment) ? (
                          <CircleCheck aria-hidden="true" />
                        ) : (
                          <TriangleAlert aria-hidden="true" />
                        )}
                        <div className="banner-body">
                          <span className="check-name">
                            {READABLE_CRITERION[result.criterion] ?? result.criterion}
                          </span>
                          {result.concern !== undefined && (
                            <span className="check-detail">{result.concern}</span>
                          )}
                          {result.evidence.length > 0 && (
                            <EvidenceBlock evidence={result.evidence} />
                          )}
                        </div>
                        <span className="chip">
                          {result.assessment.toLowerCase().replaceAll("_", " ")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {judgements.length > 0 && (
              <section className="section" id="judgements">
                <div className="section-head">
                  <h2>
                    <SearchCheck size={18} strokeWidth={1.75} aria-hidden="true" />
                    Design judgements
                  </h2>
                  <span className="section-note">
                    Each one carries the evidence it rests on
                  </span>
                </div>
                {judgements.map((result) => (
                  <Judgement key={result.criterion} result={result} />
                ))}
              </section>
            )}
          </div>

          <aside className="rail">
            <div className="panel">
              <div className="panel-head">
                <h3>On this page</h3>
              </div>
              <div className="panel-body tight">
                <nav className="rail-nav" aria-label="Review sections">
                  <a href="#improvements">
                    <MessageSquareText aria-hidden="true" />
                    Priority improvements
                    <span className="rail-count tabular">
                      {outcome.priorityImprovements.length}
                    </span>
                  </a>
                  {structural.length > 0 && (
                    <a href="#structural">
                      <FileText aria-hidden="true" />
                      Structural checks
                      <span className="rail-count tabular">{structural.length}</span>
                    </a>
                  )}
                  {judgements.length > 0 && (
                    <a href="#judgements">
                      <SearchCheck aria-hidden="true" />
                      Design judgements
                      <span className="rail-count tabular">{judgements.length}</span>
                    </a>
                  )}
                </nav>
              </div>
            </div>

            {outcome.knowledgeCitations.length > 0 && (
              <details className="grounding">
                <summary>
                  <BookOpen aria-hidden="true" />
                  Grounded in {outcome.knowledgeCitations.length} design principles
                </summary>
                <div className="grounding-body">
                  {outcome.knowledgeCitations.map((citation) => (
                    <span className="chip" key={citation.ref}>
                      {citation.title}
                    </span>
                  ))}
                </div>
              </details>
            )}

            <div className="panel">
              <div className="panel-head">
                <h3>What produced this review</h3>
              </div>
              <div className="panel-body">
                <dl className="meta-list">
                  <dt>Evaluator</dt>
                  <dd>{evaluation.versions.evaluator}</dd>
                  <dt>Rubric</dt>
                  <dd>{evaluation.versions.rubric}</dd>
                  <dt>Prompt</dt>
                  <dd>{evaluation.versions.prompt}</dd>
                  <dt>Knowledge</dt>
                  <dd>{evaluation.versions.knowledge}</dd>
                  {evaluation.versions.model !== undefined && (
                    <>
                      <dt>Model</dt>
                      <dd>{evaluation.versions.model}</dd>
                    </>
                  )}
                </dl>
              </div>
            </div>

            <div className="btn-row">
              <Link href={`/problems/${problem.slug}`} className="btn btn-primary">
                Try this problem again
              </Link>
              <Link href={`/attempts/${attempt.id}`} className="btn">
                See what you submitted
              </Link>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function Improvement({
  item,
  index,
}: {
  readonly item: FeedbackItemResponse;
  readonly index: number;
}) {
  return (
    <article className="finding">
      <div className="finding-head">
        <div className="finding-title">
          <span className="finding-index" aria-hidden="true">
            {index}
          </span>
          <span>{item.what}</span>
        </div>
        <div className="head-actions">
          <span className="chip chip-mono">{item.priority}</span>
          <span className={item.nature === "FACTUAL" ? "chip" : "chip chip-accent"}>
            {item.nature === "FACTUAL" ? "Structural" : "Judgement"}
          </span>
        </div>
      </div>
      <div className="finding-body">
        <div className="finding-block">
          <h4>Why it matters</h4>
          <p>{item.why}</p>
        </div>
        {item.where.length > 0 && (
          <div className="finding-block">
            <h4>In your design</h4>
            <EvidenceBlock evidence={item.where} />
          </div>
        )}
        {item.reconsider !== undefined && (
          <div className="finding-block">
            <h4>Suggested improvement</h4>
            <p>{item.reconsider}</p>
          </div>
        )}
      </div>
    </article>
  );
}

function Judgement({ result }: { readonly result: CriterionResultResponse }) {
  return (
    <article className="finding">
      <div className="finding-head">
        <div className="finding-title">
          <span>{READABLE_CRITERION[result.criterion] ?? result.criterion}</span>
        </div>
        <div className="head-actions">
          {result.confidence !== undefined && (
            <span className="chip chip-mono">
              confidence {Math.round(result.confidence * 100)}%
            </span>
          )}
          <span
            className={
              PASSING.has(result.assessment) ? "chip chip-ok" : "chip chip-attention"
            }
          >
            {result.assessment.toLowerCase().replaceAll("_", " ")}
          </span>
        </div>
      </div>
      <div className="finding-body indent-flush">
        {result.concern !== undefined && (
          <div className="finding-block">
            <h4>Concern</h4>
            <p>{result.concern}</p>
          </div>
        )}
        {result.evidence.length > 0 && (
          <div className="finding-block">
            <h4>Evidence</h4>
            <EvidenceBlock evidence={result.evidence} />
          </div>
        )}
        {result.suggestion !== undefined && (
          <div className="finding-block">
            <h4>Suggested direction</h4>
            <p>{result.suggestion}</p>
          </div>
        )}
        {result.unverifiedEvidenceCount !== undefined && (
          <p className="section-note">
            {result.unverifiedEvidenceCount}{" "}
            {result.unverifiedEvidenceCount === 1 ? "reference" : "references"} in this
            assessment could not be found in your submission and were discarded.
          </p>
        )}
      </div>
    </article>
  );
}
