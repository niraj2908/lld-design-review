import { describe, expect, it } from "vitest";
import { SystemClock } from "./system-clock";

describe("SystemClock", () => {
  it("reports the current time", () => {
    const before = Date.now();
    const now = new SystemClock().now().getTime();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });

  it("hands out a new Date each call, so a caller cannot mutate the clock", () => {
    const clock = new SystemClock();
    const first = clock.now();
    first.setFullYear(1999);

    expect(clock.now().getFullYear()).toBeGreaterThan(2000);
  });
});
