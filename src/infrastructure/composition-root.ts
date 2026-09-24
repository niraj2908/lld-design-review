import { EvaluateAttempt } from "@/application/use-cases/evaluate-attempt";
import { GetAttempt } from "@/application/use-cases/get-attempt";
import { GetAttemptHistory } from "@/application/use-cases/get-attempt-history";
import { RetryEvaluation } from "@/application/use-cases/retry-evaluation";
import { SaveDraft } from "@/application/use-cases/save-draft";
import { StartAttempt } from "@/application/use-cases/start-attempt";
import { SubmitAttempt } from "@/application/use-cases/submit-attempt";
import type { Clock } from "@/application/ports/clock";
import type { DesignEvaluator } from "@/application/ports/evaluator";
import { EmbeddingConfigurationError } from "@/application/ports/embedding-provider";
import type { EmbeddingProvider } from "@/application/ports/embedding-provider";
import type { KnowledgeRepository } from "@/application/ports/knowledge-repository";
import type { KnowledgeRetriever } from "@/application/ports/knowledge-retriever";
import { IngestKnowledge } from "@/application/knowledge/ingest-knowledge";
import { KnowledgeContextBuilder } from "@/application/knowledge/knowledge-context-builder";
import { SemanticKnowledgeRetriever } from "@/application/knowledge/semantic-knowledge-retriever";
import type { IdGenerator } from "@/application/ports/id-generator";
import { AIDesignEvaluator } from "@/evaluation-engine/ai/ai-design-evaluator";
import { HybridEvaluator } from "@/evaluation-engine/hybrid-evaluator";
import { RuleBasedEvaluator } from "@/evaluation-engine/rule-based-evaluator";
import { GroqLLMProvider } from "./ai/groq-llm-provider";
import { isGroqConfigured, readGroqConfig } from "./ai/groq-config";
import {
  allowsLocalEmbeddings,
  isEmbeddingConfigured,
  readEmbeddingConfig,
} from "./ai/embedding-config";
import { HashingEmbeddingProvider } from "./ai/hashing-embedding-provider";
import { OpenAICompatibleEmbeddingProvider } from "./ai/openai-compatible-embedding-provider";
import { PrismaKnowledgeRepository } from "./knowledge/prisma-knowledge-repository";
import { SystemClock } from "./clock/system-clock";
import { UuidIdGenerator } from "./id/uuid-id-generator";
import type { PrismaClient } from "./persistence/prisma/prisma-client";
import { PrismaAttemptRepository } from "./persistence/repositories/prisma-attempt-repository";
import { PrismaEvaluationRepository } from "./persistence/repositories/prisma-evaluation-repository";
import { PrismaProblemRepository } from "./persistence/repositories/prisma-problem-repository";
import { PrismaSubmissionRepository } from "./persistence/repositories/prisma-submission-repository";

export interface Repositories {
  readonly problems: PrismaProblemRepository;
  readonly attempts: PrismaAttemptRepository;
  readonly submissions: PrismaSubmissionRepository;
  readonly evaluations: PrismaEvaluationRepository;
}

export interface UseCases {
  readonly startAttempt: StartAttempt;
  readonly evaluateAttempt: EvaluateAttempt;
  readonly saveDraft: SaveDraft;
  readonly submitAttempt: SubmitAttempt;
  readonly getAttempt: GetAttempt;
  readonly getAttemptHistory: GetAttemptHistory;
  readonly retryEvaluation: RetryEvaluation;
}

export function createRepositories(prisma: PrismaClient): Repositories {
  return {
    problems: new PrismaProblemRepository(prisma),
    attempts: new PrismaAttemptRepository(prisma),
    submissions: new PrismaSubmissionRepository(prisma),
    evaluations: new PrismaEvaluationRepository(prisma),
  };
}

/**
 * The only place that knows both the use cases and the adapters that satisfy
 * their ports. Use cases receive interfaces, so swapping Prisma for another
 * store means editing this file and nothing above it.
 */
