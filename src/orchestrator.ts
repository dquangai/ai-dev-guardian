import type { DiffResult } from "./git/diff";
import { splitDiffByFile } from "./git/diffSplitter";
import { isIgnoredPath } from "./git/ignorePaths";
import { loadPolicies } from "./policy/loader";
import { routePolicies } from "./policy/router";
import { scanForSecrets } from "./checks/secretScan";
import { checkPoliciesWithLLM } from "./checks/llmPolicyCheck";
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

  const filteredDiff = excludeIgnoredFiles(diff);
  const allPolicies = _loadPolicies();
  const matchedPolicies = routePolicies(allPolicies, filteredDiff.changedFiles);

  // Same diff text as a prior PASS -> skip the paid LLM call (secretScan
  // still always runs — it's free/deterministic, no reason to cache it).
  const diffHash = hashDiffText(filteredDiff.diffText);
  const cacheHit = _readCache()?.passedDiffHashes.includes(diffHash) ?? false;

  const runLLMCheck = async (): Promise<Violation[]> => {
    if (cacheHit) {
      console.log("[guardian] Bỏ qua quét AI: Không có thay đổi nào kể từ lần quét (PASS) trước.");
      return [];
    }
    return _checkPoliciesWithLLM(filteredDiff, matchedPolicies);
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

  // Only cache a clean result — a BLOCK must always be re-scanned after a fix.
  if (verdict === "PASS") {
    _writeCache(diffHash);
  }

  return { verdict, violations };
}
