import { buildAttemptComparison } from "@/domain/comparison";
import { validateEvidence } from "@/domain/evaluation/evidence-validation";
import type { EvaluationOutcome } from "@/domain/evaluation/evaluation-outcome";
import type { Evidence } from "@/domain/feedback/evidence";
import { AIDesignEvaluator } from "@/evaluation-engine/ai/ai-design-evaluator";
import { HybridEvaluator } from "@/evaluation-engine/hybrid-evaluator";
import { RuleBasedEvaluator } from "@/evaluation-engine/rule-based-evaluator";
import { parkingLotProblem, submissionOf } from "@/testing/fixtures";
import { FakeLLMProvider } from "@/testing/fake-llm-provider";
import { BENCHMARK_CASES } from "./fixtures";
import type { BenchmarkCase } from "./fixtures";
import {
  regressionAttempt1Design,
  regressionAttempt1Review,
  regressionAttempt2Design,
  regressionAttempt2Review,
} from "./regression-fixtures";

/**
 * `npm run benchmark` — a small, human-readable summary of the M10 benchmark
 * suite (see `docs/EVALUATION_BENCHMARK.md`). It is a convenience view over the
 * same fixtures the real assertions live against in `tests/benchmarks/*.test.ts`;
 * this script re-runs each case through the real evaluators with a scripted
 * `FakeLLMProvider` (never a live model — no key, no network, nothing paid) and
 * prints one row per case plus one for the regression/evolution scenario.
 *
 * This is a report, not the test suite. A failing row here means something is
 * genuinely wrong; a passing suite of this script is not a substitute for
 * `npm test`, which carries the actual, detailed assertions.
 */

interface RowResult {
  readonly id: string;
  readonly category: string;
  readonly deterministic: string;
  readonly semantic: string;
  readonly evidence: string;
  readonly expected: string;
  readonly pass: boolean;
  readonly notes: readonly string[];
}

async function runCase(testCase: BenchmarkCase): Promise<RowResult> {
  const notes: string[] = [];
  const context = { problem: testCase.problem, submission: submissionOf(testCase.design) };

  let deterministicOutcome: EvaluationOutcome;
  try {
    deterministicOutcome = await new RuleBasedEvaluator().evaluate(context);
  } catch (error) {
    return fail(testCase, `deterministic evaluator threw: ${String(error)}`);
  }

  let semanticOutcome: EvaluationOutcome;
  try {
    semanticOutcome = await new AIDesignEvaluator(
      FakeLLMProvider.answering(testCase.mockAiReview),
    ).evaluate(context);
  } catch (error) {
    return fail(testCase, `semantic evaluator threw: ${String(error)}`);
  }

  // The mock review is hand-written to reference real design elements; every
  // evidence item across it failing to verify would mean the fixture itself is
  // wrong, not the evaluator, so this is reported as a sanity signal.
  const allEvidence = [
    ...testCase.mockAiReview.criteria.flatMap((c) => c.evidence),
    ...testCase.mockAiReview.priorityImprovements.flatMap((item) => item.where),
  ] as readonly Evidence[];
  const { verified, rejected } = validateEvidence(allEvidence, testCase.design);
  if (rejected.length > 0) {
    notes.push(`${rejected.length} of ${allEvidence.length} mock evidence items did not verify`);
  }

  let hybridOutcome: EvaluationOutcome;
  try {
    hybridOutcome = await new HybridEvaluator(
      new RuleBasedEvaluator(),
      new AIDesignEvaluator(FakeLLMProvider.answering(testCase.mockAiReview)),
    ).evaluate(context);
  } catch (error) {
    return fail(testCase, `hybrid evaluator threw: ${String(error)}`);
  }

  const deterministicCriteria = new Set([
    "STRUCTURAL_VALIDITY",
    "REQUIREMENT_COVERAGE",
    "DESIGN_COMPLETENESS",
    "EDGE_CASE_COVERAGE",
    "DESIGN_DECISIONS",
  ]);
  const semanticInHybrid = hybridOutcome.criterionResults.filter(
    (r) => !deterministicCriteria.has(r.criterion),
  );
  if (semanticInHybrid.length !== semanticOutcome.criterionResults.length) {
    notes.push("hybrid outcome lost or gained semantic criteria versus the standalone semantic run");
  }
  const noStrongFromDeterministic = deterministicOutcome.criterionResults.every(
    (r) => r.assessment !== "STRONG",
  );
  if (!noStrongFromDeterministic) {
    notes.push("deterministic evaluator claimed STRONG, which it must never do");
  }

  const pass = rejected.length === 0 && semanticInHybrid.length === semanticOutcome.criterionResults.length && noStrongFromDeterministic;

  return {
    id: testCase.id,
    category: testCase.category,
    deterministic: summarizeOutcome(deterministicOutcome),
    semantic: summarizeOutcome(semanticOutcome),
    evidence: `${verified.length}/${allEvidence.length} verified`,
    expected: testCase.intent,
    pass,
    notes,
  };
}

