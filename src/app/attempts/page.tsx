import Link from "next/link";
import { GitCompare, History, LayoutList } from "lucide-react";
import { readAttempts } from "@/presentation/server/read-model";
import { AttemptStatusPill, EvaluationStatusPill } from "@/app/_components/status-pill";
import { AttemptComparisonPicker } from "@/app/_components/attempt-comparison-picker";
import { formatMoment } from "@/app/_components/formatting";

export const dynamic = "force-dynamic";

export default async function AttemptsPage() {
  const attempts = await readAttempts();

  const byProblem = new Map<
    string,
    { readonly problemTitle: string; readonly attempts: typeof attempts }
  >();
  for (const attempt of attempts) {
    const group = byProblem.get(attempt.problemId);
    if (group === undefined) {
      byProblem.set(attempt.problemId, {
        problemTitle: attempt.problemTitle,
        attempts: [attempt],
      });
    } else {
      byProblem.set(attempt.problemId, {
        ...group,
        attempts: [...group.attempts, attempt],
      });
    }
  }
  const comparableGroups = [...byProblem.entries()]
    .filter(([, group]) => group.attempts.length >= 2)
    .map(([problemId, group]) => ({
      problemId,
      ...group,
      attempts: group.attempts.toSorted(
        (left, right) => left.attemptNumber - right.attemptNumber,
      ),
    }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>My attempts</h1>
          <p className="lede">
            Every attempt is kept. Submitting freezes a design, so a second attempt at
            the same problem sits beside the first rather than replacing it.
          </p>
        </div>
      </div>

      {attempts.length === 0 ? (
        <div className="empty">
          <span className="empty-icon">
            <History size={17} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h3>No attempts yet</h3>
          <p>
            Start a problem to create your first design review. Nothing is graded and
            nothing is compared against a model answer.
          </p>
          <Link href="/problems" className="btn btn-primary">
            <LayoutList aria-hidden="true" />
            Choose a problem
          </Link>
        </div>
      ) : (
        <>
          {comparableGroups.length > 0 && (
            <section className="section flush">
              <div className="section-head">
                <h2>
                  <GitCompare size={18} strokeWidth={1.75} aria-hidden="true" />
                  Compare designs
                </h2>
                <span className="section-note">
                  Only attempts on the same problem can be compared
                </span>
              </div>
              <div className="entry-list">
                {comparableGroups.map((group) => (
                  <AttemptComparisonPicker
                    key={group.problemId}
                    problemTitle={group.problemTitle}
                    attempts={group.attempts}
                  />
                ))}
              </div>
            </section>
          )}

          <section className={comparableGroups.length === 0 ? "section flush" : "section"}>
            <div className="section-head">
              <h2>All attempts</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Problem</th>
                    <th scope="col" className="col-shrink">#</th>
                    <th scope="col">Attempt</th>
                    <th scope="col">Review</th>
                    <th scope="col" className="col-shrink">Started</th>
                    <th scope="col" className="col-shrink">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((attempt) => (
                    <tr key={attempt.id}>
                      <td>
                        <Link href={`/attempts/${attempt.id}`} className="row-title">
                          {attempt.problemTitle}
                        </Link>
                      </td>
                      <td className="col-shrink tabular">{attempt.attemptNumber}</td>
                      <td>
                        <AttemptStatusPill status={attempt.status} />
                      </td>
                      <td>
                        {attempt.evaluationStatus === null ? (
                          <span className="section-note">Not run</span>
                        ) : (
                          <EvaluationStatusPill status={attempt.evaluationStatus} />
                        )}
                      </td>
                      <td className="col-shrink tabular">
                        {formatMoment(attempt.createdAt)}
                      </td>
                      <td className="col-shrink">
                        {attempt.evaluationStatus === "COMPLETED" ? (
                          <Link
                            href={`/attempts/${attempt.id}/review`}
                            className="btn btn-small"
                          >
                            Read review
                          </Link>
                        ) : (
                          <Link href={`/attempts/${attempt.id}`} className="btn btn-small">
                            Open
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
