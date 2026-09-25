import type { EvidenceResponse } from "@/presentation/api/dto";

/**
 * Evidence is rendered as text inside a plain element. Learner content is never
 * interpreted as markup: React escapes it, and no raw-HTML injection API is used
 * anywhere in this application — an architecture test enforces that.
 */
export function EvidenceBlock({
  evidence,
}: {
  readonly evidence: readonly EvidenceResponse[];
}) {
  return (
    <>
      {evidence.map((one) => (
        <p className="evidence" key={evidenceKey(one)}>
          {one.entity}
          {one.field === undefined ? "" : ` · ${one.field}`}
          {one.value === undefined ? "" : `\n${one.value}`}
        </p>
      ))}
    </>
  );
}

function evidenceKey(evidence: EvidenceResponse): string {
  return `${evidence.entity}|${evidence.field ?? ""}|${evidence.value ?? ""}`;
}
