import { notFound } from "next/navigation";
import { AttemptWorkspace } from "@/app/_components/attempt-workspace";
import { readAttemptWorkspace } from "@/presentation/server/read-model";

export const dynamic = "force-dynamic";

export default async function AttemptPage({
  params,
}: {
  readonly params: Promise<{ readonly attemptId: string }>;
}) {
  const { attemptId } = await params;
  const workspace = await readAttemptWorkspace(attemptId);

  if (workspace === null) {
    notFound();
  }

  return (
    <AttemptWorkspace
      attemptId={workspace.attempt.id}
      attemptNumber={workspace.attempt.attemptNumber}
      status={workspace.attempt.status}
      evaluationStatus={workspace.evaluationStatus}
      problem={workspace.problem}
      design={workspace.design}
    />
  );
}
