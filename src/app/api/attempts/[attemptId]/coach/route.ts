import { handleAskDesignCoach } from "@/presentation/api/handlers";
import { getApiServices } from "@/presentation/api/services";

export async function POST(
  request: Request,
  context: { readonly params: Promise<{ readonly attemptId: string }> },
): Promise<Response> {
  const { attemptId } = await context.params;
  return handleAskDesignCoach(getApiServices(), attemptId, request);
}
