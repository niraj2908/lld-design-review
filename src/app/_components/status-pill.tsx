import {
  CircleAlert,
  CircleCheck,
  CircleDot,
  LoaderCircle,
  PenLine,
} from "lucide-react";
import type { ComponentType } from "react";

type Tone = "" | "chip-ok" | "chip-attention" | "chip-danger" | "chip-accent";

interface Look {
  readonly label: string;
  readonly tone: Tone;
  readonly Icon: ComponentType<{ size?: number; strokeWidth?: number }>;
}

/*
 * Status never depends on colour alone: every pill carries a word and a shape, so it
 * still reads for someone who cannot separate the green from the amber.
 */
const ATTEMPT: Readonly<Record<string, Look>> = {
  IN_PROGRESS: { label: "In progress", tone: "", Icon: PenLine },
  SUBMITTED: { label: "Submitted", tone: "chip-accent", Icon: CircleDot },
  EVALUATING: { label: "Evaluating", tone: "chip-accent", Icon: LoaderCircle },
  COMPLETED: { label: "Reviewed", tone: "chip-ok", Icon: CircleCheck },
  ABANDONED: { label: "Abandoned", tone: "", Icon: CircleAlert },
};

const EVALUATION: Readonly<Record<string, Look>> = {
  PENDING: { label: "Review queued", tone: "", Icon: CircleDot },
  RUNNING: { label: "Reviewing", tone: "chip-accent", Icon: LoaderCircle },
  COMPLETED: { label: "Review ready", tone: "chip-ok", Icon: CircleCheck },
  FAILED: { label: "Review failed", tone: "chip-danger", Icon: CircleAlert },
};

function Pill({ look, spin }: { readonly look: Look; readonly spin: boolean }) {
  const { label, tone, Icon } = look;
  return (
    <span className={`chip ${tone}`.trim()}>
      <span className={spin ? "chip-icon spin" : "chip-icon"}>
        <Icon size={13} strokeWidth={2} />
      </span>
      {label}
    </span>
  );
}

export function AttemptStatusPill({ status }: { readonly status: string }) {
  const look = ATTEMPT[status];
  if (look === undefined) {
    return <span className="chip">{status}</span>;
  }
  return <Pill look={look} spin={status === "EVALUATING"} />;
}

export function EvaluationStatusPill({ status }: { readonly status: string | null }) {
  if (status === null) {
    return null;
  }
  const look = EVALUATION[status];
  if (look === undefined) {
    return <span className="chip">{status}</span>;
  }
  return <Pill look={look} spin={status === "RUNNING"} />;
}
