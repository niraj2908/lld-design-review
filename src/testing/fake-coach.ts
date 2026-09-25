import type { CoachContext, DesignCoach } from "@/application/ports/design-coach";
import type { CoachAnswer } from "@/domain/coach/coach-answer";

/**
 * A design coach a test can script: it records the context it was given and
 * answers with a fixed `CoachAnswer`, so `AskDesignCoach` can be exercised
 * without a model, a key, or a network — the same role `FakeLLMProvider` plays
 * for evaluation.
 */
export class FakeDesignCoach implements DesignCoach {
  readonly contexts: CoachContext[] = [];

  constructor(
    private readonly answer:
      | { readonly kind: "answer"; readonly value: CoachAnswer }
      | { readonly kind: "throw"; readonly error: Error },
  ) {}

  static answering(value: CoachAnswer): FakeDesignCoach {
    return new FakeDesignCoach({ kind: "answer", value });
  }

  static failing(error: Error): FakeDesignCoach {
    return new FakeDesignCoach({ kind: "throw", error });
  }

  get lastContext(): CoachContext {
    const context = this.contexts.at(-1);
    if (context === undefined) {
      throw new Error("The coach was never asked anything.");
    }
    return context;
  }

  async ask(context: CoachContext): Promise<CoachAnswer> {
    this.contexts.push(context);
    if (this.answer.kind === "throw") {
      throw this.answer.error;
    }
    return this.answer.value;
  }
}

/** A minimal, valid answer a test can start from and override fields on. */
export function fakeCoachAnswer(overrides: Partial<CoachAnswer> = {}): CoachAnswer {
  return {
    answer: "This is a grounded answer about your design.",
    observations: [],
    evaluationReferences: [],
    knowledgeCitations: [],
    certainty: "SUFFICIENT_CONTEXT",
    unverifiedReferenceCount: 0,
    ...overrides,
  };
}
