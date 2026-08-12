import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import simpleGit from "simple-git";
import { resolveLLMClient } from "../src/checks/llm/resolveClient";
import type { EvalSummary, HistorySnapshot, MetricDelta } from "./types";

export const DEFAULT_HISTORY_DIR = path.join(__dirname, "results", "history");

/** Filesystem-safe timestamp, e.g. "2026-08-12_143045". */
function timestampForFilename(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/**
 * Prefers CI's own commit ref (authoritative even on a shallow checkout)
 * over asking git locally; falls back to `git rev-parse HEAD`, and to null
 * if neither is available (not a git repo, no commits yet) — a commit sha
 * is a nice-to-have on the snapshot, never something that should crash a run.
 */
async function resolveCommitSha(cwd: string = process.cwd()): Promise<string | null> {
  const fromEnv = process.env.GITHUB_SHA?.trim();
  if (fromEnv) return fromEnv;

  try {
    const sha = await simpleGit(cwd).revparse(["HEAD"]);
    return sha.trim() || null;
  } catch {
    return null;
  }
}

export async function buildSnapshot(summary: EvalSummary): Promise<HistorySnapshot> {
  const resolved = resolveLLMClient();
  return {
    timestamp: new Date().toISOString(),
    provider: resolved?.provider ?? "unknown",
    model: resolved?.model ?? "unknown",
    commitSha: await resolveCommitSha(),
    recall: summary.recall,
    precision: summary.precision,
    falsePositiveRate: summary.falsePositiveRate,
    passedCaseIds: summary.results.filter((r) => r.expectationMet).map((r) => r.case.id),
    failedCaseIds: summary.results.filter((r) => !r.expectationMet).map((r) => r.case.id),
  };
}

/** Every snapshot file currently on disk, oldest first (sorted by filename, which sorts chronologically). */
function listSnapshotFiles(historyDir: string): string[] {
  if (!fs.existsSync(historyDir)) return [];
  return fs
    .readdirSync(historyDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

/**
 * The most recently written snapshot on disk, if any — read BEFORE writing this run's own
 * snapshot. `historyDir` defaults to the real eval/results/history/ (production use); tests pass
 * an isolated temp directory so they never touch real recorded eval history.
 */
export function loadMostRecentSnapshot(historyDir: string = DEFAULT_HISTORY_DIR): HistorySnapshot | null {
  const files = listSnapshotFiles(historyDir);
  const latest = files.at(-1);
  if (!latest) return null;

  try {
    const raw = fs.readFileSync(path.join(historyDir, latest), "utf-8");
    return JSON.parse(raw) as HistorySnapshot;
  } catch {
    return null;
  }
}

/**
 * Writes `snapshot` as a new immutable history file — never overwrites a prior run's snapshot.
 * `historyDir` defaults to the real eval/results/history/ (production use); tests pass an isolated
 * temp directory so they never touch real recorded eval history.
 */
export function writeSnapshot(snapshot: HistorySnapshot, historyDir: string = DEFAULT_HISTORY_DIR): string {
  fs.mkdirSync(historyDir, { recursive: true });
  const filename = `${timestampForFilename(new Date(snapshot.timestamp))}.json`;
  const filePath = path.join(historyDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf-8");
  return filePath;
}

export function computeDelta(current: HistorySnapshot, previous: HistorySnapshot | null): MetricDelta {
  if (!previous) {
    return { previous: null, recallDelta: null, precisionDelta: null, falsePositiveRateDelta: null };
  }
  return {
    previous,
    recallDelta: current.recall - previous.recall,
    precisionDelta: current.precision - previous.precision,
    falsePositiveRateDelta: current.falsePositiveRate - previous.falsePositiveRate,
  };
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** Signed percentage-point delta, e.g. "+8.1%" / "-11.4%" / "±0.0%". */
function signedDeltaPct(delta: number): string {
  const points = delta * 100;
  const sign = points > 0 ? "+" : points < 0 ? "" : "±";
  return `${sign}${points.toFixed(1)}%`;
}

/**
 * `higherIsBetter` picks green/red so the color always means "better/worse",
 * not just "up/down" — e.g. a rising FPR is bad (red) while a rising Recall
 * is good (green).
 */
function colorForDelta(delta: number, higherIsBetter: boolean): (text: string) => string {
  if (delta === 0) return chalk.dim;
  const isImprovement = higherIsBetter ? delta > 0 : delta < 0;
  return isImprovement ? chalk.green : chalk.red;
}

export function printDelta(current: HistorySnapshot, delta: MetricDelta): void {
  console.log(chalk.bold("📈 So với lần chạy trước:"));
  if (!delta.previous) {
    console.log(chalk.dim("  (chưa có snapshot trước đó để so sánh)"));
    console.log("");
    return;
  }

  const recallColor = colorForDelta(delta.recallDelta ?? 0, true);
  const precisionColor = colorForDelta(delta.precisionDelta ?? 0, true);
  const fprColor = colorForDelta(delta.falsePositiveRateDelta ?? 0, false);

  console.log(
    `  Recall:    ${pct(current.recall)} (${recallColor(signedDeltaPct(delta.recallDelta ?? 0))})`
  );
  console.log(
    `  Precision: ${pct(current.precision)} (${precisionColor(signedDeltaPct(delta.precisionDelta ?? 0))})`
  );
  console.log(
    `  FPR:       ${pct(current.falsePositiveRate)} (${fprColor(signedDeltaPct(delta.falsePositiveRateDelta ?? 0))})`
  );
  console.log(chalk.dim(`  (so với lần chạy ${delta.previous.timestamp})`));
  console.log("");
}
