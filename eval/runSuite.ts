import { runGuardianCheck } from "../src/orchestrator";
import { checkPoliciesWithLLM } from "../src/checks/llmPolicyCheck";
import type { DiffResult } from "../src/git/diff";
import { EVAL_CASES } from "./dataset/cases";
import type { EvalCase, EvalCaseResult } from "./types";

// V1 scope: only the two checks whose result depends on the LLM's actual judgment
// (secret-scan is deterministic but cheap/free, so it's kept for full-pipeline coverage).
// architectureCheck/architectureRulesCheck (madge, needs the real module graph),
// dependencyRulesCheck (cross-checks the real on-disk package.json), and semgrepCheck
// (shells out to a real binary over real files) are already covered by their own
// fixture-based unit tests and would need a synthetic on-disk project to eval
// meaningfully here — stubbed out so they never fire on these synthetic diffs.
const RELEVANT_SOURCES = new Set(["secret-scan", "llm-policy-check"]);

/**
 * This module is imported by both `runEval.ts` (single-run CLI) and
 * `runBenchmark.ts` (multi-model matrix) — it must stay side-effect-free at
 * import time (no top-level API calls, no `main()` auto-invocation) so
 * importing it never triggers a run on its own.
 */
/**
 * `splitPolicies` is diagnostic-only (see `npm run eval -- --split-policies` and
 * LLMPolicyCheckDeps.splitPolicies in src/checks/llmPolicyCheck.ts) — not wired into the real
 * `guardian check` CLI. Forces one report_violations call per matched policy instead of one
 * combined call, to test the hypothesis that bundling ~9-11 policies into a single prompt causes
 * context saturation. Multiplies paid API calls per file, so it's opt-in and eval-only for now.
 */
export async function runCase(evalCase: EvalCase, splitPolicies = false): Promise<EvalCaseResult> {
  const diff: DiffResult = { diffText: evalCase.diffText, changedFiles: evalCase.changedFiles };

  try {
    const report = await runGuardianCheck(diff, {
      // Never read/pollute the real .git/guardian_cache.json, and always force a
      // genuine LLM call — a cache hit would silently skip the thing being measured.
      readCache: () => null,
      writeCache: () => {},
      checkCircularDependencies: async () => [],
      checkArchitectureRules: async () => [],
      checkDependencyRules: () => [],
      checkWithSemgrep: async () => [],
      checkPoliciesWithLLM: splitPolicies
        ? (d, policies, deps) => checkPoliciesWithLLM(d, policies, { ...deps, splitPolicies: true })
        : undefined,
    });

    const violations = report.violations.filter((v) => RELEVANT_SOURCES.has(v.source));
    const expectationMet =
      evalCase.group === "true-positive" ? violations.length > 0 : violations.length === 0;

    return { case: evalCase, violations, expectationMet };
  } catch (error) {
    return {
      case: evalCase,
      violations: [],
      expectationMet: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Runs every case sequentially — on purpose: keeps LLM rate-limit usage
 * predictable and lets callers stream progress case-by-case via `onResult`,
 * at the cost of total wall-clock time.
 */
export async function runEvalCases(
  cases: EvalCase[] = EVAL_CASES,
  onResult?: (result: EvalCaseResult) => void,
  splitPolicies = false
): Promise<EvalCaseResult[]> {
  const results: EvalCaseResult[] = [];
  for (const evalCase of cases) {
    const result = await runCase(evalCase, splitPolicies);
    results.push(result);
    onResult?.(result);
  }
  return results;
}
