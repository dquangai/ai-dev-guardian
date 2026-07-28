import micromatch from "micromatch";

// Test fixtures intentionally contain fake secrets / adversarial content to
// exercise secretScan and the LLM policy check — scanning them for real would
// always be a false positive. Excluded from both checks by default.
export const DEFAULT_IGNORE_GLOBS = ["test/**", "**/*.test.ts", "**/*.spec.ts"];

export function isIgnoredPath(file: string, globs: string[] = DEFAULT_IGNORE_GLOBS): boolean {
  return micromatch.isMatch(file, globs);
}
