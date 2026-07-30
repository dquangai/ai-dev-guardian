import type { Violation } from "./types";

export interface PromptToFixInput {
  location: string;
  policyName: string;
  riskLevel: Violation["riskLevel"];
  errorWhat: string;
  why: string;
  howToFix: string;
  /** Extra requirement specific to this violation type (e.g. remind to rotate a secret). */
  extraRequirement?: string;
}

/**
 * Standard prompt shared by every violation source (secret-scan,
 * architecture-check, semgrep-check, llm-policy-check) — built deterministically
 * from fields already on hand instead of letting the LLM word it itself, so every
 * violation type ends up at the same quality bar and always carries the same
 * safety constraints (no broad refactor, no API changes, no full-file dumps).
 *
 * English: the underlying errorWhat/why/howToFix content (especially from the
 * LLM check) tends to come back in English regardless of the Vietnamese system
 * prompt, so the wrapper is kept in English too to avoid a mixed-language result.
 */
export function buildPromptToFix(input: PromptToFixInput): string {
  const requirements = [
    "1. Only fix the exact faulty code. DO NOT refactor broadly, DO NOT rename functions/variables.",
    "2. Preserve existing business logic and API (unless that is the bug being fixed).",
    "3. Return a snippet/diff, DO NOT print the whole file.",
    "4. Include 1 technical explanation sentence.",
  ];
  if (input.extraRequirement) {
    requirements.push(`5. ${input.extraRequirement}`);
  }

  return `Fix violation of "${input.policyName}" (${input.riskLevel.toUpperCase()}) in \`${input.location}\`.
- Issue: ${input.errorWhat}
- Why: ${input.why}
- Fix: ${input.howToFix}

MANDATORY REQUIREMENTS:
${requirements.join("\n")}`;
}
