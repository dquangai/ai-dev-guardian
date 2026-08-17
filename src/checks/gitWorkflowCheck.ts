import type { DiffResult } from "../git/diff";
import { currentBranchName, headCommitSubject } from "../git/gitMeta";
import type { GitWorkflowRule, Policy } from "../policy/types";
import type { Violation } from "../report/types";
import { buildPromptToFix } from "../report/promptToFix";

interface RuleContext {
  policy: Policy;
  rule: GitWorkflowRule;
}

function collectRuleContexts(policies: Policy[]): RuleContext[] {
  const contexts: RuleContext[] = [];
  for (const policy of policies) {
    for (const rule of policy.gitWorkflow) {
      contexts.push({ policy, rule });
    }
  }
  return contexts;
}

/** A malformed regex in policy frontmatter must never crash the check — same fail-safe convention
 *  as every other deterministic check in Guardian (madge errors, missing package.json, ...). */
function safeRegExp(source: string): RegExp | null {
  try {
    return new RegExp(source);
  } catch {
    return null;
  }
}

function buildViolation(
  policy: Policy,
  rule: GitWorkflowRule,
  kind: "branch" | "commit",
  actual: string,
  pattern: string
): Violation {
  const policyViolated = `${policy.id} — ${kind === "branch" ? "quy ước đặt tên branch" : "quy ước format commit message"}`;
  const errorWhat =
    kind === "branch"
      ? `Tên branch "${actual}" không khớp pattern bắt buộc trong policy "${policy.id}": ${pattern}`
      : `Commit message "${actual}" không khớp pattern bắt buộc trong policy "${policy.id}": ${pattern}`;
  const why =
    rule.description ??
    (kind === "branch"
      ? "Đặt tên branch nhất quán giúp cả team và CI/CD tự động phân loại thay đổi (feature/fix/chore...) mà không cần đọc nội dung."
      : "Commit message nhất quán (ví dụ Conventional Commits) giúp tự sinh changelog và tra cứu lịch sử thay đổi theo loại.");
  const howToFix =
    kind === "branch"
      ? `Đổi tên branch cho khớp pattern, ví dụ: git branch -m <tên-mới-khớp-${pattern}>.`
      : `Sửa lại commit message HEAD cho khớp pattern (ví dụ: git commit --amend -m "..."), rồi push lại.`;
  const location = kind === "branch" ? "<branch>" : "<commit message>";

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
    source: "git-workflow-check",
  };
}

/**
 * Deterministic check against git metadata (branch name, HEAD commit subject) — no file content,
 * no LLM involved. Policies declare `gitWorkflow: [{ branchPattern, exemptBranches,
 * commitPattern }]` in frontmatter (see policy/types.ts). Severity comes from the owning policy's
 * `severity` field, same policy-driven convention as checkArchitectureRules.
 *
 * Skips entirely when nothing changed (nothing being pushed/staged) or no policy defines any
 * gitWorkflow rule — same guard shape as checkArchitectureRules. Fail-safe: any git error (detached
 * HEAD, no commits yet, not a repo) resolves to null and that half of the check is skipped, never
 * thrown.
 */
export async function checkGitWorkflowRules(
  diff: DiffResult,
  policies: Policy[],
  cwd: string = process.cwd()
): Promise<Violation[]> {
  const ruleContexts = collectRuleContexts(policies);
  if (ruleContexts.length === 0 || diff.changedFiles.length === 0) return [];

  const [branch, commitSubject] = await Promise.all([currentBranchName(cwd), headCommitSubject(cwd)]);
  const violations: Violation[] = [];

  for (const { policy, rule } of ruleContexts) {
    if (rule.branchPattern && branch && !(rule.exemptBranches ?? []).includes(branch)) {
      const re = safeRegExp(rule.branchPattern);
      if (re && !re.test(branch)) {
        violations.push(buildViolation(policy, rule, "branch", branch, rule.branchPattern));
      }
    }
    if (rule.commitPattern && commitSubject) {
      const re = safeRegExp(rule.commitPattern);
      if (re && !re.test(commitSubject)) {
        violations.push(buildViolation(policy, rule, "commit", commitSubject, rule.commitPattern));
      }
    }
  }

  return violations;
}
