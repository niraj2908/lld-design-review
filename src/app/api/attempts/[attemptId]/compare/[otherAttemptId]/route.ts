import { handleCompareAttempts } from "@/presentation/api/handlers";
import { getApiServices } from "@/presentation/api/services";

export async function GET(
  _request: Request,
  context: {
    readonly params: Promise<{
      readonly attemptId: string;
      readonly otherAttemptId: string;
    }>;
  },
): Promise<Response> {
  const { attemptId, otherAttemptId } = await context.params;
  return handleCompareAttempts(getApiServices(), attemptId, otherAttemptId);
}
