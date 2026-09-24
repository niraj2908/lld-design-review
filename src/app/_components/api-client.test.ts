import { afterEach, describe, expect, it, vi } from "vitest";
import { postJson, putJson, requestJson } from "./api-client";

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the browser API client", () => {
  it("returns the parsed body on success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respond(200, { problems: [] })));

    const result = await requestJson<{ problems: unknown[] }>("/api/problems");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.problems).toEqual([]);
    }
  });

  it("reads the API's error envelope rather than throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respond(422, {
          error: {
            code: "DESIGN_INVALID",
            message: "The design cannot be submitted yet.",
            issues: [{ path: "classes[0].name", message: "Every class needs a name." }],
          },
        }),
      ),
    );

    const result = await postJson("/api/attempts/att_1/submissions", {});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.code).toBe("DESIGN_INVALID");
      expect(result.message).toContain("cannot be submitted");
      expect(result.issues).toHaveLength(1);
    }
  });

  it("turns a network failure into a message a learner can act on", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    );

    const result = await requestJson("/api/problems");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NETWORK_ERROR");
      expect(result.message).toContain("Could not reach the server");
    }
  });

  it("copes with an error response that has no envelope", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respond(500, {})));

    const result = await requestJson("/api/problems");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNKNOWN");
      expect(result.issues).toEqual([]);
    }
  });

  it("sends JSON with the right method", async () => {
    const fetchMock = vi.fn(async () => respond(200, {}));
    vi.stubGlobal("fetch", fetchMock);

    await putJson("/api/attempts/att_1/draft", { design: { classes: [] } });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(JSON.stringify({ design: { classes: [] } }));
    expect((init.headers as Record<string, string>)["content-type"]).toBe(
      "application/json",
    );
  });

  it("posts without a body when there is nothing to send", async () => {
    const fetchMock = vi.fn(async () => respond(201, {}));
    vi.stubGlobal("fetch", fetchMock);

    await postJson("/api/problems/parking-lot/attempts");

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
  });
});
