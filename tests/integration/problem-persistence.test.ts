import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Problem } from "@/domain/problem/problem";
import { seedDatabase } from "@/infrastructure/persistence/seed/seed-database";
import { SEED_PROBLEMS } from "@/infrastructure/persistence/seed/problem-catalogue";
import { createIntegrationHarness } from "./harness";

const harness = createIntegrationHarness();

afterAll(async () => {
  await harness.prisma.$disconnect();
});

describe("problem persistence", () => {
  beforeEach(async () => {
    await seedDatabase(harness.prisma);
  });

  it("stores the four seeded problems", async () => {
    const problems = await harness.repositories.problems.findAll();

    expect(problems.map((problem) => problem.slug).toSorted()).toEqual([
      "elevator-system",
      "notification-system",
      "parking-lot",
      "vending-machine",
    ]);
  });

  it("reads a problem back as a domain entity, not a database row", async () => {
    const problem = await harness.repositories.problems.findBySlug("parking-lot");

    expect(problem).toBeInstanceOf(Problem);
    expect(problem?.title).toBe("Parking Lot");
    expect(problem?.context.length).toBeGreaterThan(50);
    expect(problem?.constraints.length).toBeGreaterThan(0);
  });

  it("finds the same problem by id and by slug", async () => {
    const bySlug = await harness.repositories.problems.findBySlug("vending-machine");
    const byId = await harness.repositories.problems.findById(bySlug!.id);

    expect(byId?.slug).toBe("vending-machine");
  });

  it("returns null rather than throwing for an unknown problem", async () => {
    expect(await harness.repositories.problems.findById("prb_missing")).toBeNull();
    expect(await harness.repositories.problems.findBySlug("nope")).toBeNull();
  });

  it("keeps every requirement attached to its own problem", async () => {
    const problems = await harness.repositories.problems.findAll();

    for (const problem of problems) {
      expect(problem.requirements.length).toBeGreaterThan(0);
      for (const requirement of problem.requirements) {
        expect(requirement.problemId).toBe(problem.id);
      }
    }
  });

  it("stores requirements in catalogue order with their codes", async () => {
    const problem = await harness.repositories.problems.findBySlug("parking-lot");
    const expected = SEED_PROBLEMS.find(
      (candidate) => candidate.slug === "parking-lot",
    )!;

    expect(problem?.requirements.map((requirement) => requirement.code)).toEqual(
      expected.requirements.map((requirement) => requirement.code),
    );
  });

  it("stores the rubric with its criteria and version", async () => {
    const problem = await harness.repositories.problems.findBySlug("elevator-system");

    expect(problem?.rubric.version).toBe("elevator-system-v1");
    expect(problem?.rubric.criteria.length).toBeGreaterThan(3);
    for (const criterion of problem!.rubric.criteria) {
      expect(criterion.weight).toBeGreaterThan(0);
      expect(criterion.guidance.length).toBeGreaterThan(10);
    }
  });

  it("is safe to seed twice without duplicating anything", async () => {
    const first = await seedDatabase(harness.prisma);
    const second = await seedDatabase(harness.prisma);

    expect(second).toEqual(first);
    expect(await harness.prisma.problem.count()).toBe(SEED_PROBLEMS.length);
    expect(await harness.prisma.requirement.count()).toBe(first.requirements);
    expect(await harness.prisma.learner.count()).toBe(1);
  });

  it("does not seed any reference design", async () => {
    const problem = await harness.repositories.problems.findBySlug("parking-lot");
    const snapshot = problem!.toSnapshot() as unknown as Record<string, unknown>;

    expect(Object.keys(snapshot)).not.toContain("referenceDesign");
    expect(await harness.prisma.design.count()).toBe(0);
  });
});