export function createUseCases(
  repositories: Repositories,
  dependencies: {
    readonly clock?: Clock;
    readonly ids?: IdGenerator;
    readonly evaluator?: DesignEvaluator;
  } = {},
): UseCases {
  const clock = dependencies.clock ?? new SystemClock();
  const ids = dependencies.ids ?? new UuidIdGenerator();
  const evaluator = dependencies.evaluator ?? createDefaultEvaluator();
  const { problems, attempts, submissions, evaluations } = repositories;

  return {
    startAttempt: new StartAttempt({ problems, attempts, ids, clock }),
    evaluateAttempt: new EvaluateAttempt({
      attempts,
      problems,
      submissions,
      evaluations,
      evaluator,
      ids,
      clock,
    }),
    saveDraft: new SaveDraft({ attempts, problems, clock }),
    submitAttempt: new SubmitAttempt({
      attempts,
      problems,
      submissions,
      ids,
      clock,
    }),
    getAttempt: new GetAttempt({ attempts, problems, submissions, evaluations }),
    getAttemptHistory: new GetAttemptHistory({
      attempts,
      problems,
      submissions,
      evaluations,
    }),
    retryEvaluation: new RetryEvaluation({
      attempts,
      submissions,
      evaluations,
      clock,
    }),
  };
}

/**
 * The deterministic evaluator alone, or both evaluators composed when a model is
 * configured.
 *
 * Falling back rather than failing is deliberate: structural review is the part
 * that must always work, and a missing key is a reason to review less, not a
 * reason to review nothing. This is the only place that decides which evaluators
 * run, and the only place that touches provider configuration.
 */
export function createDefaultEvaluator(
  env: Readonly<Record<string, string | undefined>> = process.env,
): DesignEvaluator {
  const deterministic = new RuleBasedEvaluator();
  if (!isGroqConfigured(env)) {
    return deterministic;
  }

  const provider = new GroqLLMProvider(readGroqConfig(env));
  return new HybridEvaluator(deterministic, new AIDesignEvaluator(provider));
}

/**
 * A real embedding service when one is configured.
 *
 * Without one, this falls back to local lexical embeddings outside production, so
 * ingestion, retrieval and the tests run with no key and no network; the fallback
 * reports its own model name, so a store filled that way is never mistaken for a
 * semantically embedded one. In production it refuses instead: silently retrieving
 * by word overlap while presenting cited passages would make the result
 * untrustworthy in a way nothing downstream could detect.
 */
export function createEmbeddingProvider(
  env: Readonly<Record<string, string | undefined>> = process.env,
): EmbeddingProvider {
  if (isEmbeddingConfigured(env)) {
    return new OpenAICompatibleEmbeddingProvider(readEmbeddingConfig(env));
  }

  if (!allowsLocalEmbeddings(env)) {
    throw new EmbeddingConfigurationError(
      "EMBEDDING_API_KEY is not set and local lexical embeddings are not permitted in production. Set EMBEDDING_API_KEY, or point EMBEDDING_BASE_URL at a local embedding service, before running knowledge retrieval in production.",
    );
  }

  return new HashingEmbeddingProvider();
}

export interface KnowledgeServices {
  readonly embeddings: EmbeddingProvider;
  readonly repository: KnowledgeRepository;
  readonly retriever: KnowledgeRetriever;
  readonly contextBuilder: KnowledgeContextBuilder;
  readonly ingest: IngestKnowledge;
}

/**
 * The knowledge layer assembled from its ports. The retriever and the context
 * builder contain no SQL and no vendor: only this function knows that the store is
 * pgvector and which embedding service is in use.
 */
export function createKnowledgeServices(
  prisma: PrismaClient,
  dependencies: {
    readonly embeddings?: EmbeddingProvider;
    readonly env?: Readonly<Record<string, string | undefined>>;
  } = {},
): KnowledgeServices {
  const embeddings =
    dependencies.embeddings ??
    createEmbeddingProvider(dependencies.env ?? process.env);
  const repository = new PrismaKnowledgeRepository(prisma);
  const retriever = new SemanticKnowledgeRetriever(embeddings, repository);

  return {
    embeddings,
    repository,
    retriever,
    contextBuilder: new KnowledgeContextBuilder(retriever),
    ingest: new IngestKnowledge({ embeddings, knowledge: repository }),
  };
}
