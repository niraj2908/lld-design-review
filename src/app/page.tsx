import Link from "next/link";
import { ArrowRight, Inbox, LayoutList, SquarePen } from "lucide-react";
import { readAttempts, readProblems } from "@/presentation/server/read-model";
import { AttemptStatusPill } from "./_components/status-pill";
import { formatMoment } from "./_components/formatting";

export const dynamic = "force-dynamic";

/*
 * The entry screen is a workspace, not a landing page: what you were doing, then what
 * you could do next. There is no hero, no feature grid and no product pitch — the
 * learner arriving here has already chosen the product.
 */
export default async function HomePage() {
  const [problems, attempts] = await Promise.all([readProblems(), readAttempts()]);
  const open = attempts.find((attempt) => attempt.status === "IN_PROGRESS");
  const recent = attempts.slice(0, 4);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Workspace</h1>
          <p className="lede">
            Write a low-level design, submit it, and read a review that has to quote
            your own design for every concern it raises.
          </p>
        </div>
        <div className="head-actions">
          <Link href="/problems" className="btn">
            <LayoutList aria-hidden="true" />
            Browse problems
          </Link>
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Continue</h2>
          <Link href="/attempts" className="section-note">
            All attempts
          </Link>
        </div>

        {open === undefined ? (
          <div className="empty">
            <span className="empty-icon">
              <Inbox size={17} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <h3>Nothing in progress</h3>
            <p>
              Pick a problem to start an attempt. Your earlier attempts stay exactly
              as you left them.
            </p>
            <Link href="/problems" className="btn">
              <LayoutList aria-hidden="true" />
              Choose a problem
            </Link>
          </div>
        ) : (
          <div className="panel">
            <div className="panel-head">
              <h3>
                <SquarePen size={15} strokeWidth={1.75} aria-hidden="true" />
                {open.problemTitle} · attempt {open.attemptNumber}
              </h3>
              <AttemptStatusPill status={open.status} />
            </div>
            <div className="panel-body">
              <p className="section-note">
                Started {formatMoment(open.createdAt)}. The draft is saved on the
                server, so you can leave and come back.
              </p>
              <div className="btn-row">
                <Link href={`/attempts/${open.id}`} className="btn btn-primary">
                  Open the design
                  <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Recent attempts</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Attempt</th>
                  <th scope="col">Status</th>
                  <th scope="col">Started</th>
                  <th scope="col" className="col-shrink">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {recent.map((attempt) => (
                  <tr key={attempt.id}>
                    <td>
                      <Link href={`/attempts/${attempt.id}`} className="row-title">
                        {attempt.problemTitle}
                      </Link>
                      <span className="row-sub">Attempt {attempt.attemptNumber}</span>
                    </td>
                    <td>
                      <AttemptStatusPill status={attempt.status} />
                    </td>
                    <td className="tabular">{formatMoment(attempt.createdAt)}</td>
                    <td className="col-shrink">
                      {attempt.status === "COMPLETED" ? (
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
      )}

      <section className="section">
        <div className="section-head">
          <h2>Problems</h2>
          <span className="section-note">{problems.length} available</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Problem</th>
                <th scope="col" className="col-shrink">Requirements</th>
                <th scope="col" className="col-shrink">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {problems.map((problem) => (
                <tr key={problem.id}>
                  <td>
                    <Link href={`/problems/${problem.slug}`} className="row-title">
                      {problem.title}
                    </Link>
                    <span className="row-sub">{problem.description}</span>
                  </td>
                  <td className="col-shrink tabular">
                    {problem.requirementCount}
                    <span className="section-note"> · {problem.mustRequirementCount} must</span>
                  </td>
                  <td className="col-shrink">
                    <Link href={`/problems/${problem.slug}`} className="btn btn-small">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
