import { describe, it, expect, vi } from "vitest";
import { runGuardianCheck } from "../src/orchestrator";
import type { DiffResult } from "../src/git/diff";
import type { Violation } from "../src/report/types";
import type { Policy } from "../src/policy/types";

const EMPTY_DIFF: DiffResult = { diffText: "", changedFiles: [] };

function violation(overrides: Partial<Violation>): Violation {
  return {
    errorWhat: "lỗi",
    policyViolated: "policy",
    riskLevel: "medium",
    why: "vì",
    howToFix: "sửa",
    autoFix: null,
    source: "secret-scan",
    ...overrides,
  };
}

describe("runGuardianCheck", () => {
  it("trả PASS khi không check nào phát hiện vi phạm", async () => {
    const report = await runGuardianCheck(EMPTY_DIFF, {
      loadPolicies: () => [],
      scanForSecrets: () => [],
      checkPoliciesWithLLM: async () => [],
    });
    expect(report.verdict).toBe("PASS");
    expect(report.violations).toEqual([]);
  });

  it("trả BLOCK khi secret scan phát hiện vi phạm critical", async () => {
    const critical = violation({ riskLevel: "critical", source: "secret-scan" });
    const report = await runGuardianCheck(EMPTY_DIFF, {
      loadPolicies: () => [],
      scanForSecrets: () => [critical],
      checkPoliciesWithLLM: async () => [],
    });
    expect(report.verdict).toBe("BLOCK");
    expect(report.violations).toEqual([critical]);
  });

  it("trả BLOCK khi LLM policy check phát hiện vi phạm medium", async () => {
    const medium = violation({ riskLevel: "medium", source: "llm-policy-check" });
    const report = await runGuardianCheck(EMPTY_DIFF, {
      loadPolicies: () => [],
      scanForSecrets: () => [],
      checkPoliciesWithLLM: async () => [medium],
    });
    expect(report.verdict).toBe("BLOCK");
  });

  it("không BLOCK nếu tất cả vi phạm chỉ ở mức low, nhưng vẫn báo cáo đầy đủ", async () => {
    const low = violation({ riskLevel: "low" });
    const report = await runGuardianCheck(EMPTY_DIFF, {
      loadPolicies: () => [],
      scanForSecrets: () => [low],
      checkPoliciesWithLLM: async () => [],
    });
    expect(report.verdict).toBe("PASS");
    expect(report.violations).toEqual([low]);
  });

  it("gộp vi phạm từ cả secret scan và LLM policy check", async () => {
    const secretViolation = violation({ source: "secret-scan", riskLevel: "critical" });
    const llmViolation = violation({ source: "llm-policy-check", riskLevel: "high" });
    const report = await runGuardianCheck(EMPTY_DIFF, {
      loadPolicies: () => [],
      scanForSecrets: () => [secretViolation],
      checkPoliciesWithLLM: async () => [llmViolation],
    });
    expect(report.verdict).toBe("BLOCK");
    expect(report.violations).toHaveLength(2);
  });

  it("chỉ route các policy có scope khớp changedFiles tới checkPoliciesWithLLM", async () => {
    const matched: Policy = {
      id: "match.md",
      category: "Test",
      scope: ["src/**/*.ts"],
      severity: "medium",
      tags: [],
      body: "body",
    };
    const unmatched: Policy = {
      id: "nomatch.md",
      category: "Test",
      scope: ["docs/**/*.md"],
      severity: "medium",
      tags: [],
      body: "body",
    };
    const checkPoliciesWithLLM = vi.fn(async () => []);

    await runGuardianCheck(
      { diffText: "", changedFiles: ["src/app.ts"] },
      {
        loadPolicies: () => [matched, unmatched],
        scanForSecrets: () => [],
        checkPoliciesWithLLM,
      }
    );

    expect(checkPoliciesWithLLM).toHaveBeenCalledTimes(1);
    const policiesArg = checkPoliciesWithLLM.mock.calls[0][1];
    expect(policiesArg.map((p) => p.id)).toEqual(["match.md"]);
  });

  it("loại bỏ file trong test/ khỏi diff trước khi đưa vào secretScan và checkPoliciesWithLLM", async () => {
    const diffText = [
      "diff --git a/src/app.ts b/src/app.ts",
      "--- a/src/app.ts",
      "+++ b/src/app.ts",
      "@@ -1,1 +1,1 @@",
      "-old",
      "+new",
      "diff --git a/test/secretScan.test.ts b/test/secretScan.test.ts",
      "--- a/test/secretScan.test.ts",
      "+++ b/test/secretScan.test.ts",
      "@@ -1,1 +1,1 @@",
      '-old',
      '+const fakeKey = "AKIAABCDEFGHIJKLMNOP";',
    ].join("\n");

    const scanForSecrets = vi.fn(() => []);
    const checkPoliciesWithLLM = vi.fn(async () => []);

    await runGuardianCheck(
      { diffText, changedFiles: ["src/app.ts", "test/secretScan.test.ts"] },
      { loadPolicies: () => [], scanForSecrets, checkPoliciesWithLLM }
    );

    const secretsDiffArg = scanForSecrets.mock.calls[0][0] as DiffResult;
    const llmDiffArg = checkPoliciesWithLLM.mock.calls[0][0] as DiffResult;

    expect(secretsDiffArg.changedFiles).toEqual(["src/app.ts"]);
    expect(secretsDiffArg.diffText).not.toContain("test/secretScan.test.ts");
    expect(llmDiffArg.changedFiles).toEqual(["src/app.ts"]);
    expect(llmDiffArg.diffText).not.toContain("AKIAABCDEFGHIJKLMNOP");
  });

  it("giữ nguyên diff nếu không có file nào bị ignore", async () => {
    const scanForSecrets = vi.fn(() => []);
    const diff: DiffResult = { diffText: "unchanged", changedFiles: ["src/app.ts"] };

    await runGuardianCheck(diff, {
      loadPolicies: () => [],
      scanForSecrets,
      checkPoliciesWithLLM: async () => [],
    });

    expect(scanForSecrets.mock.calls[0][0]).toEqual(diff);
  });
});
