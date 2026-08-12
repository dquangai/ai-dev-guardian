import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildSummary, writeResults, postSummaryToGitHub, EVAL_REPORT_MARKER } from "../eval/report";
import type { EvalCase, EvalCaseResult } from "../eval/types";
import type { Violation } from "../src/report/types";

const ENV_KEYS = ["GITHUB_REPOSITORY", "GITHUB_REF", "GITHUB_TOKEN", "GITHUB_STEP_SUMMARY"];
const originalValues = new Map(ENV_KEYS.map((k) => [k, process.env[k]]));

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

function makeViolation(source: Violation["source"] = "llm-policy-check"): Violation {
  return {
    errorWhat: "test violation",
    policyViolated: "Test",
    riskLevel: "medium",
    why: "why",
    howToFix: "fix",
    location: "eval-samples/x.ts",
    promptToFix: "prompt",
    source,
  };
}

function makeCase(id: string, group: EvalCase["group"], policyIds: string[]): EvalCase {
  return {
    id,
    description: id,
    group,
    policyIds,
    changedFiles: [`eval-samples/${id}.ts`],
    diffText: "diff --git a/x b/x",
  };
}

function makeResult(
  id: string,
  group: EvalCase["group"],
  policyIds: string[],
  violations: Violation[],
  expectationMet: boolean
): EvalCaseResult {
  return { case: makeCase(id, group, policyIds), violations, expectationMet };
}

describe("buildSummary", () => {
  it("tính đúng recall / false-positive-rate / precision trên tập kết quả trộn lẫn", () => {
    const results: EvalCaseResult[] = [
      // 2/3 true-positive được bắt đúng
      makeResult("tp-1", "true-positive", ["security.policy.md"], [makeViolation()], true),
      makeResult("tp-2", "true-positive", ["security.policy.md"], [makeViolation()], true),
      makeResult("tp-3", "true-positive", ["security.policy.md"], [], false),
      // 1/2 false-positive-trap báo động giả
      makeResult("fp-1", "false-positive-trap", ["coding-convention.policy.md"], [], true),
      makeResult(
        "fp-2",
        "false-positive-trap",
        ["coding-convention.policy.md"],
        [makeViolation()],
        false
      ),
    ];

    const summary = buildSummary(results);

    expect(summary.truePositiveTotal).toBe(3);
    expect(summary.truePositiveDetected).toBe(2);
    expect(summary.recall).toBeCloseTo(2 / 3);

    expect(summary.falsePositiveTrapTotal).toBe(2);
    expect(summary.falsePositiveTrapFired).toBe(1);
    expect(summary.falsePositiveRate).toBeCloseTo(0.5);

    // precision = TP đúng / (TP đúng + false alarm) = 2 / (2 + 1)
    expect(summary.precision).toBeCloseTo(2 / 3);
  });

  it("trả về 0 (không chia cho 0) khi một nhóm rỗng", () => {
    const results: EvalCaseResult[] = [
      makeResult("fp-1", "false-positive-trap", ["security.policy.md"], [], true),
    ];
    const summary = buildSummary(results);
    expect(summary.recall).toBe(0);
    expect(summary.truePositiveTotal).toBe(0);
  });

  it("gộp đúng theo policyId, kể cả khi 1 case gắn nhiều policyId", () => {
    const results: EvalCaseResult[] = [
      makeResult("tp-1", "true-positive", ["security.policy.md", "coding-convention.policy.md"], [makeViolation()], true),
      makeResult("tp-2", "true-positive", ["security.policy.md"], [], false),
    ];
    const summary = buildSummary(results);
    const security = summary.byPolicyId.find((p) => p.policyId === "security.policy.md");
    const coding = summary.byPolicyId.find((p) => p.policyId === "coding-convention.policy.md");
    expect(security).toEqual({ policyId: "security.policy.md", total: 2, expectationMet: 1 });
    expect(coding).toEqual({ policyId: "coding-convention.policy.md", total: 1, expectationMet: 1 });
  });
});

describe("writeResults", () => {
  // Isolated temp dir per test, never the real eval/results/ — that directory holds actually
  // recorded eval runs (latest.json/md + the full history/ trend); writing/deleting it here would
  // silently corrupt real historical data every time the suite runs.
  let resultsDir: string;

  beforeEach(() => {
    resultsDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-eval-report-test-"));
  });
  afterEach(() => {
    fs.rmSync(resultsDir, { recursive: true, force: true });
  });

  it("ghi latest.json và latest.md, markdown chứa marker để dedupe comment", async () => {
    const summary = buildSummary([
      makeResult("tp-1", "true-positive", ["security.policy.md"], [makeViolation()], true),
    ]);

    await writeResults(summary, resultsDir);

    const json = JSON.parse(fs.readFileSync(path.join(resultsDir, "latest.json"), "utf-8"));
    expect(json.recall).toBe(1);

    const markdown = fs.readFileSync(path.join(resultsDir, "latest.md"), "utf-8");
    expect(markdown.startsWith(EVAL_REPORT_MARKER)).toBe(true);
    expect(markdown).toContain("tp-1");
  });

  it("append vào GITHUB_STEP_SUMMARY khi biến env được set", async () => {
    const stepSummaryPath = path.join(resultsDir, "step-summary.txt");
    fs.mkdirSync(resultsDir, { recursive: true });
    fs.writeFileSync(stepSummaryPath, "");
    process.env.GITHUB_STEP_SUMMARY = stepSummaryPath;

    try {
      await writeResults(buildSummary([]), resultsDir);
      const content = fs.readFileSync(stepSummaryPath, "utf-8");
      expect(content).toContain(EVAL_REPORT_MARKER);
    } finally {
      delete process.env.GITHUB_STEP_SUMMARY;
    }
  });

  it("ghi snapshot lịch sử vào eval/results/history/ sau mỗi lần chạy", async () => {
    await writeResults(
      buildSummary([makeResult("tp-1", "true-positive", [], [makeViolation()], true)]),
      resultsDir
    );

    const historyDir = path.join(resultsDir, "history");
    const files = fs.readdirSync(historyDir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);

    const snapshot = JSON.parse(fs.readFileSync(path.join(historyDir, files[0]), "utf-8"));
    expect(snapshot.recall).toBe(1);
    expect(snapshot.passedCaseIds).toEqual(["tp-1"]);
    expect(snapshot.failedCaseIds).toEqual([]);
  });
});

describe("postSummaryToGitHub", () => {
  beforeEach(clearEnv);
  afterEach(() => {
    clearEnv();
    for (const [key, value] of originalValues) {
      if (value !== undefined) process.env[key] = value;
    }
  });

  it("bỏ qua im lặng (không throw) khi không chạy trong ngữ cảnh pull_request", async () => {
    // Không set GITHUB_REPOSITORY/GITHUB_REF/GITHUB_TOKEN — mô phỏng run nightly/manual.
    await expect(postSummaryToGitHub(buildSummary([]))).resolves.toBeUndefined();
  });
});
