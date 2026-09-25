"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GitCompare } from "lucide-react";
import { AttemptStatusPill } from "./status-pill";
import { formatMoment } from "./formatting";

export interface ComparableAttempt {
  readonly id: string;
  readonly attemptNumber: number;
  readonly status: string;
  readonly createdAt: string;
}

export interface AttemptComparisonPickerProps {
  readonly problemTitle: string;
  /** Ascending by attempt number, so the two checkboxes read top-to-bottom as the story happened. */
  readonly attempts: readonly ComparableAttempt[];
}

/**
 * Lets a learner pick exactly two of their own attempts on one problem to
 * compare. Selection is scoped to this one problem's list — there is nothing in
 * this component that could select an attempt from another problem, which is
 * what makes "only the same problem can be compared" obvious rather than a rule
 * enforced invisibly on the server alone.
 */
export function AttemptComparisonPicker({
  problemTitle,
  attempts,
}: AttemptComparisonPickerProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<readonly string[]>([]);

  function toggle(attemptId: string): void {
    setSelected((current) => {
      if (current.includes(attemptId)) {
        return current.filter((id) => id !== attemptId);
      }
      if (current.length >= 2) {
        return current;
      }
      return [...current, attemptId];
    });
  }

  function compare(): void {
    const [left, right] = attempts
      .filter((attempt) => selected.includes(attempt.id))
      .map((attempt) => attempt.id);
    if (left === undefined || right === undefined) {
      return;
    }
    router.push(`/attempts/compare?left=${left}&right=${right}`);
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{problemTitle}</h3>
        <span className="section-note tabular">{attempts.length} attempts</span>
      </div>
      <div className="panel-body tight">
        <ul className="checklist" role="group" aria-label={`Select two attempts on ${problemTitle} to compare`}>
          {attempts.map((attempt) => {
            const checked = selected.includes(attempt.id);
            const disabled = !checked && selected.length >= 2;
            return (
              <li key={attempt.id}>
                <label className="compare-picker">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(attempt.id)}
                    aria-label={`Attempt ${attempt.attemptNumber}, ${formatMoment(attempt.createdAt)}`}
                  />
                  <span>
                    Attempt {attempt.attemptNumber} · {formatMoment(attempt.createdAt)}
                  </span>
                  <AttemptStatusPill status={attempt.status} />
                </label>
              </li>
            );
          })}
        </ul>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={selected.length !== 2}
            onClick={compare}
          >
            <GitCompare aria-hidden="true" />
            Compare designs
          </button>
        </div>
      </div>
    </div>
  );
}
