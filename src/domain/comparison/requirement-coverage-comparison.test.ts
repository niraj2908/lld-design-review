import { describe, expect, it } from "vitest";
import type { Requirement } from "../problem/requirement";
import { emptyStructuredDesign } from "../design/structured-design";
import type { StructuredDesign } from "../design/structured-design";
import { compareRequirementCoverage } from "./requirement-coverage-comparison";

const REQUIREMENTS: readonly Requirement[] = [
  {
    id: "req_1",
    problemId: "prb_1",
    code: "PL-REQ-01",
    title: "Compatible spot allocation",
    description: "...",
    priority: "MUST",
  },
  {
    id: "req_2",
    problemId: "prb_1",
    code: "PL-REQ-02",
    title: "Fee for time parked",
    description: "...",
    priority: "MUST",
  },
];

function designMapping(
  requirementId: string,
  hasReference = true,
): StructuredDesign {
  return {
    ...emptyStructuredDesign(),
    requirementMappings: [
      {
        requirementId,
        references: hasReference ? [{ entity: "ParkingLot" }] : [],
      },
    ],
  };
}

describe("compareRequirementCoverage", () => {
  it("reports a requirement newly covered", () => {
    const [change] = compareRequirementCoverage(
      [REQUIREMENTS[0]!],
      emptyStructuredDesign(),
      designMapping("req_1"),
    );

    expect(change).toMatchObject({
      transition: "UNCOVERED_TO_COVERED",
      changed: true,
    });
  });

  it("reports coverage lost", () => {
    const [change] = compareRequirementCoverage(
      [REQUIREMENTS[0]!],
      designMapping("req_1"),
      emptyStructuredDesign(),
    );

    expect(change).toMatchObject({
      transition: "COVERED_TO_UNCOVERED",
      changed: true,
    });
  });

  it("reports unchanged coverage on both sides", () => {
    const covered = compareRequirementCoverage(
      [REQUIREMENTS[0]!],
      designMapping("req_1"),
      designMapping("req_1"),
    );
    const uncovered = compareRequirementCoverage(
      [REQUIREMENTS[0]!],
      emptyStructuredDesign(),
      emptyStructuredDesign(),
    );

    expect(covered[0]).toMatchObject({ transition: "COVERED_TO_COVERED", changed: false });
    expect(uncovered[0]).toMatchObject({
      transition: "UNCOVERED_TO_UNCOVERED",
      changed: false,
    });
  });

  it("does not count a mapping with no references as coverage", () => {
    const [change] = compareRequirementCoverage(
      [REQUIREMENTS[0]!],
      emptyStructuredDesign(),
      designMapping("req_1", false),
    );

    expect(change).toMatchObject({ coveredAfter: false });
  });

  it("ignores a mapping for a requirement the current problem does not have", () => {
    // The exact class of bug found in milestone 7: a design can carry a mapping
    // for a requirement id that is not (or no longer) one of this problem's own,
    // and it must never inflate coverage on either side of a comparison.
    const stale = designMapping("req_does_not_exist");

    const changes = compareRequirementCoverage(REQUIREMENTS, stale, stale);

    expect(changes.every((change) => !change.coveredBefore && !change.coveredAfter)).toBe(
      true,
    );
  });

  it("reports every current requirement, even when neither design mentions it", () => {
    const changes = compareRequirementCoverage(
      REQUIREMENTS,
      emptyStructuredDesign(),
      emptyStructuredDesign(),
    );

    expect(changes).toHaveLength(REQUIREMENTS.length);
    expect(changes.map((change) => change.requirementId)).toEqual(
      REQUIREMENTS.map((requirement) => requirement.id),
    );
  });
});
