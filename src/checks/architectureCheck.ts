import path from "node:path";
import type { DiffResult } from "../git/diff";
import type { Policy, Severity } from "../policy/types";
import type { Violation } from "../report/types";
import { buildPromptToFix } from "../report/promptToFix";
import { TS_JS_EXTENSIONS, buildMadgeInstance, toPosix } from "./madgeInstance";

function formatChain(chain: string[]): string {
  return [...chain, chain[0]].join(" → ");
}

/**
 * Severity for circular-dependency violations comes from the first loaded
 * policy that defines architecture `rules` (i.e. the project's architecture
 * policy, see .guardian/policies/architecture.policy.md) — policy-driven
 * instead of hardcoded. Falls back to "medium" if no such policy is loaded,
 * so this check still works standalone (e.g. in tests that pass no policies).
 */
function resolveSeverity(policies: Policy[]): Severity {
  return policies.find((p) => p.rules.length > 0)?.severity ?? "medium";
}

/**
 * Deterministic, madge-based circular-dependency check — no LLM involved.
 * Scoped to TS/JS/JSX/MJS/CJS only (madge doesn't parse Python/Go/C).
 *
 * Runs a whole-repo dependency walk (madge has no diff-scoped mode) but only
 * *reports* chains that include at least one file from this push's diff —
 * pre-existing cycles the push doesn't touch are never flagged, consistent
 * with every other check in Guardian being scoped to the current diff.
 *
 * Fail-safe: any madge error (missing tsconfig, unparseable project, ...)
 * is swallowed and treated as "no violations found" — this is a best-effort
 * enrichment check, never allowed to block a push on its own failure.
 */
export async function checkCircularDependencies(
  diff: DiffResult,
  policies: Policy[] = [],
  cwd: string = process.cwd()
): Promise<Violation[]> {
  const hasTsJsChange = diff.changedFiles.some((file) => TS_JS_EXTENSIONS.has(path.extname(file)));
  if (!hasTsJsChange) return [];

  const instance = await buildMadgeInstance(cwd);
  if (!instance) return [];
  const chains = instance.circular();

  const severity = resolveSeverity(policies);
  const changedFiles = new Set(diff.changedFiles.map(toPosix));
  const violations: Violation[] = [];

  for (const chain of chains) {
    const posixChain = chain.map(toPosix);
    if (!posixChain.some((file) => changedFiles.has(file))) continue;

    const location = formatChain(posixChain);
    const policyViolated = "Architecture Policy — không được có circular dependency giữa các module";
    const errorWhat = `Phát hiện circular dependency liên quan tới thay đổi trong diff: ${location}`;
    const why =
      "Circular dependency khiến các module không thể test/refactor độc lập, dễ gây lỗi thứ tự khởi tạo (init order) khó debug, và là dấu hiệu ranh giới trách nhiệm giữa các module chưa rõ ràng.";
    const howToFix =
      "Tách phần logic dùng chung của các module trong vòng lặp ra một module mới mà cả hai cùng phụ thuộc, hoặc đảo một chiều phụ thuộc bằng interface/dependency injection.";

    violations.push({
      errorWhat,
      policyViolated,
      riskLevel: severity,
      why,
      howToFix,
      location,
      promptToFix: buildPromptToFix({
        location,
        policyName: policyViolated,
        riskLevel: severity,
        errorWhat,
        why,
        howToFix,
      }),
      source: "architecture-check",
    });
  }

  return violations;
}
