import { handleStartAttempt } from "@/presentation/api/handlers";
import { getApiServices } from "@/presentation/api/services";

export async function POST(
  _request: Request,
  context: { readonly params: Promise<{ readonly problemRef: string }> },
): Promise<Response> {
  const { problemRef } = await context.params;
  return handleStartAttempt(getApiServices(), problemRef);
}
