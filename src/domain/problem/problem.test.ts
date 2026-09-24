import { describe, expect, it } from "vitest";
import { PARKING_LOT_REQUIREMENTS, parkingLotProblem } from "@/testing/fixtures";
import { DuplicateEntityError, InvalidProblemError } from "../shared/errors";
import { STRUCTURED_DESIGN } from "../submission/submission-format-type";

describe("Problem", () => {
  it("creates a problem with explicit requirements", () => {
    const problem = parkingLotProblem();

    expect(problem.slug).toBe("parking-lot");
    expect(problem.requirementIds).toEqual(["req_pl_01", "req_pl_02"]);
    expect(problem.hasRequirement("req_pl_01")).toBe(true);
    expect(problem.hasRequirement("req_vending_01")).toBe(false);
  });

  it("refuses a problem with no requirements, because evaluation reasons from them", () => {
    expect(() => parkingLotProblem({ requirements: [] })).toThrow(
      InvalidProblemError,
    );
  });

  it("refuses a problem with no accepted submission format", () => {
    expect(() =>
      parkingLotProblem({ acceptedSubmissionFormats: [] }),
    ).toThrow(InvalidProblemError);
  });

  it("refuses a rubric with no criteria", () => {
    expect(() =>
      parkingLotProblem({ rubric: { version: "v1", criteria: [] } }),
    ).toThrow(InvalidProblemError);
  });

  it.each(["Parking Lot", "parking_lot", "-parking", "Parking-Lot"])(
    "refuses slug %s",
    (slug) => {
      expect(() => parkingLotProblem({ slug })).toThrow(InvalidProblemError);
    },
  );

  it("refuses duplicate requirement codes", () => {
    const duplicated = [
      PARKING_LOT_REQUIREMENTS[0]!,
      { ...PARKING_LOT_REQUIREMENTS[1]!, code: "PL-REQ-01" },
    ];

    expect(() => parkingLotProblem({ requirements: duplicated })).toThrow(
      DuplicateEntityError,
    );
  });

  it("refuses duplicate requirement ids", () => {
    const duplicated = [
      PARKING_LOT_REQUIREMENTS[0]!,
      { ...PARKING_LOT_REQUIREMENTS[1]!, id: "req_pl_01" },
    ];

    expect(() => parkingLotProblem({ requirements: duplicated })).toThrow(
      DuplicateEntityError,
    );
  });

  it("refuses a requirement that belongs to another problem", () => {
    const foreign = [
      { ...PARKING_LOT_REQUIREMENTS[0]!, problemId: "prb_vending_machine" },
    ];

    expect(() => parkingLotProblem({ requirements: foreign })).toThrow(
      /belongs to problem/,
    );
  });

  it.each([0, -1, 1.2])("refuses version %s", (version) => {
    expect(() => parkingLotProblem({ version })).toThrow(InvalidProblemError);
  });

  it("accepts only its declared submission formats", () => {
    const problem = parkingLotProblem();

    expect(problem.accepts(STRUCTURED_DESIGN)).toBe(true);
  });

  it("finds a requirement by its learner-facing code", () => {
    const problem = parkingLotProblem();

    expect(problem.requirementByCode("PL-REQ-02")?.id).toBe("req_pl_02");
    expect(problem.requirementByCode("PL-REQ-99")).toBeUndefined();
  });
});
