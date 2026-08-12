import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { readGitHubContext } from "../src/ci/githubContext";
import { postOrUpdateComment } from "../src/ci/githubComment";
import { buildSnapshot, computeDelta, loadMostRecentSnapshot, printDelta, writeSnapshot } from "./history";
import type { EvalCaseResult, EvalSummary, PolicyBreakdown } from "./types";

/**
 * Hidden at the top of every render so a re-run on the same PR can find and
 * PATCH its own previous comment instead of stacking a new one — same
 * mechanism as GUARDIAN_REPORT_MARKER in src/report/markdownReporter.ts, but
 * a distinct marker so the two report types never collide.
 */
export const EVAL_REPORT_MARKER = "<!-- guardian-eval-report -->";

export const DEFAULT_RESULTS_DIR = path.join(__dirname, "results");

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function buildSummary(results: EvalCaseResult[]): EvalSummary {
  const truePositives = results.filter((r) => r.case.group === "true-positive");
  const falsePositiveTraps = results.filter((r) => r.case.group === "false-positive-trap");

  const truePositiveDetected = truePositives.filter((r) => r.expectationMet).length;
  const falsePositiveTrapFired = falsePositiveTraps.filter((r) => !r.expectationMet).length;

  const byPolicyIdMap = new Map<string, PolicyBreakdown>();
  for (const result of results) {
    for (const policyId of result.case.policyIds) {
      const entry = byPolicyIdMap.get(policyId) ?? { policyId, total: 0, expectationMet: 0 };
      entry.total += 1;
      if (result.expectationMet) entry.expectationMet += 1;
      byPolicyIdMap.set(policyId, entry);
    }
  }

  return {
    results,
    recall: ratio(truePositiveDetected, truePositives.length),
    falsePositiveRate: ratio(falsePositiveTrapFired, falsePositiveTraps.length),
    precision: ratio(truePositiveDetected, truePositiveDetected + falsePositiveTrapFired),
    truePositiveTotal: truePositives.length,
    truePositiveDetected,
    falsePositiveTrapTotal: falsePositiveTraps.length,
    falsePositiveTrapFired,
    byPolicyId: [...byPolicyIdMap.values()],
  };
}

export function printSummary(summary: EvalSummary): void {
  console.log("");
  console.log(chalk.bold("🧪 Guardian Eval — kết quả"));
  console.log(
    `  Recall               ${chalk.cyan(pct(summary.recall))} (${summary.truePositiveDetected}/${summary.truePositiveTotal} case true-positive bắt được)`
  );
  console.log(
    `  False Positive Rate  ${chalk.cyan(pct(summary.falsePositiveRate))} (${summary.falsePositiveTrapFired}/${summary.falsePositiveTrapTotal} case false-positive-trap bị báo động giả)`
  );
  console.log(`  Precision             ${chalk.cyan(pct(summary.precision))}`);
  console.log("");

  for (const result of summary.results) {
    const ok = result.expectationMet;
    const icon = ok ? chalk.green("✅") : chalk.red("❌");
    const label = result.case.group === "true-positive" ? "TP" : "FP-trap";
    const detail = result.error
      ? chalk.red(`lỗi: ${result.error}`)
      : `${result.violations.length} vi phạm`;
    console.log(`  ${icon} [${label}] ${result.case.id} — ${detail}`);
  }
  console.log("");
}

function buildMarkdown(summary: EvalSummary): string {
  const rows = summary.results
    .map((r) => {
      const status = r.expectationMet ? "✅" : "❌";
      const detail = r.error ? `lỗi: ${r.error}` : `${r.violations.length} vi phạm`;
      return `| ${r.case.id} | ${r.case.group} | ${r.case.policyIds.join(", ")} | ${status} | ${detail} |`;
    })
    .join("\n");

  return `${EVAL_REPORT_MARKER}
## 🧪 AI Dev Guardian — Evaluation Report

- **Recall**: ${pct(summary.recall)} (${summary.truePositiveDetected}/${summary.truePositiveTotal})
- **False Positive Rate**: ${pct(summary.falsePositiveRate)} (${summary.falsePositiveTrapFired}/${summary.falsePositiveTrapTotal})
- **Precision**: ${pct(summary.precision)}

_Báo cáo mang tính thông tin — không chặn merge (informational only)._

| Case | Nhóm | Policy | Kết quả | Chi tiết |
|---|---|---|---|---|
${rows}
`;
}

/**
 * Writes eval/results/latest.json + latest.md, appends to $GITHUB_STEP_SUMMARY if set, then
 * records this run as a new immutable snapshot under eval/results/history/ and prints the
 * Delta against the most recently recorded snapshot (before this one was written).
 *
 * `resultsDir` defaults to the real eval/results/ (production use, e.g. eval/runEval.ts). Tests
 * pass an isolated temp directory so they never read/write/delete the real recorded eval history.
 */
export async function writeResults(
  summary: EvalSummary,
  resultsDir: string = DEFAULT_RESULTS_DIR
): Promise<void> {
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(
    path.join(resultsDir, "latest.json"),
    JSON.stringify(
      {
        recall: summary.recall,
        falsePositiveRate: summary.falsePositiveRate,
        precision: summary.precision,
        truePositiveTotal: summary.truePositiveTotal,
        truePositiveDetected: summary.truePositiveDetected,
        falsePositiveTrapTotal: summary.falsePositiveTrapTotal,
        falsePositiveTrapFired: summary.falsePositiveTrapFired,
        byPolicyId: summary.byPolicyId,
        results: summary.results.map((r) => ({
          id: r.case.id,
          group: r.case.group,
          policyIds: r.case.policyIds,
          expectationMet: r.expectationMet,
          violationCount: r.violations.length,
          error: r.error ?? null,
        })),
      },
      null,
      2
    ),
    "utf-8"
  );

  const markdown = buildMarkdown(summary);
  fs.writeFileSync(path.join(resultsDir, "latest.md"), markdown, "utf-8");

  const stepSummaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummaryPath) {
    fs.appendFileSync(stepSummaryPath, `\n${markdown}\n`, "utf-8");
  }

  // Read the PRIOR most-recent snapshot before writing this run's own — otherwise "most recent"
  // would immediately be this run itself and the delta would always be zero.
  const historyDir = path.join(resultsDir, "history");
  const previous = loadMostRecentSnapshot(historyDir);
  const snapshot = await buildSnapshot(summary);
  writeSnapshot(snapshot, historyDir);
  printDelta(snapshot, computeDelta(snapshot, previous));
}

/**
 * Posts/updates a PR comment with the eval summary — only when actually
 * running under a `pull_request` GitHub Actions event (readGitHubContext
 * throws otherwise, e.g. on a nightly `schedule` or manual `workflow_dispatch`
 * run, which have no PR to comment on). Not finding PR context is expected
 * and silently skipped, not an error.
 */
export async function postSummaryToGitHub(summary: EvalSummary): Promise<void> {
  let ctx;
  try {
    ctx = readGitHubContext();
  } catch {
    return;
  }
  await postOrUpdateComment(ctx, buildMarkdown(summary), fetch, EVAL_REPORT_MARKER);
}
