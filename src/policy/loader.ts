import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { ArchitectureRule, Policy, Severity } from "./types";

const VALID_SEVERITIES: Severity[] = ["low", "medium", "high", "critical"];

export const DEFAULT_POLICY_DIR = ".guardian/policies";

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return [value];
  return [];
}

/** Parses frontmatter `rules:` into ArchitectureRule[], dropping entries missing `from`/`forbid`. */
function parseRules(value: unknown): ArchitectureRule[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      from: toStringArray(entry.from),
      forbid: toStringArray(entry.forbid),
      description: typeof entry.description === "string" ? entry.description : undefined,
    }))
    .filter((rule) => rule.from.length > 0 && rule.forbid.length > 0);
}

function parsePolicyFile(filePath: string, id: string): Policy {
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  const category = typeof data.category === "string" ? data.category : "Uncategorized";
  const severity = VALID_SEVERITIES.includes(data.severity) ? (data.severity as Severity) : "medium";

  return {
    id,
    category,
    scope: toStringArray(data.scope),
    severity,
    tags: toStringArray(data.tags),
    body: content.trim(),
    rules: parseRules(data.rules),
    dependencyAllowlist: toStringArray(data.dependencyAllowlist),
  };
}

/** Loads every .md policy file under policyDir. Returns [] if the directory doesn't exist. */
export function loadPolicies(policyDir: string = DEFAULT_POLICY_DIR): Policy[] {
  if (!fs.existsSync(policyDir)) return [];

  return fs
    .readdirSync(policyDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => parsePolicyFile(path.join(policyDir, file), file))
    .sort((a, b) => a.id.localeCompare(b.id));
}
