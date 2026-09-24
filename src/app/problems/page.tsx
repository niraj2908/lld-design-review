import Link from "next/link";
import { Inbox } from "lucide-react";
import { readAttempts, readProblems } from "@/presentation/server/read-model";

export const dynamic = "force-dynamic";

export default async function ProblemsPage() {
  const [problems, attempts] = await Promise.all([readProblems(), readAttempts()]);

  const attemptsByProblem = new Map<string, number>();
  for (const attempt of attempts) {
    attemptsByProblem.set(
      attempt.problemId,
      (attemptsByProblem.get(attempt.problemId) ?? 0) + 1,
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Problems</h1>
          <p className="lede">
            Four problems, each chosen for a different kind of difficulty. A second
            attempt at one of these teaches more than a first attempt at a fifth.
          </p>
        </div>
      </div>

      {problems.length === 0 ? (
        <div className="empty">
          <span className="empty-icon">
            <Inbox size={17} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h3>No problems are loaded</h3>
          <p>
            The catalogue is seeded from the repository. Run{" "}
            <code className="code">npm run db:seed</code> and reload this page.
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Problem</th>
                <th scope="col" className="col-shrink">Requirements</th>
                <th scope="col" className="col-shrink">Must-have</th>
                <th scope="col" className="col-shrink">Your attempts</th>
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
                  <td className="col-shrink tabular">{problem.requirementCount}</td>
                  <td className="col-shrink tabular">{problem.mustRequirementCount}</td>
                  <td className="col-shrink tabular">
                    {attemptsByProblem.get(problem.id) ?? 0}
                  </td>
                  <td className="col-shrink">
                    <Link
                      href={`/problems/${problem.slug}`}
                      className="btn btn-small"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
