import { describe, expect, it } from "vitest";
import { Problem } from "@/domain/problem/problem";
import { PersistenceMappingError } from "../persistence-errors";
import { toProblem } from "./problem-mapper";
import type { ProblemRow } from "./rows";

const CREATED_AT = new Date("2026-01-01T00:00:00.000Z");

function problemRow(overrides: Partial<ProblemRow> = {}): ProblemRow {
  return {
    id: "prb_parking_lot",
    slug: "parking-lot",
    title: "Parking Lot",
    description: "Design the classes behind a parking lot.",
    context: "A single site with several levels.",
    constraints: ["Pricing changes independently of allocation."],
    acceptedSubmissionFormats: ["STRUCTURED_DESIGN"],
    version: 1,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    requirements: [
      {
        id: "req_2",
        problemId: "prb_parking_lot",
        code: "PL-REQ-02",
        title: "Fee",
        description: "Exit produces an amount owed.",
        priority: "MUST",
        position: 1,
      },
      {
        id: "req_1",
        problemId: "prb_parking_lot",
        code: "PL-REQ-01",
        title: "Allocation",
        description: "A vehicle gets a compatible spot.",
        priority: "MUST",
        position: 0,
      },
    ],
    rubric: {
      version: "parking-lot-v1",
      criteria: [
        {
          criterion: "RESPONSIBILITY",
          weight: 0.5,
          guidance: "Is each responsibility well placed?",
          position: 1,
        },
        {
          criterion: "REQUIREMENT_UNDERSTANDING",
          weight: 0.5,
          guidance: "Are the requirements addressed?",
          position: 0,
        },
      ],
    },
    ...overrides,
  };
}

describe("problem mapper", () => {
  it("builds a domain Problem from a row", () => {
    const problem = toProblem(problemRow());

    expect(problem).toBeInstanceOf(Problem);
    expect(problem.slug).toBe("parking-lot");
    expect(problem.constraints).toHaveLength(1);
  });

  it("restores requirements and rubric criteria in stored order", () => {
    const problem = toProblem(problemRow());

    expect(problem.requirements.map((entry) => entry.code)).toEqual([
      "PL-REQ-01",
      "PL-REQ-02",
    ]);
    expect(problem.rubric.criteria.map((entry) => entry.criterion)).toEqual([
      "REQUIREMENT_UNDERSTANDING",
      "RESPONSIBILITY",
    ]);
  });

  it("refuses a problem row with no rubric", () => {
    expect(() => toProblem(problemRow({ rubric: null }))).toThrow(
      PersistenceMappingError,
    );
  });

  it("re-applies domain invariants, so an invalid row fails loudly", () => {
    expect(() => toProblem(problemRow({ requirements: [] }))).toThrow(
      /at least one explicit requirement/,
    );
    expect(() => toProblem(problemRow({ slug: "Parking Lot" }))).toThrow();
  });

  it("does not hand back the row's own arrays", () => {
    const row = problemRow();
    const problem = toProblem(row);

    expect(problem.constraints).not.toBe(row.constraints);
    expect(problem.acceptedSubmissionFormats).not.toBe(
      row.acceptedSubmissionFormats,
    );
  });
});
