import type { DiffResult } from "./git/diff";
import { loadPolicies } from "./policy/loader";
import { routePolicies } from "./policy/router";
import { scanForSecrets } from "./checks/secretScan";
import { checkPoliciesWithLLM } from "./checks/llmPolicyCheck";
import type { CheckReport, Violation } from "./report/types";

// low findings are surfaced but don't block; medium+ blocks the push.
const BLOCKING_SEVERITIES = new Set(["medium", "high", "critical"]);

export interface OrchestratorDeps {
  loadPolicies: typeof loadPolicies;
  scanForSecrets: typeof scanForSecrets;
  checkPoliciesWithLLM: typeof checkPoliciesWithLLM;
}

export async function runGuardianCheck(
  diff: DiffResult,
  deps: Partial<OrchestratorDeps> = {}
): Promise<CheckReport> {
  const _loadPolicies = deps.loadPolicies ?? loadPolicies;
  const _scanForSecrets = deps.scanForSecrets ?? scanForSecrets;
  const _checkPoliciesWithLLM = deps.checkPoliciesWithLLM ?? checkPoliciesWithLLM;

  const allPolicies = _loadPolicies();
  const matchedPolicies = routePolicies(allPolicies, diff.changedFiles);

  const [secretViolations, llmViolations] = await Promise.all([
    Promise.resolve(_scanForSecrets(diff)),
    _checkPoliciesWithLLM(diff, matchedPolicies),
  ]);

  const violations: Violation[] = [...secretViolations, ...llmViolations];
  const verdict = violations.some((v) => BLOCKING_SEVERITIES.has(v.riskLevel)) ? "BLOCK" : "PASS";

  return { verdict, violations };
}
