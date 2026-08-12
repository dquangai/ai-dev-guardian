import type { Violation } from "../src/report/types";

export type EvalGroup = "true-positive" | "false-positive-trap";

/**
 * One golden-dataset case. `diffText`/`changedFiles` feed straight into
 * `runGuardianCheck`'s `DiffResult` param — no real git repo needed, see
 * `src/orchestrator.ts`.
 */
export interface EvalCase {
  id: string;
  description: string;
  group: EvalGroup;
  /** Which real .guardian/policies id(s) this case targets — for per-policy breakdown only, not enforced. */
  policyIds: string[];
  changedFiles: string[];
  diffText: string;
}

export interface EvalCaseResult {
  case: EvalCase;
  /** Violations from secret-scan/llm-policy-check only — see runEval.ts scope. */
  violations: Violation[];
  /** true-positive: violations.length > 0; false-positive-trap: violations.length === 0. */
  expectationMet: boolean;
  error?: string;
}

export interface PolicyBreakdown {
  policyId: string;
  total: number;
  expectationMet: number;
}

export interface EvalSummary {
  results: EvalCaseResult[];
  recall: number;
  falsePositiveRate: number;
  precision: number;
  truePositiveTotal: number;
  truePositiveDetected: number;
  falsePositiveTrapTotal: number;
  falsePositiveTrapFired: number;
  byPolicyId: PolicyBreakdown[];
}

/** One immutable point-in-time record, written to eval/results/history/ after every run. */
export interface HistorySnapshot {
  timestamp: string;
  provider: string;
  model: string;
  /** null when not resolvable (not a git repo, no commits yet). */
  commitSha: string | null;
  recall: number;
  precision: number;
  falsePositiveRate: number;
  passedCaseIds: string[];
  failedCaseIds: string[];
}

/** Change vs. the most recent prior snapshot — null fields mean "no prior snapshot to compare". */
export interface MetricDelta {
  previous: HistorySnapshot | null;
  recallDelta: number | null;
  precisionDelta: number | null;
  falsePositiveRateDelta: number | null;
}
