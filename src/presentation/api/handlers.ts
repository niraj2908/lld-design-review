import { AttemptNotFoundError } from "@/application/errors";
import type { UseCases } from "@/infrastructure/composition-root";
import type { ListAttempts } from "@/application/use-cases/list-attempts";
import type { GetProblem } from "@/application/use-cases/get-problem";
import type { ListProblems } from "@/application/use-cases/list-problems";
import {
  toAttemptListItem,
  toAttemptResponse,
  toEvaluationResponse,
  toIssueResponse,
  toProblemListItem,
  toProblemResponse,
  toSubmissionResponse,
} from "./dto";
import { toAttemptComparisonResponse } from "./comparison-dto";
import { idSchema, saveDraftSchema, submitSchema } from "./design-schema";
import { json, toErrorResponse } from "./http-error";

/**
 * Everything the API layer is allowed to reach.
 *
 * It is the composition root's output plus the two read use cases the screens need;
 * no repository, no Prisma client, no provider. A handler that wanted one would have
 * to change this type, which is the point.
 */
export interface ApiServices extends UseCases {
  readonly listProblems: ListProblems;
  readonly getProblem: GetProblem;
  readonly listAttempts: ListAttempts;
  /** The single seeded learner this MVP runs as; there is no authentication. */
  readonly learnerId: string;
}

/**
 * Request in, response out.
 *
 * Each handler parses, delegates to one use case, maps the result to a DTO and
 * returns. No branch here decides anything about a design, an attempt's lifecycle or
 * an evaluation — those live in the application and domain layers, where they are
 * tested without HTTP.
 */
