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
}
