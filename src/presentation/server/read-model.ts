import { getApiServices } from "../api/services";
import {
  toAttemptListItem,
  toAttemptResponse,
  toEvaluationResponse,
  toProblemListItem,
  toProblemResponse,
} from "../api/dto";
import type {
  AttemptListItemResponse,
  AttemptResponse,
  EvaluationResponse,
  ProblemListItemResponse,
  ProblemResponse,
} from "../api/dto";
import { toAttemptComparisonResponse } from "../api/comparison-dto";
import type { AttemptComparisonResponse } from "../api/comparison-dto";
import type { StructuredDesign } from "@/domain/design/structured-design";
import type { EvaluationStatus } from "@/domain/evaluation/evaluation-status";

/**
 * What the server-rendered pages read.
 *
 * Server components call the same application use cases the API routes call, and map
 * with the same DTO functions — an HTTP hop back into our own process would add a
 * round trip and an absolute URL for no gain. What they do not do is reach for a
 * repository or a Prisma client: every read goes through a use case, so a page cannot
 * grow a rule that nothing tests.
 */
export async function readProblems(): Promise<
  readonly ProblemListItemResponse[]
> {
  const services = getApiServices();
  const { problems } = await services.listProblems.execute();
  return problems.map(toProblemListItem);
}

export async function readProblem(
  problemRef: string,
): Promise<ProblemResponse | null> {
  const services = getApiServices();
  try {
    return toProblemResponse(await services.getProblem.execute({ problemRef }));
  } catch {
    // A page renders "not found" rather than an error for a bad reference.
    return null;
  }
}

export async function readAttempts(): Promise<
  readonly AttemptListItemResponse[]
> {
  const services = getApiServices();
  const { attempts } = await services.listAttempts.execute({
    learnerId: services.learnerId,
  });
  return attempts.map(toAttemptListItem);
}

export interface AttemptWorkspace {
  readonly attempt: AttemptResponse;
  readonly problem: ProblemResponse;
  readonly design: StructuredDesign | null;
  readonly evaluationStatus: EvaluationStatus | null;
  readonly hasSubmission: boolean;
}

export async function readAttemptWorkspace(
  attemptId: string,
): Promise<AttemptWorkspace | null> {
  const services = getApiServices();
  try {
    const result = await services.getAttempt.execute({ attemptId });
    if (result.attempt.learnerId !== services.learnerId) {
      return null;
    }
    const problem = await services.getProblem.execute({
      problemRef: result.attempt.problemId,
    });

    return {
      attempt: toAttemptResponse(result.attempt),
      problem: toProblemResponse(problem),
      design:
        result.attempt.draftDesign ?? result.latestSubmission?.payload ?? null,
      evaluationStatus: result.latestEvaluation?.status ?? null,
      hasSubmission: result.latestSubmission !== null,
    };
  } catch {
    return null;
  }
}

export interface AttemptReview {
  readonly attempt: AttemptResponse;
  readonly problem: ProblemResponse;
  readonly evaluation: EvaluationResponse | null;
}

export async function readAttemptReview(
  attemptId: string,
): Promise<AttemptReview | null> {
  const services = getApiServices();
  try {
    const result = await services.getAttempt.execute({ attemptId });
    if (result.attempt.learnerId !== services.learnerId) {
      return null;
    }
    const problem = await services.getProblem.execute({
      problemRef: result.attempt.problemId,
    });

    return {
      attempt: toAttemptResponse(result.attempt),
      problem: toProblemResponse(problem),
      evaluation:
        result.latestEvaluation === null
          ? null
          : toEvaluationResponse(result.latestEvaluation),
    };
  } catch {
    return null;
  }
}

export type AttemptComparisonRead =
  | { readonly ok: true; readonly data: AttemptComparisonResponse }
  | { readonly ok: false; readonly code: string; readonly message: string };

/**
 * The comparison page's own read, distinct from the others above: a failed
 * comparison is not "not found", it is one of a small number of named reasons
 * (the same attempt twice, two different problems, a missing or unowned
 * attempt), and the page has real, different things to say for each — so this
 * keeps the failure's code rather than flattening every failure into `null`.
 */
/**
 * Codes this function recognises well enough to trust their own message —
 * exactly the ones `CompareAttempts` itself throws, each written to be shown to
 * a learner. Anything else (an infrastructure error that reached here
 * untranslated, for instance) gets a fixed, safe message instead: `.message` on
 * an arbitrary `Error` is not vetted for what it might contain, the same reason
 * `http-error.ts` never shows one for a code it does not recognise.
 */
const KNOWN_COMPARISON_ERROR_CODES = new Set([
  "ATTEMPT_NOT_FOUND",
  "PROBLEM_NOT_FOUND",
  "COMPARISON_INVALID",
]);

export async function readAttemptComparison(
  attemptId: string,
  otherAttemptId: string,
): Promise<AttemptComparisonRead> {
  const services = getApiServices();
  try {
    const result = await services.compareAttempts.execute({
      attemptAId: attemptId,
      attemptBId: otherAttemptId,
      learnerId: services.learnerId,
    });
    return { ok: true, data: toAttemptComparisonResponse(result) };
  } catch (error) {
    const code = codeOf(error);
    return {
      ok: false,
      code,
      message:
        KNOWN_COMPARISON_ERROR_CODES.has(code) && error instanceof Error
          ? error.message
          : "The comparison could not be completed.",
    };
  }
}

function codeOf(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return "INTERNAL_ERROR";
  }
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === "string" ? code : "INTERNAL_ERROR";
}
