import "dotenv/config";
import { resolveLLMClient } from "../src/checks/llm/resolveClient";
import { EVAL_CASES } from "./dataset/cases";
import { runEvalCases } from "./runSuite";
import type { EvalCase, EvalCaseResult } from "./types";
import { buildSummary, printSummary, writeResults, postSummaryToGitHub } from "./report";
import { checkThresholds, printThresholdResult } from "./checkThresholds";

/**
 * Reads `--case=<id>[,<id>...]` off argv — lets a maintainer re-run just the
 * one or two cases they're actively debugging instead of paying for all 100
 * LLM calls every time. Absent flag means "all cases" (unchanged behavior).
 * Exits early (before any LLM call) if an id doesn't exist, so a typo fails
 * fast instead of silently running the full suite.
 */
function selectCases(): EvalCase[] {
  const flag = process.argv.find((arg) => arg.startsWith("--case="));
  if (!flag) return EVAL_CASES;

  const ids = flag
    .slice("--case=".length)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const caseById = new Map(EVAL_CASES.map((c) => [c.id, c]));

  const selected = ids.map((id) => {
    const found = caseById.get(id);
    if (!found) {
      console.error(`[guardian-eval] Không tìm thấy case id "${id}" trong eval/dataset/cases.ts.`);
      process.exit(1);
    }
    return found;
  });

  return selected;
}

async function main(): Promise<void> {
  // --ci switches the exit code from always-0 (informational, the default for local/manual/nightly
  // runs) to gating on DEFAULT_THRESHOLDS — an explicit opt-in for CI jobs that should actually
  // block on a real regression, not just report one. See checkThresholds.ts.
  const ciMode = process.argv.includes("--ci");
  const cases = selectCases();
  // Diagnostic-only: forces one report_violations call per matched policy instead of one combined
  // call (see src/checks/llmPolicyCheck.ts's LLMPolicyCheckDeps.splitPolicies). Multiplies paid API
  // calls per file — not wired into the real `guardian check` CLI, eval-only for now.
  const splitPolicies = process.argv.includes("--split-policies");
  // A filtered run's Recall/FPR/Precision are 0%/100% degenerate numbers over 1-2 cases, not a real
  // measurement. A split-policies run measures a different execution mode entirely — mixing its
  // numbers into the same historical trend as default-mode runs would misread an execution-mode
  // change as a policy-tuning win/loss. Neither should touch history/PR-comment/--ci gate state
  // meant for the default full-suite run.
  const isFilteredRun = cases.length !== EVAL_CASES.length;
  const isDiagnosticRun = isFilteredRun || splitPolicies;

  if (!resolveLLMClient()) {
    console.error(
      "[guardian-eval] Thiếu ANTHROPIC_API_KEY hoặc OPENAI_API_KEY — eval cần gọi LLM thật, " +
        "không chạy được ở chế độ thiếu key (không dùng mock provider)."
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `[guardian-eval] Chạy ${cases.length} case qua runGuardianCheck() thật${splitPolicies ? " (--split-policies: 1 call/policy thay vì 1 call/file)" : ""}...`
  );

  const results: EvalCaseResult[] = await runEvalCases(
    cases,
    (result) => {
      const icon = result.expectationMet ? "✅" : "❌";
      const detail = result.error ? `lỗi: ${result.error}` : `${result.violations.length} vi phạm`;
      console.log(`  ${icon} ${result.case.id} — ${detail}`);
    },
    splitPolicies
  );

  const summary = buildSummary(results);
  printSummary(summary);

  if (isDiagnosticRun) {
    console.log(
      `[guardian-eval] Chạy chẩn đoán (${isFilteredRun ? "--case=..." : ""}${isFilteredRun && splitPolicies ? ", " : ""}${splitPolicies ? "--split-policies" : ""}) — ` +
        "không ghi eval/results/, không ghi history snapshot, không post PR comment, bỏ qua --ci " +
        "threshold gate (không đại diện cho baseline mặc định của toàn bộ suite)."
    );
    process.exitCode = 0;
    return;
  }

  await writeResults(summary);

  try {
    await postSummaryToGitHub(summary);
  } catch (error) {
    console.error(
      `[guardian-eval] Không post được PR comment (bỏ qua, không ảnh hưởng verdict): ${
        error instanceof Error ? error.message : error
      }`
    );
  }

  if (ciMode) {
    const thresholdResult = checkThresholds(summary);
    printThresholdResult(thresholdResult);
    process.exitCode = thresholdResult.passed ? 0 : 1;
  } else {
    // Informational only — confirmed with user: never fail CI on eval numbers by default (LLM
    // non-determinism risk), so exit code stays 0 unless --ci explicitly opts into gating.
    process.exitCode = 0;
  }
}

main();
