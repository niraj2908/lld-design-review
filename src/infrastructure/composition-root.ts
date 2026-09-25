import { AskDesignCoach } from "@/application/use-cases/ask-design-coach";
import { CompareAttempts } from "@/application/use-cases/compare-attempts";
import { EvaluateAttempt } from "@/application/use-cases/evaluate-attempt";
import { GetAttempt } from "@/application/use-cases/get-attempt";
import { GetAttemptHistory } from "@/application/use-cases/get-attempt-history";
import { RetryEvaluation } from "@/application/use-cases/retry-evaluation";
import { SaveDraft } from "@/application/use-cases/save-draft";
import { StartAttempt } from "@/application/use-cases/start-attempt";
import { SubmitAttempt } from "@/application/use-cases/submit-attempt";
import type { Clock } from "@/application/ports/clock";
import type { DesignCoach } from "@/application/ports/design-coach";
import type { DesignEvaluator } from "@/application/ports/evaluator";
import type { KnowledgeContextProvider } from "@/application/ports/knowledge-context";
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
import { LLMDesignCoach } from "@/coach-engine/design-coach";
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
  readonly compareAttempts: CompareAttempts;
  readonly askDesignCoach: AskDesignCoach;
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
    /** `undefined` is a valid, meaningful value here — it means no coach is configured. */
    readonly coach?: DesignCoach | undefined;
  } = {},
): UseCases {
  const clock = dependencies.clock ?? new SystemClock();
  const ids = dependencies.ids ?? new UuidIdGenerator();
  const evaluator = dependencies.evaluator ?? createDefaultEvaluator();
  const coach =
    "coach" in dependencies ? dependencies.coach : createDesignCoachIfAvailable();
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
    compareAttempts: new CompareAttempts({
      attempts,
      problems,
      submissions,
      evaluations,
    }),
    askDesignCoach: new AskDesignCoach({
      attempts,
      problems,
      submissions,
      evaluations,
      coach,
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
  knowledge: KnowledgeContextProvider | undefined = undefined,
): DesignEvaluator {
  const deterministic = new RuleBasedEvaluator();
  if (!isGroqConfigured(env)) {
    return deterministic;
  }

  const provider = new GroqLLMProvider(readGroqConfig(env));
  const judge =
    knowledge === undefined
      ? new AIDesignEvaluator(provider)
      : new AIDesignEvaluator(provider, { knowledge });

  return new HybridEvaluator(deterministic, judge);
}

/**
 * The design coach when a model is configured, and `undefined` otherwise.
 *
 * Unlike the evaluator, there is no deterministic fallback to offer instead:
 * coaching is inherently a conversation with a model, so the absence of one
 * means the absence of a coach, not a lesser one. Callers are expected to turn
 * `undefined` into a clear "not available" answer rather than treating it as a
 * configuration bug — see `CoachNotAvailableError`.
 */
export function createDesignCoachIfAvailable(
  env: Readonly<Record<string, string | undefined>> = process.env,
  knowledge: KnowledgeContextProvider | undefined = undefined,
): DesignCoach | undefined {
  if (!isGroqConfigured(env)) {
    return undefined;
  }

  const provider = new GroqLLMProvider(readGroqConfig(env));
  return knowledge === undefined
    ? new LLMDesignCoach(provider)
    : new LLMDesignCoach(provider, { knowledge });
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

/**
 * The knowledge layer when the environment can actually provide embeddings, and
 * `undefined` when it cannot.
 *
 * Callers outside infrastructure must not have to know which environment variables
 * decide that, nor that milestone 5 forbids lexical embeddings in production, so the
 * question is asked here. It is asked rather than answered by catching a throw from
 * `createEmbeddingProvider`: catching would also swallow a genuine misconfiguration
 * of a key that *is* present, and an application-wide review would then quietly run
 * ungrounded for the wrong reason.
 */
export function createKnowledgeServicesIfAvailable(
  prisma: PrismaClient,
  env: Readonly<Record<string, string | undefined>> = process.env,
): KnowledgeServices | undefined {
  if (!isEmbeddingConfigured(env) && !allowsLocalEmbeddings(env)) {
    return undefined;
  }
  return createKnowledgeServices(prisma, { env });
}
