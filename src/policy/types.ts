export type Severity = "low" | "medium" | "high" | "critical";

/**
 * One forbidden-import rule: any file matching `from` must not import
 * anything matching `forbid`. Checked deterministically against madge's
 * dependency graph — see checks/architectureRulesCheck.ts.
 */
export interface ArchitectureRule {
  from: string[];
  forbid: string[];
  /** Optional human-readable reason, used as the violation's "why" instead of the generic default. */
  description?: string;
}

/**
 * One git-workflow rule: branch naming and/or commit-message format, checked deterministically
 * against git metadata (not file content) — see checks/gitWorkflowCheck.ts. Either pattern may be
 * omitted to check only the other.
 */
export interface GitWorkflowRule {
  /** Regex source the current branch name must match, e.g. "^(feature|fix|chore|docs)/[a-z0-9-]+$". */
  branchPattern?: string;
  /** Branch names exempt from branchPattern entirely — a protected/trunk branch (e.g. "main",
   *  "master") doesn't follow a feature-branch naming scheme, so it shouldn't be flagged just for
   *  being checked out directly. */
  exemptBranches?: string[];
  /**
   * Regex source the HEAD commit's subject line (first line only) must match, e.g. Conventional
   * Commits' `^(feat|fix|docs|chore|refactor|test)(\(.+\))?: .+`. MVP: only checks the single most
   * recent commit, not every commit in a multi-commit push range (see checkGitWorkflowRules) —
   * Guardian is a pre-push/pre-staged tool, not a commit-msg hook with per-commit visibility.
   */
  commitPattern?: string;
  /** Optional human-readable reason, used as the violation's "why" instead of the generic default. */
  description?: string;
}

/**
 * One testing-standards rule: a brand-new file matching `sourcePattern` requires the same diff to
 * also touch at least one file matching `testPattern` — checked deterministically (file paths
 * only, not content) — see checks/testingStandardsCheck.ts.
 *
 * Deliberately NOT a strict 1:1 name-matched pair (e.g. "auth.ts" -> "auth.test.ts"): this repo's
 * own convention alone breaks that assumption (`src/server/routes/auth.ts` is tested by
 * `test/authRouter.test.ts`, `policies.ts` by `test/policyRouter.test.ts` — no shared basename).
 * Satisfaction is diff-wide: if the diff touches ANY file matching `testPattern`, every new file
 * matching `sourcePattern` in that same diff is considered covered.
 */
export interface TestingStandardsRule {
  /** Glob(s) — a brand-new file (not just modified) matching any of these requires a test change. */
  sourcePattern: string[];
  /** Glob(s) — the diff must touch at least one file matching any of these to satisfy the rule. */
  testPattern: string[];
  /** Optional human-readable reason, used as the violation's "why" instead of the generic default. */
  description?: string;
}

export interface Policy {
  /** Filename relative to .guardian/policies, used as a stable reference in reports. */
  id: string;
  category: string;
  scope: string[];
  severity: Severity;
  tags: string[];
  /** Markdown body below the frontmatter — the rule text handed to the LLM verbatim. */
  body: string;
  /** Architecture import rules this policy defines; [] if it defines none. */
  rules: ArchitectureRule[];
  /**
   * Glob patterns for package names allowed as new dependencies (e.g.
   * "@anthropic-ai/*"); [] if this policy defines no dependency allowlist.
   * See checks/dependencyRulesCheck.ts.
   */
  dependencyAllowlist: string[];
  /** Git-workflow rules this policy defines; [] if it defines none. See checks/gitWorkflowCheck.ts. */
  gitWorkflow: GitWorkflowRule[];
  /** Testing-standards rules this policy defines; [] if it defines none. See checks/testingStandardsCheck.ts. */
  testingStandards: TestingStandardsRule[];
  /**
   * When true, comment-only diff lines are kept as valid evidence for
   * violations of THIS policy (see isEvidenceGrounded in llmPolicyCheck.ts,
   * which otherwise strips every comment-only line from the grounding pool
   * by default). Only set this on policies whose violation is legitimately
   * the comment itself — e.g. commented-out code, a disabled check left as a
   * comment — never on policies where a comment merely *describing* a
   * concept must not be mistaken for code exhibiting it (the default/false
   * behavior exists specifically to prevent that class of false positive).
   */
  allowCommentEvidence: boolean;
}
