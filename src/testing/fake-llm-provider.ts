import type {
  LLMProvider,
  LLMRequest,
  LLMResult,
} from "@/application/ports/llm-provider";
import { LLMTimeoutError } from "@/application/ports/llm-provider";

/**
 * Stands in for a provider so tests never need a key or a network.
 *
 * It records the request it was given, so a test can assert what the evaluator
 * actually sent, and it is told what to answer — including how to fail.
 */
export class FakeLLMProvider implements LLMProvider {
  readonly name = "fake";
  readonly requests: LLMRequest[] = [];

  constructor(
    private readonly answer:
      | { readonly kind: "output"; readonly output: unknown }
      | { readonly kind: "throw"; readonly error: Error },
    readonly model = "fake-model-v1",
  ) {}

  static answering(output: unknown, model?: string): FakeLLMProvider {
    return new FakeLLMProvider({ kind: "output", output }, model);
  }

  static failing(error: Error, model?: string): FakeLLMProvider {
    return new FakeLLMProvider({ kind: "throw", error }, model);
  }

  static timingOut(timeoutMs = 45_000): FakeLLMProvider {
    return FakeLLMProvider.failing(new LLMTimeoutError(timeoutMs));
  }

  get lastRequest(): LLMRequest {
    const request = this.requests.at(-1);
    if (request === undefined) {
      throw new Error("The provider was never called.");
    }
    return request;
  }

  async generateStructured(request: LLMRequest): Promise<LLMResult<unknown>> {
    this.requests.push(request);
    if (this.answer.kind === "throw") {
      throw this.answer.error;
    }
    return {
      output: this.answer.output,
      model: this.model,
      latencyMs: 7,
    };
  }
}
