import chalk from "chalk";
import { pct } from "./report";
import type { EvalSummary } from "./types";

export interface Thresholds {
  minRecall: number;
  minPrecision: number;
  maxFalsePositiveRate: number;
}

/**
 * Minimum bar for the eval suite's `--ci` mode (see runEval.ts) to consider
 * the LLM check's detection quality acceptable enough to gate a merge on.
 * Deliberately looser than "perfect" — these numbers reflect the real,
 * inherently-non-deterministic ceiling of an LLM-as-judge check, not a bug
 * bar. Revisit as the golden dataset grows / the model improves.
 */
export const DEFAULT_THRESHOLDS: Thresholds = {
  minRecall: 0.85,
  minPrecision: 0.8,
  maxFalsePositiveRate: 0.25,
};

export interface ThresholdCheckResult {
  passed: boolean;
  failures: string[];
}

export function checkThresholds(
  summary: EvalSummary,
  thresholds: Thresholds = DEFAULT_THRESHOLDS
): ThresholdCheckResult {
  const failures: string[] = [];

  if (summary.recall < thresholds.minRecall) {
    failures.push(
      `Recall ${pct(summary.recall)} thấp hơn ngưỡng tối thiểu ${pct(thresholds.minRecall)}`
    );
  }
  if (summary.precision < thresholds.minPrecision) {
    failures.push(
      `Precision ${pct(summary.precision)} thấp hơn ngưỡng tối thiểu ${pct(thresholds.minPrecision)}`
    );
  }
  if (summary.falsePositiveRate > thresholds.maxFalsePositiveRate) {
    failures.push(
      `False Positive Rate ${pct(summary.falsePositiveRate)} vượt ngưỡng tối đa ${pct(thresholds.maxFalsePositiveRate)}`
    );
  }

  return { passed: failures.length === 0, failures };
}

export function printThresholdResult(result: ThresholdCheckResult): void {
  console.log("");
  if (result.passed) {
    console.log(chalk.bgGreen.black.bold(" QUALITY GATE PASSED "));
    console.log(chalk.green("  Tất cả chỉ số đạt ngưỡng tối thiểu."));
  } else {
    console.log(chalk.bgRed.white.bold(" QUALITY GATE FAILED "));
    for (const failure of result.failures) {
      console.log(chalk.red(`  ✖ ${failure}`));
    }
  }
  console.log("");
}
