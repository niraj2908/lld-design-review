import { describe, expect, it } from "vitest";
import { FEEDBACK_PRIORITIES, isGrounded } from "./feedback-item";
import type { FeedbackItem } from "./feedback-item";

const ITEM: FeedbackItem = {
  id: "fbk_001",
  priority: "P1",
  criterion: "RESPONSIBILITY",
  what: "Pricing logic is concentrated in ParkingLot.",
  where: [{ entity: "ParkingLot", field: "methods", value: "calculateFee" }],
  why: "Pricing rules may vary independently of parking operations.",
  reconsider: "Could pricing sit behind a policy abstraction?",
};

describe("feedback items", () => {
  it("ranks feedback from requirement violations down to optional refinements", () => {
    expect([...FEEDBACK_PRIORITIES]).toEqual(["P0", "P1", "P2", "P3"]);
  });

  it("treats an item with evidence as grounded", () => {
    expect(isGrounded(ITEM)).toBe(true);
  });

  it("treats an item with no evidence as ungrounded, so it can be filtered out", () => {
    expect(isGrounded({ ...ITEM, where: [] })).toBe(false);
  });
});
