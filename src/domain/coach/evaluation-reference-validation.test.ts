import { describe, expect, it } from "vitest";
import { filterKnownCriteria } from "./evaluation-reference-validation";

describe("filterKnownCriteria", () => {
  it("keeps a criterion the evaluation actually reported on", () => {
    const verified = filterKnownCriteria(["COUPLING"], ["COUPLING", "COHESION"]);

    expect(verified).toEqual(["COUPLING"]);
  });

  it("drops a criterion the evaluation never reported on, however plausible it looks", () => {
    // The model can spell a real-looking criterion name without the evaluation
    // having said anything about it; this is the check that stops that claim.
    const verified = filterKnownCriteria(["ABSTRACTION"], ["COUPLING"]);

    expect(verified).toEqual([]);
  });

  it("returns nothing when the evaluation reported on nothing", () => {
    expect(filterKnownCriteria(["COUPLING"], [])).toEqual([]);
  });

  it("does not report the same criterion twice even if claimed twice", () => {
    const verified = filterKnownCriteria(
      ["COUPLING", "COUPLING"],
      ["COUPLING"],
    );

    expect(verified).toEqual(["COUPLING"]);
  });

  it("preserves the order the criteria were claimed in", () => {
    const verified = filterKnownCriteria(
      ["COHESION", "COUPLING"],
      ["COUPLING", "COHESION"],
    );

    expect(verified).toEqual(["COHESION", "COUPLING"]);
  });
});
