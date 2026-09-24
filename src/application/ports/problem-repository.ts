import type { Problem } from "@/domain/problem/problem";

export interface ProblemRepository {
  findById(problemId: string): Promise<Problem | null>;
  findBySlug(slug: string): Promise<Problem | null>;
  findAll(): Promise<readonly Problem[]>;
}
