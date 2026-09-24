export const KNOWLEDGE_TOPICS = [
  "OOP",
  "SOLID",
  "PATTERN",
  "DESIGN_SMELL",
  "LLD_REASONING",
  "PROBLEM_GUIDANCE",
] as const;

export type KnowledgeTopic = (typeof KNOWLEDGE_TOPICS)[number];
