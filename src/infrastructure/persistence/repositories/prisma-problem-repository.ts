import type { ProblemRepository } from "@/application/ports/problem-repository";
import type { Problem } from "@/domain/problem/problem";
import { toProblem } from "../mappers/problem-mapper";
import { withTranslatedErrors } from "../persistence-errors";
import type { PrismaClient } from "../prisma/prisma-client";
import { PROBLEM_INCLUDE } from "./include";

export class PrismaProblemRepository implements ProblemRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(problemId: string): Promise<Problem | null> {
    const row = await withTranslatedErrors("problem.findById", () =>
      this.prisma.problem.findUnique({
        where: { id: problemId },
        include: PROBLEM_INCLUDE,
      }),
    );
    return row === null ? null : toProblem(row);
  }

  async findBySlug(slug: string): Promise<Problem | null> {
    const row = await withTranslatedErrors("problem.findBySlug", () =>
      this.prisma.problem.findUnique({
        where: { slug },
        include: PROBLEM_INCLUDE,
      }),
    );
    return row === null ? null : toProblem(row);
  }

  async findAll(): Promise<readonly Problem[]> {
    const rows = await withTranslatedErrors("problem.findAll", () =>
      this.prisma.problem.findMany({
        include: PROBLEM_INCLUDE,
        orderBy: { slug: "asc" },
      }),
    );
    return rows.map(toProblem);
  }
}
