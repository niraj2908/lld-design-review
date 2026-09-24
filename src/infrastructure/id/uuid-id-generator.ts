import { randomUUID } from "node:crypto";
import type { IdGenerator, IdPrefix } from "@/application/ports/id-generator";

/**
 * Ids carry their prefix (`att_`, `sub_`, `evl_`) so a value found in a log or a
 * URL identifies what it points at without a lookup.
 */
export class UuidIdGenerator implements IdGenerator {
  generate(prefix: IdPrefix): string {
    return `${prefix}_${randomUUID()}`;
  }
}
