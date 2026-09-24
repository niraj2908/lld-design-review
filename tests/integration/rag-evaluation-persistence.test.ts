import { afterAll, describe, expect, it } from "vitest";
import { EvaluateAttempt } from "@/application/use-cases/evaluate-attempt";
import { IngestKnowledge } from "@/application/knowledge/ingest-knowledge";
import { KnowledgeContextBuilder } from "@/application/knowledge/knowledge-context-builder";
import { SemanticKnowledgeRetriever } from "@/application/knowledge/semantic-knowledge-retriever";
import { AIDesignEvaluator } from "@/evaluation-engine/ai/ai-design-evaluator";
import { HybridEvaluator } from "@/evaluation-engine/hybrid-evaluator";
import { RuleBasedEvaluator } from "@/evaluation-engine/rule-based-evaluator";
import { natureOf } from "@/domain/evaluation/review-criterion";
import { HashingEmbeddingProvider } from "@/infrastructure/ai/hashing-embedding-provider";
import { KNOWLEDGE_EMBEDDING_DIMENSIONS } from "@/infrastructure/knowledge/knowledge-dimensions";
import { PrismaKnowledgeRepository } from "@/infrastructure/knowledge/prisma-knowledge-repository";
import { KNOWLEDGE_DOCUMENTS } from "@/infrastructure/knowledge/seed/knowledge-catalogue";
import { designForProblem } from "@/testing/fixtures";
import { FakeLLMProvider } from "@/testing/fake-llm-provider";
import type { Problem } from "@/domain/problem/problem";
import {
  createIntegrationHarness,
  SEED_LEARNER_ID,
  seedAndLoadProblem,
} from "./harness";

const harness = createIntegrationHarness();

afterAll(async () => {
  await harness.prisma.$disconnect();
});

/** Real pgvector and real persistence; only the model and the embeddings are fake. */
const embeddings = new HashingEmbeddingProvider(KNOWLEDGE_EMBEDDING_DIMENSIONS);

const review = {
  criteria: [
    {
      criterion: "ABSTRACTION",
      assessment: "ADEQUATE",
      evidence: [{ entity: "PricingStrategy", field: "methods" }],
      concern: "The pricing seam matches a stated variation.",
      confidence: 0.68,
    },
  ],
  strengths: ["Pricing is a contract rather than a branch."],
  priorityImprovements: [
    {
      criterion: "ABSTRACTION",
      priority: "P2",
      what: "Exit settlement sits on the lot.",
      where: [{ entity: "ParkingLot", field: "methods", value: "exit" }],
      why: "Tariffs change independently of allocation.",
    },
  ],
  summary: "A sound decomposition with one boundary worth review.",
};

function pipeline(llm: FakeLLMProvider): EvaluateAttempt {
  const repository = new PrismaKnowledgeRepository(harness.prisma);
  const retriever = new SemanticKnowledgeRetriever(embeddings, repository);
  const knowledge = new KnowledgeContextBuilder(retriever);

  return new EvaluateAttempt({
    attempts: harness.repositories.attempts,
    problems: harness.repositories.problems,
    submissions: harness.repositories.submissions,
    evaluations: harness.repositories.evaluations,
    evaluator: new HybridEvaluator(
      new RuleBasedEvaluator(),
      new AIDesignEvaluator(llm, { knowledge }),
    ),
    ids: { generate: (prefix) => `${prefix}_rag_test` },
    clock: { now: () => new Date("2026-03-01T09:00:00.000Z") },
  });
}

async function ingestedProblem(): Promise<Problem> {
  const problem = await seedAndLoadProblem(harness);
  await new IngestKnowledge({
    embeddings,
    knowledge: new PrismaKnowledgeRepository(harness.prisma),
  }).execute(KNOWLEDGE_DOCUMENTS);
  return problem;
}

async function submittedAttempt(problem: Problem): Promise<string> {
  const started = await harness.useCases.startAttempt.execute({
    problemId: problem.id,
    learnerId: SEED_LEARNER_ID,
  });
  await harness.useCases.submitAttempt.execute({
    attemptId: started.attemptId,
    design: designForProblem(problem),
  });
  return started.attemptId;
}

