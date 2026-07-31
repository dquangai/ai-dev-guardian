import fs from "node:fs";
import path from "node:path";
import micromatch from "micromatch";
import type { DiffResult } from "../git/diff";
import { splitDiffByFile } from "../git/diffSplitter";
import type { Policy } from "../policy/types";
import type { Violation } from "../report/types";
import { buildPromptToFix } from "../report/promptToFix";

const PACKAGE_JSON = "package.json";
const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;
// Matches an added/removed `"name": "version"` line anywhere in the diff —
// deliberately NOT scoped to a JSON section by indentation/bracket-tracking,
// because git's default 3-line hunk context often doesn't include the
// section's opening `{` at all (confirmed against a real diff where the
// change was several lines into "dependencies"). Section membership is
// instead verified against the real on-disk package.json below.
const DEPENDENCY_LINE = /^([+-])\s*"([^"]+)"\s*:\s*"([^"]+)"/;

interface DependencyChanges {
  added: Map<string, string>;
  removed: Map<string, string>;
}

/** Every added/removed `"name": "version"`-shaped line in the package.json diff segment, unfiltered by section. */
function extractDependencyLineChanges(diffText: string): DependencyChanges {
  const added = new Map<string, string>();
  const removed = new Map<string, string>();

  const segment = splitDiffByFile(diffText).get(PACKAGE_JSON);
  if (!segment) return { added, removed };

  for (const line of segment.split("\n")) {
    const match = DEPENDENCY_LINE.exec(line);
    if (!match) continue;

    const [, sign, name, version] = match;
    (sign === "+" ? added : removed).set(name, version);
  }

  return { added, removed };
}

/**
 * Package names actually declared under a dependency field in the current
 * on-disk package.json (the diff's "after" state — always present locally,
 * whether this runs pre-commit or pre-push). Used to confirm a candidate
 * line from the diff is really a dependency and not, say, an added `scripts`
 * or `engines` entry that happens to match `"key": "string"` shape.
 *
 * Fail-safe: returns an empty set (never throws) if package.json is missing
 * or unparseable — this check simply finds nothing to flag in that case.
 */
function readCurrentDependencyNames(cwd: string): Set<string> {
  try {
    const raw = fs.readFileSync(path.join(cwd, PACKAGE_JSON), "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const names = new Set<string>();
    for (const field of DEPENDENCY_FIELDS) {
      const section = parsed[field];
      if (section && typeof section === "object") {
        for (const name of Object.keys(section)) names.add(name);
      }
    }
    return names;
  } catch {
    return new Set();
  }
}

/**
 * A dependency is genuinely new only if it appears as an added key that
 * never appeared as a removed key in the same diff — a version bump
 * ("-name": "1.0.0" / "+name": "1.1.0") shows up in both maps and must NOT
 * be flagged — and it's confirmed to actually be a dependency name on disk.
 */
function newDependencies(
  changes: DependencyChanges,
  currentDependencyNames: Set<string>
): Array<{ name: string; version: string }> {
  return [...changes.added.entries()]
    .filter(([name]) => !changes.removed.has(name) && currentDependencyNames.has(name))
    .map(([name, version]) => ({ name, version }));
}

/**
 * Policy-driven allowlist: the first loaded policy that declares a non-empty
 * `dependencyAllowlist` governs this check — same "first policy that opts
 * in" convention as architecture severity resolution.
 */
function resolveGoverningPolicy(policies: Policy[]): Policy | undefined {
  return policies.find((p) => p.dependencyAllowlist.length > 0);
}

/**
 * Deterministic check, no LLM involved: flags any dependency newly added to
 * `package.json` in this diff whose name doesn't match the governing
 * policy's `dependencyAllowlist` glob patterns. Scoped to genuinely new
 * dependencies only — bumping the version of an already-approved package
 * never triggers this check.
 */
export function checkDependencyRules(
  diff: DiffResult,
  policies: Policy[],
  cwd: string = process.cwd()
): Violation[] {
  if (!diff.changedFiles.includes(PACKAGE_JSON)) return [];

  const policy = resolveGoverningPolicy(policies);
  if (!policy) return [];

  const changes = extractDependencyLineChanges(diff.diffText);
  const currentDependencyNames = readCurrentDependencyNames(cwd);
  const violations: Violation[] = [];

  for (const { name, version } of newDependencies(changes, currentDependencyNames)) {
    if (micromatch.isMatch(name, policy.dependencyAllowlist)) continue;

    const location = `${PACKAGE_JSON} (${name}@${version})`;
    const policyViolated = `${policy.id} — dependency mới phải khớp allowlist đã duyệt`;
    const errorWhat = `Dependency mới "${name}@${version}" không nằm trong danh sách đã được duyệt`;
    const why =
      "Thêm dependency mới không qua review là một vector rủi ro chuỗi cung ứng (supply-chain) — package độc hại hoặc bị chiếm quyền có thể chạy code tuỳ ý ngay khi cài đặt.";
    const howToFix =
      "Xoá dependency này nếu không thực sự cần thiết; nếu cần dùng, xin duyệt và thêm tên/pattern của nó vào `dependencyAllowlist` trong policy trước khi merge.";

    violations.push({
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
      source: "dependency-rules-check",
    });
  }

  return violations;
}
