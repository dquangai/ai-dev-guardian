import type { DiffResult } from "./git/diff";
import { splitDiffByFile } from "./git/diffSplitter";
import { isIgnoredPath } from "./git/ignorePaths";
import { blameLine, findEvidenceLine } from "./git/blame";
import { loadPolicies } from "./policy/loader";
import { routePolicies } from "./policy/router";
import { scanForSecrets } from "./checks/secretScan";
import { checkPoliciesWithLLM } from "./checks/llmPolicyCheck";
import { resolveLLMClient } from "./checks/llm/resolveClient";
import { checkCircularDependencies } from "./checks/architectureCheck";
import { checkArchitectureRules } from "./checks/architectureRulesCheck";
import { checkDependencyRules } from "./checks/dependencyRulesCheck";
import { checkWithSemgrep } from "./checks/semgrepCheck";
import { hashDiffText, readCache, writeCache } from "./cache";
import type { CheckReport, Violation } from "./report/types";

// low findings are surfaced but don't block; medium+ blocks the push.
const BLOCKING_SEVERITIES = new Set(["medium", "high", "critical"]);

export interface OrchestratorDeps {
  loadPolicies: typeof loadPolicies;
  scanForSecrets: typeof scanForSecrets;
  checkPoliciesWithLLM: typeof checkPoliciesWithLLM;
  checkCircularDependencies: typeof checkCircularDependencies;
  checkArchitectureRules: typeof checkArchitectureRules;
  checkDependencyRules: typeof checkDependencyRules;
  checkWithSemgrep: typeof checkWithSemgrep;
  readCache: typeof readCache;
  writeCache: typeof writeCache;
  resolveLLMClient: typeof resolveLLMClient;
}

/**
 * Drops test/fixture files from the diff before either check sees it — they
 * intentionally contain fake secrets and adversarial policy content to
 * exercise secretScan/llmPolicyCheck, which would otherwise always false-positive.
 */
function excludeIgnoredFiles(diff: DiffResult): DiffResult {
  const changedFiles = diff.changedFiles.filter((file) => !isIgnoredPath(file));
  if (changedFiles.length === diff.changedFiles.length) return diff;

  const diffByFile = splitDiffByFile(diff.diffText);
  const diffText = changedFiles
    .map((file) => diffByFile.get(file))
    .filter((segment): segment is string => segment !== undefined)
    .join("\n");

  return { diffText, changedFiles };
}

const FILE_LINE_LOCATION_PATTERN = /^(.+):(\d+)$/;

/**
 * Where to point `git blame` for this violation: either the line found by matching
 * `evidenceSnippet` against the diff (secret-scan, llm-policy-check), or a `file:line` already
 * baked into `location` by the check itself (semgrep-check). Violations whose location spans
 * multiple files or targets `package.json` as a whole (architecture/dependency checks) resolve to
 * null — component ownership only makes sense for a single violating line.
 */
function resolveBlameTarget(v: Violation, diffText: string): { file: string; line: number } | null {
  if (v.evidenceSnippet) {
    const line = findEvidenceLine(diffText, v.location, v.evidenceSnippet);
    if (line !== null) return { file: v.location, line };
  }
  const match = FILE_LINE_LOCATION_PATTERN.exec(v.location);
  return match ? { file: match[1], line: Number(match[2]) } : null;
}

/**
 * Attaches `author` (last person to touch the violating line, via `git blame`) to every violation
 * where a single line can be resolved — mutates in place so `promptToFix`, already built by each
 * check, doesn't need to be rebuilt. Best-effort: a violation simply keeps `author` unset if
 * nothing can be resolved or blame fails, same "never block the actual check" guarantee as the
 * diff-hash cache.
 *
 * Always strips `evidenceSnippet` before returning, attribution succeeded or not — it's an
 * internal-only lookup key (for secret-scan it's the RAW, unmasked matched secret) and must never
 * reach `CheckReport` callers: the dashboard persists violations verbatim to
 * `.guardian/audit-history.json` and serves them over the API (see server/store/auditStore.ts), so
 * leaving it on would silently defeat secretScan's own masking in `errorWhat`.
 */
