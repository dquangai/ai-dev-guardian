import micromatch from "micromatch";
import type { DiffResult } from "../git/diff";
import { splitDiffByFile } from "../git/diffSplitter";
import type { Policy, TestingStandardsRule } from "../policy/types";
import type { Violation } from "../report/types";
import { buildPromptToFix } from "../report/promptToFix";

interface RuleContext {
  policy: Policy;
  rule: TestingStandardsRule;
}

function collectRuleContexts(policies: Policy[]): RuleContext[] {
  const contexts: RuleContext[] = [];
  for (const policy of policies) {
    for (const rule of policy.testingStandards) {
      contexts.push({ policy, rule });
    }
  }
  return contexts;
}

/** Files in this diff that are brand-new (a "new file mode" line in their diff segment) — a file
 *  only modified, renamed, or deleted doesn't need a fresh test, this rule only cares about code
 *  that didn't exist before this push. */
function newFilesInDiff(diff: DiffResult): string[] {
  const byFile = splitDiffByFile(diff.diffText);
  return diff.changedFiles.filter((file) => {
    const segment = byFile.get(file);
    return segment !== undefined && /^new file mode/m.test(segment);
  });
}

function buildViolation(policy: Policy, rule: TestingStandardsRule, file: string): Violation {
  const policyViolated = `${policy.id} — file mới phải kèm test tương ứng`;
  const errorWhat = `File mới "${file}" khớp pattern "${rule.sourcePattern.join(", ")}" nhưng diff này không đụng file test nào khớp "${rule.testPattern.join(", ")}"`;
  const why =
    rule.description ??
    "Code mới không có test đi kèm dễ để lọt lỗi qua review và không có gì bảo vệ khi refactor sau này.";
  const howToFix = `Thêm 1 file test khớp pattern "${rule.testPattern.join(", ")}" trong cùng lần push này, phủ đúng logic của "${file}".`;

  return {
    errorWhat,
    policyViolated,
    riskLevel: policy.severity,
    why,
    howToFix,
    location: file,
    promptToFix: buildPromptToFix({
      location: file,
      policyName: policyViolated,
      riskLevel: policy.severity,
      errorWhat,
      why,
      howToFix,
    }),
    source: "testing-standards-check",
  };
}

/**
 * Deterministic check — no LLM, file paths only, never reads file content. Policies declare
 * `testingStandards: [{ sourcePattern, testPattern }]` in frontmatter (see policy/types.ts).
 * Severity comes from the owning policy's `severity` field, same policy-driven convention as
 * checkArchitectureRules/checkGitWorkflowRules.
 *
 * Deliberately diff-wide, not a strict per-file 1:1 name match (see TestingStandardsRule's own
 * doc comment for why) — every new file matching `sourcePattern` in a diff is satisfied by the
 * SAME single test-file touch anywhere in that diff, not required to be individually paired.
 */
export function checkTestingStandards(diff: DiffResult, policies: Policy[]): Violation[] {
  const ruleContexts = collectRuleContexts(policies);
  if (ruleContexts.length === 0) return [];

  const newFiles = newFilesInDiff(diff);
  if (newFiles.length === 0) return [];

  const violations: Violation[] = [];

  for (const { policy, rule } of ruleContexts) {
    const newSourceFiles = newFiles.filter((file) => micromatch.isMatch(file, rule.sourcePattern));
    if (newSourceFiles.length === 0) continue;

    const hasTestChange = diff.changedFiles.some((file) => micromatch.isMatch(file, rule.testPattern));
    if (hasTestChange) continue;

    for (const file of newSourceFiles) {
      violations.push(buildViolation(policy, rule, file));
    }
  }

  return violations;
}
