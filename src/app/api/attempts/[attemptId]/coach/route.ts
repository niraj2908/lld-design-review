import { handleAskDesignCoach } from "@/presentation/api/handlers";
import { getApiServices } from "@/presentation/api/services";

/**
 * Room for one full Groq call at the configured `GROQ_TIMEOUT_MS` (45s default,
 * `src/infrastructure/ai/groq-config.ts`) plus retrieval and evidence validation,
 * without exceeding Vercel's Hobby-plan ceiling — so this value stays correct
 * regardless of which plan the deployment runs on.
 */
export const maxDuration = 60;

export async function POST(
  request: Request,
  context: { readonly params: Promise<{ readonly attemptId: string }> },
): Promise<Response> {
  const { attemptId } = await context.params;
  return handleAskDesignCoach(getApiServices(), attemptId, request);
}