async function attributeAuthors(violations: Violation[], diffText: string): Promise<void> {
  await Promise.all(
    violations.map(async (v) => {
      const target = resolveBlameTarget(v, diffText);
      if (target) {
        const author = await blameLine(target.file, target.line);
        if (author) v.author = author;
      }
      delete v.evidenceSnippet;
    })
  );
}

export async function runGuardianCheck(
  diff: DiffResult,
  deps: Partial<OrchestratorDeps> = {}
): Promise<CheckReport> {
  const _loadPolicies = deps.loadPolicies ?? loadPolicies;
  const _scanForSecrets = deps.scanForSecrets ?? scanForSecrets;
  const _checkPoliciesWithLLM = deps.checkPoliciesWithLLM ?? checkPoliciesWithLLM;
  const _checkCircularDependencies = deps.checkCircularDependencies ?? checkCircularDependencies;
  const _checkArchitectureRules = deps.checkArchitectureRules ?? checkArchitectureRules;
  const _checkDependencyRules = deps.checkDependencyRules ?? checkDependencyRules;
  const _checkWithSemgrep = deps.checkWithSemgrep ?? checkWithSemgrep;
  const _readCache = deps.readCache ?? readCache;
  const _writeCache = deps.writeCache ?? writeCache;
  const _resolveLLMClient = deps.resolveLLMClient ?? resolveLLMClient;

  const filteredDiff = excludeIgnoredFiles(diff);
  const allPolicies = _loadPolicies();
  const matchedPolicies = routePolicies(allPolicies, filteredDiff.changedFiles);

  // Same diff text as a prior PASS -> skip the paid LLM call (secretScan
  // still always runs — it's free/deterministic, no reason to cache it).
  const diffHash = hashDiffText(filteredDiff.diffText);
  const cacheHit = _readCache()?.passedDiffHashes.includes(diffHash) ?? false;

  // Set by onLLMCheckError below if any file's LLM call throws (network error, invalid/expired
  // key, rate limit...) — a PASS built on a degraded LLM check must not be cached as verified-clean
  // (see the caching guard further down), same reasoning as llmCheckSkippedForMissingProvider.
  let llmCheckDegraded = false;

  const runLLMCheck = async (): Promise<Violation[]> => {
    if (cacheHit) {
      console.log("[guardian] Bỏ qua quét AI: Không có thay đổi nào kể từ lần quét (PASS) trước.");
      return [];
    }
    return _checkPoliciesWithLLM(filteredDiff, matchedPolicies, {
      onLLMCheckError: () => {
        llmCheckDegraded = true;
      },
    });
  };

  const [
    secretViolations,
    llmViolations,
    circularViolations,
    architectureRuleViolations,
    dependencyRuleViolations,
    semgrepViolations,
  ] = await Promise.all([
    Promise.resolve(_scanForSecrets(filteredDiff)),
    runLLMCheck(),
    _checkCircularDependencies(filteredDiff, matchedPolicies),
    _checkArchitectureRules(filteredDiff, matchedPolicies),
    Promise.resolve(_checkDependencyRules(filteredDiff, matchedPolicies)),
    _checkWithSemgrep(filteredDiff),
  ]);

  const violations: Violation[] = [
    ...secretViolations,
    ...llmViolations,
    ...circularViolations,
    ...architectureRuleViolations,
    ...dependencyRuleViolations,
    ...semgrepViolations,
  ];
  const verdict = violations.some((v) => BLOCKING_SEVERITIES.has(v.riskLevel)) ? "BLOCK" : "PASS";

  // A PASS is only safe to cache if the LLM check genuinely ran this time (or
  // was validly skipped because an earlier real run already cached this exact
  // diff as clean). If it ran neither — no provider configured, and this diff
  // was never checked before — caching it as PASS would hide any real
  // violation from every future run of this same diff, permanently, even
  // after a valid API key is added.
  const llmCheckSkippedForMissingProvider = !cacheHit && _resolveLLMClient() === null;

  // Only cache a clean result — a BLOCK must always be re-scanned after a fix.
  if (verdict === "PASS" && !llmCheckSkippedForMissingProvider && !llmCheckDegraded) {
    _writeCache(diffHash);
  }

  await attributeAuthors(violations, filteredDiff.diffText);

  return { verdict, violations };
}
