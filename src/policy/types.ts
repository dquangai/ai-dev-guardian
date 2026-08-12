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