export async function handleListProblems(
  services: ApiServices,
): Promise<Response> {
  try {
    const { problems } = await services.listProblems.execute();
    return json(200, { problems: problems.map(toProblemListItem) });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function handleGetProblem(
  services: ApiServices,
  problemRef: string,
): Promise<Response> {
  try {
    const ref = idSchema.parse(problemRef);
    const problem = await services.getProblem.execute({ problemRef: ref });
    return json(200, { problem: toProblemResponse(problem) });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function handleStartAttempt(
  services: ApiServices,
  problemRef: string,
): Promise<Response> {
  try {
    const ref = idSchema.parse(problemRef);
    // Accepts a slug as well as an id, so a link from the problem page works.
    const problem = await services.getProblem.execute({ problemRef: ref });
    const started = await services.startAttempt.execute({
      problemId: problem.id,
      learnerId: services.learnerId,
    });
    const attempt = await services.getAttempt.execute({
      attemptId: started.attemptId,
    });

    return json(201, { attempt: toAttemptResponse(attempt.attempt) });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function handleListAttempts(
  services: ApiServices,
): Promise<Response> {
  try {
    const { attempts } = await services.listAttempts.execute({
      learnerId: services.learnerId,
    });
    return json(200, { attempts: attempts.map(toAttemptListItem) });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function handleGetAttempt(
  services: ApiServices,
  attemptId: string,
): Promise<Response> {
  try {
    const id = idSchema.parse(attemptId);
    const result = await services.getAttempt.execute({ attemptId: id });
    assertOwnership(services, id, result.attempt.learnerId);

    const problem = await services.getProblem.execute({
      problemRef: result.attempt.problemId,
    });

    return json(200, {
      attempt: toAttemptResponse(result.attempt),
      problem: {
        id: problem.id,
        slug: problem.slug,
        title: problem.title,
        requirements: toProblemResponse(problem).requirements,
      },
      // Before submission the workspace edits the draft; afterwards it shows what
      // was submitted, which is frozen.
      design:
        result.attempt.draftDesign ?? result.latestSubmission?.payload ?? null,
      submission:
        result.latestSubmission === null
          ? null
          : toSubmissionResponse(result.latestSubmission),
      evaluationStatus: result.latestEvaluation?.status ?? null,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function handleSaveDraft(
  services: ApiServices,
  attemptId: string,
  request: Request,
): Promise<Response> {
  try {
    const id = idSchema.parse(attemptId);
    const body = saveDraftSchema.parse(await readJson(request));
    await assertOwnedAttempt(services, id);

    const result = await services.saveDraft.execute({
      attemptId: id,
      design: body.design,
    });

    return json(200, {
      attemptId: result.attemptId,
      design: result.design,
      issues: result.issues.map(toIssueResponse),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function handleSubmitAttempt(
  services: ApiServices,
  attemptId: string,
  request: Request,
): Promise<Response> {
  try {
    const id = idSchema.parse(attemptId);
    const body = submitSchema.parse(await readJson(request));
    await assertOwnedAttempt(services, id);

    const result = await services.submitAttempt.execute({
      attemptId: id,
      ...(body.design === undefined ? {} : { design: body.design }),
    });

    return json(201, {
      submission: {
        id: result.submissionId,
        attemptId: result.attemptId,
        version: result.submissionVersion,
      },
      attemptStatus: result.status,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function handleEvaluateAttempt(
  services: ApiServices,
  attemptId: string,
): Promise<Response> {
  try {
    const id = idSchema.parse(attemptId);
    await assertOwnedAttempt(services, id);

    const result = await services.evaluateAttempt.execute({ attemptId: id });
    const evaluation = await services.getAttempt.execute({ attemptId: id });

    // `reused` is the existing idempotency guard surfacing: a refresh that re-posts
    // returns the stored evaluation instead of paying for another one.
    return json(result.reused ? 200 : 201, {
      evaluationId: result.evaluationId,
      status: result.evaluationStatus,
      attemptStatus: result.attemptStatus,
      reused: result.reused,
      retrievedKnowledgeCount: result.retrievedKnowledgeCount,
      evaluation:
        evaluation.latestEvaluation === null
          ? null
          : toEvaluationResponse(evaluation.latestEvaluation),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function handleGetEvaluation(
  services: ApiServices,
  attemptId: string,
): Promise<Response> {
  try {
    const id = idSchema.parse(attemptId);
    const result = await services.getAttempt.execute({ attemptId: id });
    assertOwnership(services, id, result.attempt.learnerId);

    if (result.latestEvaluation === null) {
      return json(200, {
        attemptStatus: result.attempt.status,
        evaluation: null,
      });
    }

    return json(200, {
      attemptStatus: result.attempt.status,
      evaluation: toEvaluationResponse(result.latestEvaluation),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function handleRetryEvaluation(
  services: ApiServices,
  attemptId: string,
): Promise<Response> {
  try {
    const id = idSchema.parse(attemptId);
    await assertOwnedAttempt(services, id);

    const prepared = await services.retryEvaluation.execute({ attemptId: id });
    const result = await services.evaluateAttempt.execute({ attemptId: id });

    return json(200, {
      evaluationId: prepared.evaluationId,
      status: result.evaluationStatus,
      attemptStatus: result.attemptStatus,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * Design evolution between two of the learner's own attempts.
 *
 * Ownership is not checked here before delegating, unlike the single-attempt
 * handlers above: `CompareAttempts` takes the learner id itself and enforces both
 * attempts belong to it before anything else runs, because this is a
 * cross-attempt read and the guard belongs where both ids are already in hand.
 */
export async function handleCompareAttempts(
  services: ApiServices,
  attemptId: string,
  otherAttemptId: string,
): Promise<Response> {
  try {
    const attemptAId = idSchema.parse(attemptId);
    const attemptBId = idSchema.parse(otherAttemptId);

    const result = await services.compareAttempts.execute({
      attemptAId,
      attemptBId,
      learnerId: services.learnerId,
    });

    return json(200, toAttemptComparisonResponse(result));
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * There is no authentication in this MVP, but there is one learner, and an attempt
 * that belongs to someone else is not found rather than forbidden — the distinction
 * would itself disclose that the attempt exists.
 */
function assertOwnership(
  services: ApiServices,
  attemptId: string,
  learnerId: string,
): void {
  if (learnerId !== services.learnerId) {
    throw new AttemptNotFoundError(attemptId);
  }
}

async function assertOwnedAttempt(
  services: ApiServices,
  attemptId: string,
): Promise<void> {
  const result = await services.getAttempt.execute({ attemptId });
  assertOwnership(services, attemptId, result.attempt.learnerId);
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    // A body that is not JSON is an invalid request, not a server fault.
    return {};
  }
}
