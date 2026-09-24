import { handleSaveDraft } from "@/presentation/api/handlers";
import { getApiServices } from "@/presentation/api/services";

export async function PUT(
  request: Request,
  context: { readonly params: Promise<{ readonly attemptId: string }> },
): Promise<Response> {
  const { attemptId } = await context.params;
  return handleSaveDraft(getApiServices(), attemptId, request);
}
