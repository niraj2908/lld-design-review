// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { AttemptStatusPill, EvaluationStatusPill } from "./status-pill";

afterEach(cleanup);

describe("status pills", () => {
  /*
   * Colour alone must never carry the meaning: someone who cannot separate the green
   * from the amber still has to be able to read the state.
   */
  it("says the state in words", () => {
    render(<AttemptStatusPill status="IN_PROGRESS" />);
    expect(screen.getByText("In progress")).toBeDefined();
  });

  it("uses learner language rather than the stored enum", () => {
    render(<AttemptStatusPill status="COMPLETED" />);
    expect(screen.getByText("Reviewed")).toBeDefined();
    expect(screen.queryByText("COMPLETED")).toBeNull();
  });

  it("falls back to the raw value for a state it does not know", () => {
    render(<AttemptStatusPill status="SOMETHING_NEW" />);
    expect(screen.getByText("SOMETHING_NEW")).toBeDefined();
  });

  it("renders nothing when there is no evaluation yet", () => {
    const { container } = render(<EvaluationStatusPill status={null} />);
    expect(container.textContent).toBe("");
  });

  it("separates a failed review from a failed attempt", () => {
    render(<EvaluationStatusPill status="FAILED" />);
    expect(screen.getByText("Review failed")).toBeDefined();
  });
});
