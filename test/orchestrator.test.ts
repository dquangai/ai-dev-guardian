import { describe, it, expect, vi } from "vitest";
import { runGuardianCheck } from "../src/orchestrator";
import type { DiffResult } from "../src/git/diff";
import type { Violation } from "../src/report/types";
import type { Policy } from "../src/policy/types";
import { hashDiffText, type GuardianCache } from "../src/cache";

const EMPTY_DIFF: DiffResult = { diffText: "", changedFiles: [] };

// Disables caching by default — tests opt in explicitly where they exercise it.
// Also keeps every test isolated from the real project's .git/guardian_cache.json.
const NO_CACHE = { readCache: (): GuardianCache | null => null, writeCache: (): void => {} };

function violation(overrides: Partial<Violation>): Violation {
  return {
    errorWhat: "lỗi",
    policyViolated: "policy",
    riskLevel: "medium",
    why: "vì",
    howToFix: "sửa",
    promptToFix: null,
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
      ...NO_CACHE,
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
      ...NO_CACHE,
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
      ...NO_CACHE,
    });
    expect(report.verdict).toBe("BLOCK");
  });

  it("không BLOCK nếu tất cả vi phạm chỉ ở mức low, nhưng vẫn báo cáo đầy đủ", async () => {
    const low = violation({ riskLevel: "low" });
    const report = await runGuardianCheck(EMPTY_DIFF, {
      loadPolicies: () => [],
      scanForSecrets: () => [low],
      checkPoliciesWithLLM: async () => [],
      ...NO_CACHE,
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
      ...NO_CACHE,
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
        ...NO_CACHE,
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
      { loadPolicies: () => [], scanForSecrets, checkPoliciesWithLLM, ...NO_CACHE }
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
      ...NO_CACHE,
    });

    expect(scanForSecrets.mock.calls[0][0]).toEqual(diff);
  });

  describe("cache", () => {
    it("bỏ qua checkPoliciesWithLLM khi hash diff khớp cache của lần PASS trước, secretScan vẫn chạy", async () => {
      const diff: DiffResult = { diffText: "same diff content", changedFiles: ["src/app.ts"] };
      const checkPoliciesWithLLM = vi.fn(async () => []);
      const scanForSecrets = vi.fn(() => []);

      const report = await runGuardianCheck(diff, {
        loadPolicies: () => [],
        scanForSecrets,
        checkPoliciesWithLLM,
        readCache: () => ({ passedDiffHashes: [hashDiffText(diff.diffText)] }),
        writeCache: () => {},
      });

      expect(checkPoliciesWithLLM).not.toHaveBeenCalled();
      expect(scanForSecrets).toHaveBeenCalledTimes(1);
      expect(report.verdict).toBe("PASS");
    });

    it("bỏ qua checkPoliciesWithLLM khi hash diff khớp BẤT KỲ hash nào trong danh sách cache (không chỉ hash gần nhất)", async () => {
      const diff: DiffResult = { diffText: "diff từ nhánh cũ", changedFiles: ["src/app.ts"] };
      const checkPoliciesWithLLM = vi.fn(async () => []);

      await runGuardianCheck(diff, {
        loadPolicies: () => [],
        scanForSecrets: () => [],
        checkPoliciesWithLLM,
        readCache: () => ({
          passedDiffHashes: ["hash-nhanh-khac", hashDiffText(diff.diffText), "hash-cu-hon"],
        }),
        writeCache: () => {},
      });

      expect(checkPoliciesWithLLM).not.toHaveBeenCalled();
    });

    it("vẫn chạy checkPoliciesWithLLM khi hash diff khác cache", async () => {
      const diff: DiffResult = { diffText: "new content", changedFiles: ["src/app.ts"] };
      const checkPoliciesWithLLM = vi.fn(async () => []);

      await runGuardianCheck(diff, {
        loadPolicies: () => [],
        scanForSecrets: () => [],
        checkPoliciesWithLLM,
        readCache: () => ({ passedDiffHashes: ["some-other-hash"] }),
        writeCache: () => {},
      });

      expect(checkPoliciesWithLLM).toHaveBeenCalledTimes(1);
    });

    it("vẫn chạy checkPoliciesWithLLM khi chưa có cache (readCache trả về null)", async () => {
      const checkPoliciesWithLLM = vi.fn(async () => []);

      await runGuardianCheck(EMPTY_DIFF, {
        loadPolicies: () => [],
        scanForSecrets: () => [],
        checkPoliciesWithLLM,
        readCache: () => null,
        writeCache: () => {},
      });

      expect(checkPoliciesWithLLM).toHaveBeenCalledTimes(1);
    });

    it("ghi cache với hash của diff khi verdict là PASS", async () => {
      const diff: DiffResult = { diffText: "clean diff", changedFiles: ["src/app.ts"] };
      const writeCache = vi.fn();

      const report = await runGuardianCheck(diff, {
        loadPolicies: () => [],
        scanForSecrets: () => [],
        checkPoliciesWithLLM: async () => [],
        readCache: () => null,
        writeCache,
      });

      expect(report.verdict).toBe("PASS");
      expect(writeCache).toHaveBeenCalledTimes(1);
      expect(writeCache.mock.calls[0][0]).toBe(hashDiffText(diff.diffText));
    });

    it("KHÔNG ghi cache khi verdict là BLOCK", async () => {
      const diff: DiffResult = { diffText: "bad diff", changedFiles: ["src/app.ts"] };
      const writeCache = vi.fn();
      const critical = violation({ riskLevel: "critical" });

      const report = await runGuardianCheck(diff, {
        loadPolicies: () => [],
        scanForSecrets: () => [critical],
        checkPoliciesWithLLM: async () => [],
        readCache: () => null,
        writeCache,
      });

      expect(report.verdict).toBe("BLOCK");
      expect(writeCache).not.toHaveBeenCalled();
    });
  });
});
