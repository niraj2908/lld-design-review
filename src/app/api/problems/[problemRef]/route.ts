import { handleGetProblem } from "@/presentation/api/handlers";
import { getApiServices } from "@/presentation/api/services";

export async function GET(
  _request: Request,
  context: { readonly params: Promise<{ readonly problemRef: string }> },
): Promise<Response> {
  const { problemRef } = await context.params;
  return handleGetProblem(getApiServices(), problemRef);
}
