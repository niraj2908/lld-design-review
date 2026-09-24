// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { validParkingLotDesign } from "@/testing/fixtures";
import type { ProblemResponse } from "@/presentation/api/dto";
import { AttemptWorkspace } from "./attempt-workspace";

const refresh = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push }),
}));

const problem: ProblemResponse = {
  id: "prb_parking_lot",
  slug: "parking-lot",
  title: "Parking Lot",
  description: "Design the classes behind a parking lot.",
  context: "A single site with several levels.",
  constraints: [],
  requirementCount: 1,
  mustRequirementCount: 1,
  requirements: [
    {
      id: "req_pl_01",
      code: "PL-REQ-01",
      title: "Compatible spot allocation",
      description: "A vehicle gets a compatible spot.",
      priority: "MUST",
    },
  ],
  acceptedSubmissionFormats: ["STRUCTURED_DESIGN"],
};

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function renderWorkspace(
  overrides: Partial<Parameters<typeof AttemptWorkspace>[0]> = {},
) {
  return render(
    <AttemptWorkspace
      attemptId="att_1"
      attemptNumber={1}
      status="IN_PROGRESS"
      evaluationStatus={null}
      problem={problem}
      design={validParkingLotDesign()}
      {...overrides}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  refresh.mockClear();
  push.mockClear();
});

describe("the attempt workspace", () => {
  it("offers save and submit while the attempt is in progress", () => {
    renderWorkspace();

    expect(screen.getByRole("button", { name: "Save draft" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Submit design" })).toBeDefined();
    expect(screen.getByText("In progress")).toBeDefined();
  });

  it("shows a busy label while a save is in flight", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            setTimeout(() => resolve(respond(200, { issues: [] })), 20);
          }),
      ),
    );
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    // The buttons keep their labels; the status line, not the control, reports progress.
    expect(screen.getByRole("status").textContent).toContain("Saving…");
    expect(
      screen.getByRole("button", { name: "Save draft" }).hasAttribute("disabled"),
    ).toBe(true);
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Save draft" })
          .hasAttribute("disabled"),
      ).toBe(false),
    );
  });

  it("confirms a clean save", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respond(200, { issues: [] })));
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() =>
      expect(
        screen.getByText("Draft saved. Nothing is blocking a submission."),
      ).toBeDefined(),
    );
  });

  it("reports what would block a submission after a save", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respond(200, {
          issues: [
            {
              path: "classes[0].name",
              message: "Every class needs a name.",
              severity: "ERROR",
            },
          ],
        }),
      ),
    );
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() =>
      expect(
        screen.getByText("Draft saved. 1 thing would block a submission."),
      ).toBeDefined(),
    );
    expect(screen.getByText("Every class needs a name.", { exact: false })).toBeDefined();
  });

  it("shows the server's message when a submission is refused", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respond(422, {
          error: {
            code: "DESIGN_INVALID",
            message: "The design cannot be submitted yet.",
            issues: [
              { path: "relationships[0].target", message: "Target does not exist." },
            ],
          },
        }),
      ),
    );
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Submit design" }));

    await waitFor(() =>
      expect(screen.getByText("The design cannot be submitted yet.")).toBeDefined(),
    );
    expect(screen.getByText("Target does not exist.", { exact: false })).toBeDefined();
  });

  it("surfaces a network failure rather than failing silently", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("offline"))));
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() =>
      expect(
        screen.getByText("Could not reach the server. Check your connection and try again."),
      ).toBeDefined(),
    );
  });

  it("locks the design and offers the review once submitted", () => {
    renderWorkspace({ status: "SUBMITTED", evaluationStatus: null });

    expect(screen.queryByRole("button", { name: "Save draft" })).toBeNull();
    expect(screen.getByRole("button", { name: "Run the review" })).toBeDefined();
    expect(
      screen.getByText("Submitting freezes a design", { exact: false }),
    ).toBeDefined();
    expect((screen.getByLabelText("Class 1 name") as HTMLInputElement).disabled).toBe(
      true,
    );
  });

  it("shows the evaluation status alongside the attempt status", () => {
    renderWorkspace({ status: "COMPLETED", evaluationStatus: "COMPLETED" });

    expect(screen.getByText("Reviewed")).toBeDefined();
    expect(screen.getByText("Review ready")).toBeDefined();
    expect(screen.getByRole("link", { name: "Open the review" })).toBeDefined();
  });

  it("offers a retry path after a failed review", () => {
    renderWorkspace({ status: "FAILED", evaluationStatus: "FAILED" });

    expect(screen.getByText("Review failed")).toBeDefined();
    expect(screen.getByRole("button", { name: "Run the review" })).toBeDefined();
  });

  it("always offers a new attempt without touching the submitted one", () => {
    renderWorkspace({ status: "COMPLETED", evaluationStatus: "COMPLETED" });

    expect(screen.getByRole("link", { name: "Start another attempt" })).toBeDefined();
  });

  it("counts requirement coverage from the design being edited", () => {
    renderWorkspace({});

    // The fixture design maps this problem's one requirement, with no save needed.
    expect(
      screen.getByRole("img", { name: "1 of 1 requirements mapped" }),
    ).toBeDefined();
    expect(screen.getByText("Compatible spot allocation")).toBeDefined();
  });

  it("never counts a mapping for a requirement this problem does not have", () => {
    // The fixture design maps two requirements; this problem declares one.
    renderWorkspace({});

    expect(
      screen.getByRole("status").textContent,
    ).toContain("1 of 1 requirements mapped");
  });

  it("reports progress in a live region rather than only in the button", () => {
    renderWorkspace({});
    const status = screen.getByRole("status");

    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toContain("1 of 1 requirements mapped");
  });
});
