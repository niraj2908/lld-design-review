// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AttemptComparisonPicker } from "./attempt-comparison-picker";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

afterEach(() => {
  cleanup();
  push.mockClear();
});

const ATTEMPTS = [
  { id: "att_1", attemptNumber: 1, status: "COMPLETED", createdAt: "2026-09-24T10:00:00.000Z" },
  { id: "att_2", attemptNumber: 2, status: "COMPLETED", createdAt: "2026-09-25T10:00:00.000Z" },
  { id: "att_3", attemptNumber: 3, status: "IN_PROGRESS", createdAt: "2026-09-26T10:00:00.000Z" },
] as const;

describe("AttemptComparisonPicker", () => {
  it("disables the compare action until exactly two attempts are selected", () => {
    render(<AttemptComparisonPicker problemTitle="Parking Lot" attempts={ATTEMPTS} />);

    const compare = screen.getByRole("button", { name: "Compare designs" });
    expect(compare.hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByRole("checkbox", { name: /Attempt 1/u }));
    expect(compare.hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByRole("checkbox", { name: /Attempt 2/u }));
    expect(compare.hasAttribute("disabled")).toBe(false);
  });

  it("disables the remaining checkboxes once two are already selected", () => {
    render(<AttemptComparisonPicker problemTitle="Parking Lot" attempts={ATTEMPTS} />);

    fireEvent.click(screen.getByRole("checkbox", { name: /Attempt 1/u }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Attempt 2/u }));

    const third = screen.getByRole("checkbox", { name: /Attempt 3/u });
    expect(third.hasAttribute("disabled")).toBe(true);
  });

  it("lets a selection be undone without needing to compare first", () => {
    render(<AttemptComparisonPicker problemTitle="Parking Lot" attempts={ATTEMPTS} />);

    const first = screen.getByRole("checkbox", { name: /Attempt 1/u });
    fireEvent.click(first);
    fireEvent.click(first);

    expect((first as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole("button", { name: "Compare designs" }).hasAttribute("disabled")).toBe(
      true,
    );
  });

  it("navigates to the compare page with both attempt ids in attempt-number order", () => {
    render(<AttemptComparisonPicker problemTitle="Parking Lot" attempts={ATTEMPTS} />);

    fireEvent.click(screen.getByRole("checkbox", { name: /Attempt 2/u }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Attempt 1/u }));
    fireEvent.click(screen.getByRole("button", { name: "Compare designs" }));

    expect(push).toHaveBeenCalledWith("/attempts/compare?left=att_1&right=att_2");
  });

  it("never lets an attempt from another problem into the selection", () => {
    // The component only ever receives one problem's attempts as props — there is
    // no prop or code path here that could mix in an attempt id from elsewhere,
    // which is what makes the same-problem constraint visible rather than merely
    // enforced silently on the server.
    render(<AttemptComparisonPicker problemTitle="Parking Lot" attempts={ATTEMPTS} />);

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(ATTEMPTS.length);
  });
});
