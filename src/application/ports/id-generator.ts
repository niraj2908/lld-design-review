export const ID_PREFIXES = {
  attempt: "att",
  submission: "sub",
  evaluation: "evl",
  feedback: "fbk",
} as const;

export type IdPrefix = (typeof ID_PREFIXES)[keyof typeof ID_PREFIXES];

export interface IdGenerator {
  generate(prefix: IdPrefix): string;
}
