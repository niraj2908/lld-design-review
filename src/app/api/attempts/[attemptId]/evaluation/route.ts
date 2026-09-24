import { handleGetEvaluation } from "@/presentation/api/handlers";
import { getApiServices } from "@/presentation/api/services";

export async function GET(
  _request: Request,
  context: { readonly params: Promise<{ readonly attemptId: string }> },
): Promise<Response> {
  const { attemptId } = await context.params;
  return handleGetEvaluation(getApiServices(), attemptId);
}
