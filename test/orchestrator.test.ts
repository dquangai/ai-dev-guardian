import { describe, it, expect, vi } from "vitest";
import { runGuardianCheck } from "../src/orchestrator";
import type { DiffResult } from "../src/git/diff";

/** Small, focused regression test for the graceful-degrade fix: a PASS built on an LLM check that
 * threw (network error, invalid/expired key) must never be cached as verified-clean — same
 * reasoning that already protects the "no provider configured" case. Not a full orchestrator
 * test suite by design (see git history: a much larger one was added then deliberately removed). */

const DIFF: DiffResult = {
  diffText: "diff --git a/x.ts b/x.ts\n--- a/x.ts\n+++ b/x.ts\n@@ -1,1 +1,1 @@\n-a\n+b",
  changedFiles: ["x.ts"],
};

const NOOP_DEPS = {
  loadPolicies: () => [],
  scanForSecrets: () => [],
  checkCircularDependencies: async () => [],
  checkArchitectureRules: async () => [],
  checkDependencyRules: () => [],
  checkWithSemgrep: async () => [],
  readCache: () => null,
};

describe("runGuardianCheck — cache guard cho LLM check bị degrade", () => {
  it("PASS nhưng LLM check degrade (onLLMCheckError) → KHÔNG cache", async () => {
    const writeCache = vi.fn();

    const report = await runGuardianCheck(DIFF, {
      ...NOOP_DEPS,
      writeCache,
      resolveLLMClient: () => ({ provider: "openai", client: {} as never }),
      checkPoliciesWithLLM: async (_diff, _policies, deps) => {
        deps?.onLLMCheckError?.("x.ts", new Error("401 invalid key"));
        return [];
      },
    });

    expect(report.verdict).toBe("PASS");
    expect(writeCache).not.toHaveBeenCalled();
  });

  it("PASS và LLM check chạy sạch (không degrade) → CÓ cache", async () => {
    const writeCache = vi.fn();

    const report = await runGuardianCheck(DIFF, {
      ...NOOP_DEPS,
      writeCache,
      resolveLLMClient: () => ({ provider: "openai", client: {} as never }),
      checkPoliciesWithLLM: async () => [],
    });

    expect(report.verdict).toBe("PASS");
    expect(writeCache).toHaveBeenCalledTimes(1);
  });

  it("BLOCK verdict → không bao giờ cache, kể cả khi LLM check không degrade", async () => {
    const writeCache = vi.fn();

    const report = await runGuardianCheck(DIFF, {
      ...NOOP_DEPS,
      writeCache,
      resolveLLMClient: () => ({ provider: "openai", client: {} as never }),
      checkPoliciesWithLLM: async () => [
        {
          errorWhat: "x",
          policyViolated: "y",
          riskLevel: "critical",
          why: "z",
          howToFix: "w",
          location: "x.ts",
          promptToFix: "p",
          source: "llm-policy-check",
        },
      ],
    });

    expect(report.verdict).toBe("BLOCK");
    expect(writeCache).not.toHaveBeenCalled();
  });
});
