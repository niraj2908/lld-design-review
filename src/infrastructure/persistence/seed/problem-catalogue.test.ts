import { describe, expect, it } from "vitest";
import { Problem } from "@/domain/problem/problem";
import { STRUCTURED_DESIGN } from "@/domain/submission/submission-format-type";
import { SEED_LEARNER, SEED_PROBLEMS } from "./problem-catalogue";

const CREATED_AT = new Date("2026-01-01T00:00:00.000Z");

describe("seed problem catalogue", () => {
  it("contains exactly the four MVP problems", () => {
    expect(SEED_PROBLEMS.map((problem) => problem.slug)).toEqual([
      "parking-lot",
      "vending-machine",
      "elevator-system",
      "notification-system",
    ]);
  });

  it("names one seeded learner", () => {
    expect(SEED_LEARNER.id).toBe("lrn_seed");
  });

  it("uses unique problem ids and slugs", () => {
    expect(new Set(SEED_PROBLEMS.map((problem) => problem.id)).size).toBe(
      SEED_PROBLEMS.length,
    );
    expect(new Set(SEED_PROBLEMS.map((problem) => problem.slug)).size).toBe(
      SEED_PROBLEMS.length,
    );
  });

  /**
   * The catalogue is data, so the only way it can be wrong is by violating a
   * domain rule. Building each entry through Problem.create proves it cannot be
   * seeded into a state the domain would reject.
   */
  it.each(SEED_PROBLEMS.map((problem) => [problem.slug, problem] as const))(
    "%s satisfies every domain invariant",
    (_slug, seed) => {
      const problem = Problem.create({
        id: seed.id,
        slug: seed.slug,
        title: seed.title,
        description: seed.description,
        context: seed.context,
        constraints: [...seed.constraints],
        requirements: seed.requirements.map((requirement) => ({
          id: `${seed.id}_${requirement.code}`,
          problemId: seed.id,
          code: requirement.code,
          title: requirement.title,
          description: requirement.description,
          priority: requirement.priority,
        })),
        acceptedSubmissionFormats: [STRUCTURED_DESIGN],
        rubric: {
          version: seed.rubricVersion,
          criteria: [...seed.rubricCriteria],
        },
        version: 1,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      });

      expect(problem.requirements.length).toBeGreaterThanOrEqual(5);
    },
  );

  it.each(SEED_PROBLEMS.map((problem) => [problem.slug, problem] as const))(
    "%s gives the learner enough to reason from",
    (_slug, seed) => {
      expect(seed.context.length).toBeGreaterThan(120);
      expect(seed.constraints.length).toBeGreaterThanOrEqual(3);
      for (const requirement of seed.requirements) {
        expect(requirement.description.length).toBeGreaterThan(30);
        expect(requirement.code).toMatch(/^[A-Z]{2}-REQ-\d{2}$/);
      }
    },
  );

  it.each(SEED_PROBLEMS.map((problem) => [problem.slug, problem] as const))(
    "%s has at least one MUST requirement",
    (_slug, seed) => {
      expect(
        seed.requirements.some(
          (requirement) => requirement.priority === "MUST",
        ),
      ).toBe(true);
    },
  );

  it.each(SEED_PROBLEMS.map((problem) => [problem.slug, problem] as const))(
    "%s has rubric weights that sum to one",
    (_slug, seed) => {
      const total = seed.rubricCriteria.reduce(
        (sum, criterion) => sum + criterion.weight,
        0,
      );

      expect(total).toBeCloseTo(1, 5);
    },
  );

  /**
   * The product accepts several valid designs, so the catalogue must not ship a
   * reference answer or tell the learner which pattern to use.
   */
  it.each(SEED_PROBLEMS.map((problem) => [problem.slug, problem] as const))(
    "%s prescribes no solution",
    (_slug, seed) => {
      const prose = [
        seed.description,
        seed.context,
        ...seed.constraints,
        ...seed.requirements.flatMap((requirement) => [
          requirement.title,
          requirement.description,
        ]),
      ]
        .join(" ")
        .toLowerCase();

      for (const banned of [
        "strategy pattern",
        "state pattern",
        "observer pattern",
        "factory pattern",
        "you should create a class",
        "reference solution",
        "correct answer",
      ]) {
        expect(prose).not.toContain(banned);
      }
    },
  );
});
