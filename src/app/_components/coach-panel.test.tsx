// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CoachAnswerResponse } from "@/presentation/api/coach-dto";
import { CoachPanel } from "./coach-panel";

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function fakeAnswer(overrides: Partial<CoachAnswerResponse> = {}): CoachAnswerResponse {
  return {
    attemptId: "att_1",
    answer: "PaymentService is coupled to a concrete gateway, not an abstraction.",
    observations: [],
    evaluationReferences: [],
    knowledgeCitations: [],
    certainty: "SUFFICIENT_CONTEXT",
    unverifiedReferenceCount: 0,
    ...overrides,
  };
}

async function askQuestion(text: string): Promise<void> {
  fireEvent.change(screen.getByLabelText("Ask about this design"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CoachPanel", () => {
  it("starts with an empty-state prompt rather than a blank space", () => {
    render(<CoachPanel attemptId="att_1" />);

    expect(
      screen.getByText(/Ask a question about your design/u),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Ask" }).hasAttribute("disabled")).toBe(true);
  });

  it("disables asking until a question is typed", () => {
    render(<CoachPanel attemptId="att_1" />);

    fireEvent.change(screen.getByLabelText("Ask about this design"), {
      target: { value: "  " },
    });

    expect(screen.getByRole("button", { name: "Ask" }).hasAttribute("disabled")).toBe(true);
  });

  it("shows a busy state while the request is in flight", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            setTimeout(() => resolve(respond(200, fakeAnswer())), 20);
          }),
      ),
    );
    render(<CoachPanel attemptId="att_1" />);

    await askQuestion("Why is PaymentService coupled?");

    expect(screen.getByRole("status").textContent).toContain("Reading your design");
    expect(screen.getByRole("button", { name: "Thinking…" }).hasAttribute("disabled")).toBe(
      true,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Ask" }).hasAttribute("disabled")).toBe(false),
    );
  });

  it("renders a grounded answer once one comes back", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respond(
          200,
          fakeAnswer({
            answer: "PaymentService directly depends on StripeGateway, a concrete class.",
            observations: [
              {
                text: "PaymentService depends on StripeGateway.",
                evidence: [{ entity: "PaymentService", field: "relationships", value: "StripeGateway" }],
              },
            ],
          }),
        ),
      ),
    );
    render(<CoachPanel attemptId="att_1" />);

    await askQuestion("Why is PaymentService coupled?");

    await waitFor(() =>
      expect(
        screen.getByText("PaymentService directly depends on StripeGateway, a concrete class."),
      ).toBeDefined(),
    );
    expect(screen.getByText("PaymentService depends on StripeGateway.")).toBeDefined();
    expect(screen.getByText(/StripeGateway/u, { selector: ".evidence" })).toBeDefined();
  });

  it("shows the coach's follow-up question when context is insufficient", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respond(
          200,
          fakeAnswer({
            answer: "I need a bit more information before judging this.",
            certainty: "AMBIGUOUS",
            followUpQuestion: "Do you expect more than one payment provider?",
          }),
        ),
      ),
    );
    render(<CoachPanel attemptId="att_1" />);

    await askQuestion("Is this extensible enough?");

    await waitFor(() =>
      expect(screen.getByText("Needs clarification")).toBeDefined(),
    );
    expect(screen.getByText("Do you expect more than one payment provider?")).toBeDefined();
  });

  it("shows the server's message and offers a retry on failure, without a stack trace", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respond(502, {
          error: {
            code: "COACH_EXECUTION_FAILED",
            message: "The coach could not answer that just now. You can try asking again.",
            issues: [],
          },
        }),
      ),
    );
    render(<CoachPanel attemptId="att_1" />);

    await askQuestion("Why is this coupled?");

    await waitFor(() =>
      expect(
        screen.getByText("The coach could not answer that just now. You can try asking again."),
      ).toBeDefined(),
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
  });

  it("surfaces a network failure rather than failing silently", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("offline"))));
    render(<CoachPanel attemptId="att_1" />);

    await askQuestion("Why is this coupled?");

    await waitFor(() =>
      expect(
        screen.getByText("Could not reach the server. Check your connection and try again."),
      ).toBeDefined(),
    );
  });

  it("answers even when no evaluation has ever run for this attempt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respond(200, fakeAnswer({ answer: "I can answer from your design alone." })),
      ),
    );
    render(<CoachPanel attemptId="att_1" />);

    await askQuestion("Where should I start?");

    await waitFor(() =>
      expect(screen.getByText("I can answer from your design alone.")).toBeDefined(),
    );
  });

  it("shows evaluation references and knowledge citations without exposing passage text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respond(
          200,
          fakeAnswer({
            evaluationReferences: [{ criterion: "COUPLING", nature: "SEMANTIC" }],
            knowledgeCitations: [
              { ref: "K1", title: "Dependency inversion", source: "knowledge base", topic: "SOLID" },
            ],
          }),
        ),
      ),
    );
    render(<CoachPanel attemptId="att_1" />);

    await askQuestion("Why is this coupled?");

    await waitFor(() => expect(screen.getByText("Dependency inversion")).toBeDefined());
    expect(screen.getByText(/Grounded in 1 principle/u)).toBeDefined();
  });

  it("replaces the previous answer rather than accumulating a transcript", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(200, fakeAnswer({ answer: "First answer." })))
      .mockResolvedValueOnce(respond(200, fakeAnswer({ answer: "Second answer." })));
    vi.stubGlobal("fetch", fetchMock);
    render(<CoachPanel attemptId="att_1" />);

    await askQuestion("First question?");
    await waitFor(() => expect(screen.getByText("First answer.")).toBeDefined());

    await askQuestion("Second question?");
    await waitFor(() => expect(screen.getByText("Second answer.")).toBeDefined());
    expect(screen.queryByText("First answer.")).toBeNull();
  });
});
