import path from "node:path";
import micromatch from "micromatch";
import type { DiffResult } from "../git/diff";
import type { ArchitectureRule, Policy } from "../policy/types";
import type { Violation } from "../report/types";
import { buildPromptToFix } from "../report/promptToFix";
import { TS_JS_EXTENSIONS, buildMadgeInstance, toPosix } from "./madgeInstance";

interface RuleContext {
  policy: Policy;
  rule: ArchitectureRule;
}

function collectRuleContexts(policies: Policy[]): RuleContext[] {
  const contexts: RuleContext[] = [];
  for (const policy of policies) {
    for (const rule of policy.rules) {
      contexts.push({ policy, rule });
    }
  }
  return contexts;
}

function buildViolation(policy: Policy, rule: ArchitectureRule, from: string, to: string): Violation {
  const location = `${from} → ${to}`;
  const policyViolated = `${policy.id} — cấm import từ "${rule.from.join(", ")}" tới "${rule.forbid.join(", ")}"`;
  const errorWhat = `"${from}" import "${to}", vi phạm rule kiến trúc trong policy "${policy.id}"`;
  const why =
    rule.description ??
    "Import này phá vỡ ranh giới layer kiến trúc đã định nghĩa trong policy, dễ dẫn tới coupling chặt và circular dependency về sau.";
  const howToFix =
    "Xoá import vi phạm; nếu cần dùng chung logic, tách phần đó ra một module trung lập mà cả hai layer cùng được phép phụ thuộc, hoặc đảo chiều phụ thuộc bằng interface/dependency injection.";

  return {
    errorWhat,
    policyViolated,
    riskLevel: policy.severity,
    why,
    howToFix,
    location,
    promptToFix: buildPromptToFix({
      location,
      policyName: policyViolated,
      riskLevel: policy.severity,
      errorWhat,
      why,
      howToFix,
    }),
    source: "architecture-rules-check",
  };
}

/**
 * Deterministic, madge-based forbidden-import check — no LLM involved.
 * Policies declare `rules: [{ from, forbid }]` in frontmatter (see
 * policy/types.ts); a rule fires when a changed file matching `from` imports
 * (directly) anything matching `forbid`. Severity comes from the owning
 * policy's `severity` field — policy-driven, same convention as
 * checkCircularDependencies.
 *
 * Scoped to TS/JS/JSX/MJS/CJS (madge's parse surface) and to files actually
 * touched by this diff — a forbidden import that already existed before this
 * push is not this push's problem to fix.
 *
 * Fail-safe: any madge error is swallowed and treated as "no violations
 * found", consistent with every other architecture check in Guardian.
 */
export async function checkArchitectureRules(
  diff: DiffResult,
  policies: Policy[],
  cwd: string = process.cwd()
): Promise<Violation[]> {
  const ruleContexts = collectRuleContexts(policies);
  if (ruleContexts.length === 0) return [];

  const hasTsJsChange = diff.changedFiles.some((file) => TS_JS_EXTENSIONS.has(path.extname(file)));
  if (!hasTsJsChange) return [];

  const instance = await buildMadgeInstance(cwd);
  if (!instance) return [];
  const graph = instance.obj();

  const changedFiles = new Set(diff.changedFiles.map(toPosix));
  const violations: Violation[] = [];

  for (const [file, imports] of Object.entries(graph)) {
    const posixFile = toPosix(file);
    if (!changedFiles.has(posixFile)) continue;

    for (const { policy, rule } of ruleContexts) {
      if (!micromatch.isMatch(posixFile, rule.from)) continue;

      const forbiddenImports = imports.map(toPosix).filter((imported) => micromatch.isMatch(imported, rule.forbid));
      for (const imported of forbiddenImports) {
        violations.push(buildViolation(policy, rule, posixFile, imported));
      }
    }
  }

  return violations;
}
