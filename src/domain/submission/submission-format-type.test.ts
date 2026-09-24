import { describe, expect, it } from "vitest";
import {
  STRUCTURED_DESIGN,
  SUBMISSION_FORMAT_TYPES,
  isSubmissionFormatType,
} from "./submission-format-type";

describe("submission format types", () => {
  it("offers structured design as the only MVP format", () => {
    expect([...SUBMISSION_FORMAT_TYPES]).toEqual(["STRUCTURED_DESIGN"]);
    expect(STRUCTURED_DESIGN).toBe("STRUCTURED_DESIGN");
  });

  it("recognises a known format", () => {
    expect(isSubmissionFormatType("STRUCTURED_DESIGN")).toBe(true);
  });

  it.each(["DIAGRAM", "CODE", "", null, 3])("rejects %s", (value) => {
    expect(isSubmissionFormatType(value)).toBe(false);
  });
});
