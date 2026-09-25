# ADR-004: LLM provider abstraction

## Status

Accepted.

## Context

The evaluation engine and the Design Coach both need a language model, but
neither should know or care which vendor is behind it, and every automated
test needs to run without a real API key or network access.

## Decision

Define one `LLMProvider` port (`src/application/ports/llm-provider.ts`) with a
single `generateStructured` method that takes a system prompt, a user prompt,
and a JSON Schema, and returns a parsed result or a typed error
(`LLMTimeoutError`, `LLMRateLimitError`, `LLMResponseFormatError`,
`LLMConfigurationError`, `LLMUnavailableError`). `GroqLLMProvider`
(`src/infrastructure/ai/groq-llm-provider.ts`) is the only file in the
repository that imports the Groq SDK or knows Groq's error taxonomy; it
translates vendor errors into the port's own. `FakeLLMProvider`
(`src/testing/fake-llm-provider.ts`) implements the same port for every test.

## Consequences

- `AIDesignEvaluator` and `LLMDesignCoach` depend on `LLMProvider`, never on
  Groq — swapping providers, or adding a second one, changes one adapter and
  the composition root, not the evaluation or coaching logic.
- `npm test`, `npm run test:integration`, `npm run verify` and CI never need
  a Groq key: every AI-dependent test runs against `FakeLLMProvider`.
- A model id retiring (as happened during this project — see AI_USAGE.md's
  worked example) is a one-line configuration change
  (`DEFAULT_GROQ_MODEL` / `GROQ_MODEL`), not a code change to the evaluator or
  the coach.
- Provider-specific quirks (a stricter or looser JSON Schema dialect) are
  absorbed inside `GroqLLMProvider`; the Zod schema that actually validates
  the answer never changes because of them.
