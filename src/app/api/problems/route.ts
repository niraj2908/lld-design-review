import { handleListProblems } from "@/presentation/api/handlers";
import { getApiServices } from "@/presentation/api/services";

export async function GET(): Promise<Response> {
  return handleListProblems(getApiServices());
}
