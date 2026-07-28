import micromatch from "micromatch";
import type { Policy } from "./types";

/**
 * Selects policies relevant to the given changed files. A policy with an empty
 * `scope` applies globally (e.g. a Git Workflow rule not tied to file type);
 * otherwise it applies only if at least one changed file matches its scope globs.
 */
export function routePolicies(policies: Policy[], changedFiles: string[]): Policy[] {
  return policies.filter((policy) => {
    if (policy.scope.length === 0) return true;
    return changedFiles.some((file) => micromatch.isMatch(file, policy.scope));
  });
}