function fail(testCase: BenchmarkCase, note: string): RowResult {
  return {
    id: testCase.id,
    category: testCase.category,
    deterministic: "ERROR",
    semantic: "ERROR",
    evidence: "-",
    expected: testCase.intent,
    pass: false,
    notes: [note],
  };
}

function summarizeOutcome(outcome: EvaluationOutcome): string {
  return outcome.criterionResults
    .map((r) => `${r.criterion}:${r.assessment}`)
    .join(", ");
}

/** Benchmark G — the regression/evolution scenario, checked separately: it needs two attempts, not one design. */
async function runRegressionCase(): Promise<RowResult> {
  const problem = parkingLotProblem();

  const before = await new HybridEvaluator(
    new RuleBasedEvaluator(),
    new AIDesignEvaluator(FakeLLMProvider.answering(regressionAttempt1Review)),
  ).evaluate({ problem, submission: submissionOf(regressionAttempt1Design) });
  const after = await new HybridEvaluator(
    new RuleBasedEvaluator(),
    new AIDesignEvaluator(FakeLLMProvider.answering(regressionAttempt2Review)),
  ).evaluate({ problem, submission: submissionOf(regressionAttempt2Design) });

  const comparison = buildAttemptComparison({
    requirements: problem.requirements,
    designBefore: regressionAttempt1Design,
    designAfter: regressionAttempt2Design,
    previousFeedback: before.priorityImprovements,
    criteriaBefore: before.criterionResults,
    criteriaAfter: after.criterionResults,
  });

  const trends = new Set(comparison.criterionEvolutions.map((e) => e.trend));
  const pass = trends.has("IMPROVED") && trends.has("REGRESSED");

  return {
    id: "regression-evolution",
    category: "REGRESSION",
    deterministic: `requirementCoverage: ${comparison.requirementCoverage.map((r) => r.transition).join(", ")}`,
    semantic: comparison.criterionEvolutions.map((e) => `${e.criterion}:${e.trend}`).join(", "),
    evidence: `${comparison.feedbackResolutions.length} prior finding(s) re-checked`,
    expected: "Comparison shows an improvement and a regression on different criteria in one result, plus the resolved prior finding.",
    pass,
    notes: pass ? [] : ["expected both an IMPROVED and a REGRESSED trend"],
  };
}

async function main(): Promise<void> {
  const rows = await Promise.all(BENCHMARK_CASES.map(runCase));
  rows.push(await runRegressionCase());

  process.stdout.write("\nM10 Evaluation Benchmark\n");
  process.stdout.write("========================\n\n");
  process.stdout.write(
    "This is curated behavioural coverage for representative design cases. It does\n" +
      "not measure general model accuracy — see docs/EVALUATION_BENCHMARK.md.\n\n",
  );

  for (const row of rows) {
    process.stdout.write(`${row.pass ? "PASS" : "FAIL"}  ${row.id} [${row.category}]\n`);
    process.stdout.write(`  Expected:     ${row.expected}\n`);
    process.stdout.write(`  Deterministic: ${row.deterministic || "(none)"}\n`);
    process.stdout.write(`  Semantic:      ${row.semantic || "(none)"}\n`);
    process.stdout.write(`  Evidence:      ${row.evidence}\n`);
    for (const note of row.notes) {
      process.stdout.write(`  Note:          ${note}\n`);
    }
    process.stdout.write("\n");
  }

  const failed = rows.filter((row) => !row.pass);
  process.stdout.write(`${rows.length - failed.length}/${rows.length} cases passed.\n`);
  if (failed.length > 0) {
    process.stdout.write(`Failed: ${failed.map((row) => row.id).join(", ")}\n`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Benchmark run failed: ${String(error)}\n`);
  process.exitCode = 1;
});
