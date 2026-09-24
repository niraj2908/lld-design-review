import type { IdGenerator, IdPrefix } from "@/application/ports/id-generator";

export class SequentialIdGenerator implements IdGenerator {
  private readonly counters = new Map<string, number>();

  generate(prefix: IdPrefix): string {
    const next = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, next);
    return `${prefix}_${String(next).padStart(3, "0")}`;
  }
}
