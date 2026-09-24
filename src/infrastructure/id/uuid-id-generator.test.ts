import { describe, expect, it } from "vitest";
import { ID_PREFIXES } from "@/application/ports/id-generator";
import { UuidIdGenerator } from "./uuid-id-generator";

describe("UuidIdGenerator", () => {
  it.each(Object.values(ID_PREFIXES))("prefixes an id with %s", (prefix) => {
    const id = new UuidIdGenerator().generate(prefix);

    expect(id).toMatch(
      new RegExp(`^${prefix}_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`),
    );
  });

  it("does not repeat an id", () => {
    const generator = new UuidIdGenerator();
    const ids = new Set(
      Array.from({ length: 500 }, () => generator.generate(ID_PREFIXES.attempt)),
    );

    expect(ids.size).toBe(500);
  });
});
