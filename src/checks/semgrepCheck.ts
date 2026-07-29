import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import type { DiffResult } from "../git/diff";
import type { Violation } from "../report/types";
import { addedLineNumbers } from "../git/diffLines";

const execFileAsync = promisify(execFileCb);

// A stable, well-known Semgrep Registry security ruleset — overridable via
// GUARDIAN_SEMGREP_CONFIG the same way GUARDIAN_LLM_PROVIDER/GUARDIAN_LLM_MODEL
// already let the LLM checks be reconfigured through .env.
const DEFAULT_SEMGREP_CONFIG = "p/security-audit";

interface SemgrepFinding {
  check_id: string;
  path: string;
  start: { line: number };
  extra: {
    message: string;
    severity: "ERROR" | "WARNING" | "INFO";
  };
}

interface SemgrepOutput {
  results?: SemgrepFinding[];
}

export interface ExecFileResult {
  stdout: string;
}

export interface SemgrepCheckDeps {
  execFile: (command: string, args: string[], options: { cwd: string }) => Promise<ExecFileResult>;
}

function severityToRiskLevel(severity: SemgrepFinding["extra"]["severity"]): Violation["riskLevel"] {
  switch (severity) {
    case "ERROR":
      return "high";
    case "WARNING":
      return "medium";
    default:
      return "low";
  }
}

/**
 * Deterministic security-rule check via the Semgrep CLI (external binary,
 * not an npm dependency) — no LLM involved. Optional: if the `semgrep`
 * binary isn't installed, this logs a warning and returns [], the same way
 * the LLM checks skip themselves when no API key is configured.
 *
 * Semgrep scans whole files, but Guardian only ever judges the diff — so
 * findings are cross-referenced against addedLineNumbers() and any finding
 * that lands on a pre-existing (unchanged) line is dropped.
 */
export async function checkWithSemgrep(
  diff: DiffResult,
  cwd: string = process.cwd(),
  deps: Partial<SemgrepCheckDeps> = {}
): Promise<Violation[]> {
  const _execFile = deps.execFile ?? ((command, args, options) => execFileAsync(command, args, options));

  const targets = diff.changedFiles.filter((file) => {
    try {
      return fs.statSync(path.join(cwd, file)).isFile();
    } catch {
      return false;
    }
  });
  if (targets.length === 0) return [];

  const config = process.env.GUARDIAN_SEMGREP_CONFIG?.trim() || DEFAULT_SEMGREP_CONFIG;

  let stdout: string;
  try {
    const result = await _execFile(
      "semgrep",
      ["--config", config, "--json", "--quiet", ...targets],
      { cwd }
    );
    stdout = result.stdout;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      console.error(
        "[guardian] Không tìm thấy binary `semgrep` trong PATH — bỏ qua semgrep check. Cài semgrep (pip install semgrep / brew install semgrep) để bật tính năng này."
      );
      return [];
    }
    // Node attaches partial stdout/stderr to the error on a non-zero exit
    // (e.g. a real Semgrep fatal error) — try to salvage it, else give up quietly.
    stdout = (error as Partial<ExecFileResult>)?.stdout ?? "";
    if (!stdout) return [];
  }

  let output: SemgrepOutput;
  try {
    output = JSON.parse(stdout);
  } catch {
    return [];
  }

  const violations: Violation[] = [];
  for (const finding of output.results ?? []) {
    const addedLines = addedLineNumbers(diff.diffText, finding.path);
    if (!addedLines.has(finding.start.line)) continue;

    violations.push({
      errorWhat: `Semgrep rule "${finding.check_id}" phát hiện tại ${finding.path}:${finding.start.line}`,
      policyViolated: `Semgrep Security Rule (${finding.check_id})`,
      riskLevel: severityToRiskLevel(finding.extra.severity),
      why: finding.extra.message,
      howToFix: "Xem lại đoạn code được Semgrep đánh dấu và áp dụng khuyến nghị của rule tương ứng.",
      promptToFix: `Hãy giúp tôi sửa vi phạm Semgrep rule "${finding.check_id}" tại ${finding.path}:${finding.start.line}. Mô tả lỗi: ${finding.extra.message}. Sửa mà không làm ảnh hưởng đến logic hiện tại.`,
      source: "semgrep-check",
    });
  }

  return violations;
}
