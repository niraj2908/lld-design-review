import { describe, expect, it } from "vitest";
import { createApiServices } from "./services";
import type { PrismaClient } from "@/infrastructure/persistence/prisma/prisma-client";

/** Construction only: nothing here issues a query. */
const prisma = {} as PrismaClient;

describe("createApiServices", () => {
  it("wires every use case the API layer needs", () => {
    const services = createApiServices(prisma, {});

    for (const name of [
      "listProblems",
      "getProblem",
      "listAttempts",
      "startAttempt",
      "saveDraft",
      "submitAttempt",
      "getAttempt",
      "getAttemptHistory",
      "evaluateAttempt",
      "retryEvaluation",
    ] as const) {
      expect(services[name]).toBeDefined();
    }
    expect(services.learnerId).toBe("lrn_seed");
  });

  /**
   * The whole application must not fall over because the knowledge layer cannot be
   * assembled. In production without an embedding key there is no provider to build,
   * and the review runs without reference knowledge rather than not at all.
   */
  it("builds in production without an embedding key", () => {
    expect(() =>
      createApiServices(prisma, { NODE_ENV: "production" }),
    ).not.toThrow();
  });

  it("builds in production with a model but no embedding key", () => {
    expect(() =>
      createApiServices(prisma, {
        NODE_ENV: "production",
        GROQ_API_KEY: "test-key-not-a-real-credential",
      }),
    ).not.toThrow();
  });

  it("builds in production with both keys", () => {
    expect(() =>
      createApiServices(prisma, {
        NODE_ENV: "production",
        GROQ_API_KEY: "test-key-not-a-real-credential",
        EMBEDDING_API_KEY: "test-key-not-a-real-credential",
      }),
    ).not.toThrow();
  });

  it("builds outside production with no keys at all", () => {
    expect(() => createApiServices(prisma, { NODE_ENV: "development" })).not.toThrow();
  });

  it("still refuses a configuration it cannot honour", () => {
    expect(() =>
      createApiServices(prisma, {
        EMBEDDING_API_KEY: "test-key-not-a-real-credential",
        EMBEDDING_DIMENSIONS: "768",
      }),
    ).toThrow(/needs a migration/);
  });
});
