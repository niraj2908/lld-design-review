import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ListChecks, Shield, SquarePen } from "lucide-react";
import { StartAttemptButton } from "@/app/_components/start-attempt-button";
import { AttemptStatusPill } from "@/app/_components/status-pill";
import { readAttempts, readProblem } from "@/presentation/server/read-model";

export const dynamic = "force-dynamic";

export default async function ProblemPage({
  params,
}: {
  readonly params: Promise<{ readonly problemRef: string }>;
}) {
  const { problemRef } = await params;
  const problem = await readProblem(problemRef);

  if (problem === null) {
    notFound();
  }

  const attempts = (await readAttempts()).filter(
    (attempt) => attempt.problemId === problem.id,
  );

  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/problems">Problems</Link>
        <ChevronRight size={13} strokeWidth={2} aria-hidden="true" />
        <span aria-current="page">{problem.title}</span>
      </nav>

      <div className="page-head">
        <div>
          <h1>{problem.title}</h1>
          <p className="lede">{problem.description}</p>
        </div>
      </div>

      <div className="split">
        <div>
          <section className="section flush">
            <div className="section-head">
              <h2>Context</h2>
            </div>
            <p className="prose soft">
              {problem.context}
            </p>
          </section>

          <section className="section">
            <div className="section-head">
              <h2>
                <ListChecks size={18} strokeWidth={1.75} aria-hidden="true" />
                Requirements
              </h2>
              <span className="section-note">
                {problem.mustRequirementCount} of {problem.requirementCount} are
                must-haves
              </span>
            </div>
            <p className="section-note spaced">
              Map each requirement to the part of your design that satisfies it. That
              mapping is what lets a review point at your work instead of guessing.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col" className="col-shrink">Code</th>
                    <th scope="col">Requirement</th>
                    <th scope="col" className="col-shrink">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {problem.requirements.map((requirement) => (
                    <tr key={requirement.id}>
                      <td className="col-shrink code">{requirement.code}</td>
                      <td>
                        <span className="row-title">{requirement.title}</span>
                        <span className="row-sub">{requirement.description}</span>
                      </td>
                      <td className="col-shrink">
                        <span
                          className={
                            requirement.priority === "MUST"
                              ? "chip chip-attention"
                              : "chip"
                          }
                        >
                          {requirement.priority}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {problem.constraints.length > 0 && (
            <section className="section">
              <div className="section-head">
                <h2>
                  <Shield size={18} strokeWidth={1.75} aria-hidden="true" />
                  Constraints
                </h2>
              </div>
              <ul className="strengths">
                {problem.constraints.map((constraint) => (
                  <li key={constraint}>
                    <Shield strokeWidth={1.75} aria-hidden="true" />
                    <span>{constraint}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="rail">
          <div className="panel">
            <div className="panel-head">
              <h3>
                <SquarePen size={15} strokeWidth={1.75} aria-hidden="true" />
                Start an attempt
              </h3>
            </div>
            <div className="panel-body">
              <p className="section-note">
                You write classes, interfaces, relationships, the decisions behind
                them with their trade-offs, the edge cases you expect, and the
                requirement mapping. Several decompositions answer this problem well;
                the review does not measure yours against one of them.
              </p>
              <StartAttemptButton problemRef={problem.slug} />
            </div>
          </div>

          {attempts.length > 0 && (
            <div className="panel">
              <div className="panel-head">
                <h3>Your attempts</h3>
                <span className="section-note tabular">{attempts.length}</span>
              </div>
              <div className="panel-body tight">
                <ul className="rail-nav">
                  {attempts.map((attempt) => (
                    <li key={attempt.id}>
                      <Link
                        href={
                          attempt.evaluationStatus === "COMPLETED"
                            ? `/attempts/${attempt.id}/review`
                            : `/attempts/${attempt.id}`
                        }
                      >
                        <span>Attempt {attempt.attemptNumber}</span>
                        <span className="rail-count">
                          <AttemptStatusPill status={attempt.status} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
