export type Severity = "low" | "medium" | "high" | "critical";

export interface Policy {
  /** Filename relative to .guardian/policies, used as a stable reference in reports. */
  id: string;
  category: string;
  scope: string[];
  severity: Severity;
  tags: string[];
  /** Markdown body below the frontmatter — the rule text handed to the LLM verbatim. */
  body: string;
}
