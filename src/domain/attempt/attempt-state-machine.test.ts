import { describe, expect, it } from "vitest";
import { InvalidAttemptStateError } from "../shared/errors";
import {
  ALLOWED_ATTEMPT_TRANSITIONS,
  assertAttemptTransition,
  canTransitionAttempt,
  isAttemptTerminal,
} from "./attempt-state-machine";
import { ATTEMPT_STATUSES } from "./attempt-status";
import type { AttemptStatus } from "./attempt-status";

const VALID_TRANSITIONS: readonly [AttemptStatus, AttemptStatus][] = [
  ["IN_PROGRESS", "SUBMITTED"],
  ["SUBMITTED", "EVALUATING"],
  ["EVALUATING", "COMPLETED"],
  ["EVALUATING", "FAILED"],
  ["FAILED", "EVALUATING"],
];

describe("attempt state machine", () => {
  it.each(VALID_TRANSITIONS)("allows %s -> %s", (from, to) => {
    expect(canTransitionAttempt(from, to)).toBe(true);
    expect(() => assertAttemptTransition("att_001", from, to)).not.toThrow();
  });

  const invalidTransitions = ATTEMPT_STATUSES.flatMap((from) =>
    ATTEMPT_STATUSES.filter(
      (to) =>
        !VALID_TRANSITIONS.some(
          ([validFrom, validTo]) => validFrom === from && validTo === to,
        ),
    ).map((to) => [from, to] as const),
  );

  it.each(invalidTransitions)("rejects %s -> %s", (from, to) => {
    expect(canTransitionAttempt(from, to)).toBe(false);
    expect(() => assertAttemptTransition("att_001", from, to)).toThrow(
      InvalidAttemptStateError,
    );
  });

  it("names both states in the rejection message", () => {
    expect(() =>
      assertAttemptTransition("att_001", "COMPLETED", "EVALUATING"),
    ).toThrow(/att_001 cannot move from COMPLETED to EVALUATING/);
  });

  it("treats COMPLETED as the only terminal state", () => {
    const terminal = ATTEMPT_STATUSES.filter(isAttemptTerminal);
    expect(terminal).toEqual(["COMPLETED"]);
  });

  it("allows a failed evaluation to be retried", () => {
    expect(ALLOWED_ATTEMPT_TRANSITIONS.FAILED).toEqual(["EVALUATING"]);
  });

  it("does not allow submitting twice", () => {
    expect(canTransitionAttempt("SUBMITTED", "SUBMITTED")).toBe(false);
  });
});