describe("hybrid evaluation grounded in retrieved knowledge", () => {
  it("runs the whole pipeline and persists the evaluation", async () => {
    const problem = await ingestedProblem();
    const attemptId = await submittedAttempt(problem);
    const llm = FakeLLMProvider.answering(review, "some-model-id");

    const result = await pipeline(llm).execute({ attemptId });

    expect(result.evaluationStatus).toBe("COMPLETED");
    expect(result.attemptStatus).toBe("COMPLETED");
    expect(result.retrievedKnowledgeCount).toBeGreaterThan(0);
  });

  it("retrieves from the real store before asking the model", async () => {
    const problem = await ingestedProblem();
    const attemptId = await submittedAttempt(problem);
    const llm = FakeLLMProvider.answering(review);

    await pipeline(llm).execute({ attemptId });

    const { user } = llm.lastRequest;
    expect(user).toContain("REFERENCE MATERIAL");
    expect(user).toContain("[K1]");
    // Deterministic findings reached the prompt before the model saw it.
    expect(user).toContain("ALREADY ESTABLISHED BY THE STRUCTURAL CHECKER");
  });

  it("prefers guidance written for this problem", async () => {
    const problem = await ingestedProblem();
    const attemptId = await submittedAttempt(problem);
    const llm = FakeLLMProvider.answering(review);

    const result = await pipeline(llm).execute({ attemptId });
    const stored = await harness.repositories.evaluations.findById(
      result.evaluationId,
    );

    const titles = (stored?.outcome?.knowledgeCitations ?? []).map(
      (citation) => citation.title,
    );
    expect(titles.join(" | ")).toContain("parking lot problem");
  });

  it("persists one citation row per retrieved passage", async () => {
    const problem = await ingestedProblem();
    const attemptId = await submittedAttempt(problem);
    const llm = FakeLLMProvider.answering(review);

    const result = await pipeline(llm).execute({ attemptId });

    const rows = await harness.prisma.evaluationKnowledgeCitation.findMany({
      orderBy: { rank: "asc" },
    });
    expect(rows.length).toBe(result.retrievedKnowledgeCount);
    expect(rows[0]?.ref).toBe("K1");
    expect(rows[0]?.rank).toBe(1);
    expect(rows[0]?.chunkId).toMatch(/^kchk_/u);
    expect(rows[0]?.documentVersion).toBe("lld-kb-v1");
    expect(rows[0]?.embeddingModel).toBe("hashing-bag-of-words-v1");
    expect(rows[0]?.score).toBeGreaterThan(0);
  });

  it("stores no passage text, only what is needed to fetch it back", async () => {
    const problem = await ingestedProblem();
    const attemptId = await submittedAttempt(problem);

    await pipeline(FakeLLMProvider.answering(review)).execute({ attemptId });

    const row = await harness.prisma.evaluationKnowledgeCitation.findFirstOrThrow();
    const chunk = await harness.prisma.knowledgeChunk.findUniqueOrThrow({
      where: { id: row.chunkId },
    });

    expect(Object.keys(row)).not.toContain("content");
    // The chunk it points at is still there to be read.
    expect(chunk.content.length).toBeGreaterThan(0);
  });

  it("records the versions needed to reproduce the review", async () => {
    const problem = await ingestedProblem();
    const attemptId = await submittedAttempt(problem);

    const result = await pipeline(
      FakeLLMProvider.answering(review, "some-model-id"),
    ).execute({ attemptId });

    const row = await harness.prisma.evaluation.findFirstOrThrow();
    expect(row.evaluatorVersion).toBe("hybrid-v1");
    expect(row.promptVersion).toBe("ai-review-v2");
    expect(row.provider).toBe("fake");
    expect(row.model).toBe("some-model-id");
    expect(row.knowledgeVersion).toBe("lld-kb-v1");
    expect(row.embeddingModel).toBe("hashing-bag-of-words-v1");
    expect(JSON.stringify(row)).not.toMatch(/api[_-]?key/i);

    const stored = await harness.repositories.evaluations.findById(
      result.evaluationId,
    );
    expect(stored?.versions.knowledgeVersion).toBe("lld-kb-v1");
    expect(stored?.versions.embeddingModel).toBe("hashing-bag-of-words-v1");
  });

  it("keeps deterministic facts and semantic judgements distinguishable", async () => {
    const problem = await ingestedProblem();
    const attemptId = await submittedAttempt(problem);

    const result = await pipeline(FakeLLMProvider.answering(review)).execute({
      attemptId,
    });
    const stored = await harness.repositories.evaluations.findById(
      result.evaluationId,
    );

    const results = stored?.outcome?.criterionResults ?? [];
    expect(results.filter((entry) => natureOf(entry.criterion) === "FACTUAL")).toHaveLength(5);
    expect(results.filter((entry) => natureOf(entry.criterion) === "SEMANTIC")).toHaveLength(1);
    // The judge's result carries confidence; the facts do not.
    const semantic = results.find((entry) => natureOf(entry.criterion) === "SEMANTIC");
    expect(semantic?.confidence).toBeCloseTo(0.68, 5);
    for (const factual of results.filter(
      (entry) => natureOf(entry.criterion) === "FACTUAL",
    )) {
      expect(factual.confidence).toBeUndefined();
    }
  });

  it("keeps AI evidence pointing at the learner design, not at knowledge", async () => {
    const problem = await ingestedProblem();
    const attemptId = await submittedAttempt(problem);

    const result = await pipeline(FakeLLMProvider.answering(review)).execute({
      attemptId,
    });
    const stored = await harness.repositories.evaluations.findById(
      result.evaluationId,
    );

    const design = designForProblem(problem);
    const names = new Set([
      ...design.classes.map((entry) => entry.name),
      ...design.interfaces.map((entry) => entry.name),
    ]);
    for (const item of stored?.outcome?.priorityImprovements ?? []) {
      for (const evidence of item.where) {
        expect(names.has(evidence.entity)).toBe(true);
      }
    }
  });

  it("does not accumulate duplicate provenance when the same run is requested again", async () => {
    const problem = await ingestedProblem();
    const attemptId = await submittedAttempt(problem);
    const useCase = pipeline(FakeLLMProvider.answering(review));

    const first = await useCase.execute({ attemptId });
    const rowsAfterFirst = await harness.prisma.evaluationKnowledgeCitation.count();

    const { Attempt } = await import("@/domain/attempt/attempt");
    const attempt = await harness.repositories.attempts.findById(attemptId);
    await harness.repositories.attempts.update(
      Attempt.restore({ ...attempt!.toSnapshot(), status: "EVALUATING" }),
    );
    const second = await useCase.execute({ attemptId });

    expect(second.reused).toBe(true);
    expect(second.evaluationId).toBe(first.evaluationId);
    expect(await harness.prisma.evaluation.count()).toBe(1);
    expect(await harness.prisma.evaluationKnowledgeCitation.count()).toBe(
      rowsAfterFirst,
    );
  });

  it("replaces provenance rather than adding to it when a run is retried", async () => {
    const problem = await ingestedProblem();
    const attemptId = await submittedAttempt(problem);

    await expect(
      pipeline(FakeLLMProvider.timingOut(1_000)).execute({ attemptId }),
    ).rejects.toThrow(/can be retried/);
    expect(await harness.prisma.evaluationKnowledgeCitation.count()).toBe(0);

    await harness.useCases.retryEvaluation.execute({ attemptId });
    const result = await pipeline(FakeLLMProvider.answering(review)).execute({
      attemptId,
    });

    const rows = await harness.prisma.evaluationKnowledgeCitation.findMany({
      where: { evaluationId: result.evaluationId },
    });
    expect(rows.length).toBe(result.retrievedKnowledgeCount);
    expect(new Set(rows.map((row) => row.chunkId)).size).toBe(rows.length);
  });

  it("reviews without knowledge when the base is empty, saying so in the prompt", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attemptId = await submittedAttempt(problem);
    const llm = FakeLLMProvider.answering(review);

    const result = await pipeline(llm).execute({ attemptId });

    expect(result.evaluationStatus).toBe("COMPLETED");
    expect(result.retrievedKnowledgeCount).toBe(0);
    expect(llm.lastRequest.user).toContain(
      "No relevant reference knowledge was retrieved",
    );
    expect(await harness.prisma.evaluationKnowledgeCitation.count()).toBe(0);
    const row = await harness.prisma.evaluation.findFirstOrThrow();
    expect(row.knowledgeVersion).toBe("not-applicable");
    expect(row.embeddingModel).toBeNull();
  });
});
