export interface RawViolation {
  /**
   * Chain-of-thought, generated before the rest of the fields: forces the
   * model to work through (1) what the code actually does, (2) what the
   * policy requires, (3) whether it actually contradicts the policy — before
   * committing to a verdict. Internal only, never shown to the end user.
   */
  reasoning: string;
  errorWhat: string;
  /** Must be one of the policy ids passed to reportViolations for this call. */
  policyId: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  why: string;
  howToFix: string;
  /**
   * Exact line(s) quoted from the diff that trigger this violation — checked
   * against the real diff text before the violation is trusted (grounding,
   * same idea as the policyId enum: the model must point at something real
   * instead of asserting a violation in its own words).
   */
  evidenceSnippet: string;
}

export const REPORT_VIOLATIONS_TOOL_NAME = "report_violations";

export const REPORT_VIOLATIONS_TOOL_DESCRIPTION =
  "Report every policy violation found in the diff. Call with an empty array if the diff complies with all given policies.";

/**
 * Builds the JSON Schema for the structured tool/function call — both
 * Anthropic's input_schema and OpenAI's function parameters accept plain
 * JSON Schema. `policyId` is constrained to an enum of the exact policy ids
 * offered for this call, so the model can't invent a policy reference that
 * wasn't actually given to it (grounding).
 */
export function buildViolationsSchema(policyIds: string[]) {
  return {
    type: "object",
    properties: {
      violations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            reasoning: {
              type: "string",
              description:
                "Think through this BEFORE the other fields, in order: (1) What does this exact " +
                "code/comment/string actually do or represent — is it executing logic, or is it " +
                "prose (a comment, a natural-language string value)? (2) What does the policy " +
                "literally require? (3) Given (1) and (2), does this specific code really " +
                "contradict the policy, or does it only superficially resemble the violation " +
                "(e.g. an English word appearing inside a comment, not the code construct it " +
                "names)? Only report a violation if step (3) concludes yes.",
            },
            errorWhat: {
              type: "string",
              description: "Concrete description of what was found, referencing the specific code.",
            },
            policyId: {
              type: "string",
              enum: policyIds,
              description: "Which policy (by id) this violation breaks. Must be one of the given ids.",
            },
            riskLevel: {
              type: "string",
              enum: ["low", "medium", "high", "critical"],
              description:
                "The policy's own 'severity mặc định' is only a starting hint, not a ceiling or floor — " +
                "judge the actual violation on its own facts. Reserve 'critical' for violations that are " +
                "immediately and unconditionally exploitable with no further conditions needed (a real " +
                "hardcoded secret, authentication completely disabled outright). A violation that is " +
                "serious but still context-dependent or requires an additional precondition to be " +
                "exploited (e.g. a custom authorization check that is plausible but non-standard, a log " +
                "statement that is sensitive but not a full credential) should be 'high', not 'critical' — " +
                "'critical' triggers a stricter double-confirmation check before the violation is kept, so " +
                "reserving it for the unambiguous cases avoids losing a real 'high' finding to that bar.",
            },
            why: { type: "string", description: "Why this matters if left unfixed." },
            howToFix: { type: "string", description: "Concrete remediation guidance." },
            evidenceSnippet: {
              type: "string",
              description:
                "The exact line(s) copied verbatim from the diff below that trigger this violation " +
                "(with or without the leading +/- marker). Do not paraphrase or reconstruct — quote " +
                "real text from the diff. Prefer the SINGLE shortest line that most directly shows the " +
                "violation over a combined/reformatted multi-line summary — if the violation spans several " +
                "lines (e.g. a multi-responsibility function), quote one representative real line (such as " +
                "the function signature) rather than inventing a paraphrase that merges them. This applies " +
                "even when the representative line ITSELF is split across multiple physical lines in the " +
                "diff (e.g. a function signature with one parameter per line) — quote ONLY the first physical " +
                "line of it (e.g. 'export async function checkoutOrder(' alone, NOT " +
                "'export async function checkoutOrder(input: CheckoutInput, db: Database, ...) {' " +
                "reassembled from several lines), never a version reflowed/joined onto one line, since " +
                "that reassembled text does not occur verbatim anywhere in the real diff and will be " +
                "rejected as ungrounded. If no single real physical line can be quoted, do not report this " +
                "as a violation.",
            },
          },
          required: [
            "reasoning",
            "errorWhat",
            "policyId",
            "riskLevel",
            "why",
            "howToFix",
            "evidenceSnippet",
          ],
        },
      },
    },
    required: ["violations"],
    additionalProperties: false,
  } as const;
}

export interface JudgeVerdict {
  /** 0-based index into the list of claims sent to the judge, in the order they were given. */
  index: number;
  /** CoT before the verdict — re-derive the fact from evidence, don't trust the claim's own wording. */
  reasoning: string;
  /** true only if the evidence actually demonstrates the claim as stated. */
  claimIsTrue: boolean;
}

export const JUDGE_CLAIMS_TOOL_NAME = "judge_claims";

export const JUDGE_CLAIMS_TOOL_DESCRIPTION =
  "Independently verify each numbered claim against the real file/diff content provided. " +
  "Return a verdict for every claim.";

/**
 * Builds the JSON Schema for the judge's structured tool call. `index` is
 * constrained to an enum of 0..claimCount-1 — the same grounding trick as
 * `policyId`'s enum in buildViolationsSchema, so the judge can't answer about
 * a claim that wasn't actually given to it.
 */
export function buildJudgeClaimsSchema(claimCount: number) {
  const indices = Array.from({ length: claimCount }, (_, i) => i);
  return {
    type: "object",
    properties: {
      verdicts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            index: {
              type: "integer",
              enum: indices,
              description: "Which claim (by index) this verdict is about.",
            },
            reasoning: {
              type: "string",
              description:
                "Independently re-derive the fact from the real file/diff content given — e.g. " +
                "actually count the lines, actually re-read the quoted evidence in context. Do NOT " +
                "just restate or trust the claim's own wording or the original reasoning attached " +
                "to it; the claim may be wrong even though it sounds specific and confident.",
            },
            claimIsTrue: {
              type: "boolean",
              description:
                "true only if your independent re-derivation in `reasoning` actually confirms the " +
                "claim. false if the claim mischaracterizes, exaggerates, or misreads the real " +
                "content — including getting a specific number (line count, etc.) wrong. " +
                "Distinguish two kinds of claim: (1) an OBSERVABLE FACT about the diff/file itself " +
                "(a literal count, whether a specific call/token is present, what a variable is " +
                "named) — re-derive this exactly and reject if it doesn't hold. (2) a REASONABLE " +
                "INFERENCE about what the code does or how it behaves (e.g. 'this handler is " +
                "reachable without auth', 'this value ends up logged') where the diff doesn't show " +
                "every step but the claimed behavior is still the most reasonable reading given what " +
                "IS shown — confirm this as true if it's the natural conclusion, even though you " +
                "can't see the full call graph outside the diff. Do not reject an inference-type " +
                "claim merely for relying on context not present in the diff; only reject it if the " +
                "shown content actually contradicts it or the inference requires an implausible leap.",
            },
          },
          required: ["index", "reasoning", "claimIsTrue"],
        },
      },
    },
    required: ["verdicts"],
    additionalProperties: false,
  } as const;
}

/** A provider-agnostic client that turns a prompt into structured violations. */
export interface LLMClient {
  reportViolations(prompt: string, policyIds: string[]): Promise<RawViolation[]>;
  /** Independent second-pass verification of already-grounded claims. See llmPolicyCheck.ts. */
  judgeClaims(prompt: string, claimCount: number): Promise<JudgeVerdict[]>;
}
