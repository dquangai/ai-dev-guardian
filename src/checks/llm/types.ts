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
  /** Natural-language prompt the developer can paste into their own AI assistant. */
  promptToFix: string;
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
            riskLevel: { type: "string", enum: ["low", "medium", "high", "critical"] },
            why: { type: "string", description: "Why this matters if left unfixed." },
            howToFix: { type: "string", description: "Concrete remediation guidance." },
            evidenceSnippet: {
              type: "string",
              description:
                "The exact line(s) copied verbatim from the diff below that trigger this violation " +
                "(with or without the leading +/- marker). Do not paraphrase or reconstruct — quote " +
                "real text from the diff. If no specific line can be quoted, do not report this as a violation.",
            },
            promptToFix: {
              type: "string",
              description:
                'A ready-to-paste natural-language prompt (in Vietnamese) the developer can hand to ' +
                "their own AI assistant (Copilot/ChatGPT/Claude) to fix this specific violation. " +
                "It MUST follow this exact template, filling in the brackets: " +
                '"Xin chào, trong file [tên file], tôi đã vi phạm luật [tên luật] do [lỗi cụ thể]. ' +
                'Hãy giúp tôi sửa đoạn code này theo hướng [cách sửa] mà không làm ảnh hưởng đến ' +
                'logic hiện tại." Do NOT generate the fix code itself — only this request prompt.',
            },
          },
          required: [
            "reasoning",
            "errorWhat",
            "policyId",
            "riskLevel",
            "why",
            "howToFix",
            "promptToFix",
            "evidenceSnippet",
          ],
        },
      },
    },
    required: ["violations"],
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
                "content — including getting a specific number (line count, etc.) wrong.",
            },
          },
          required: ["index", "reasoning", "claimIsTrue"],
        },
      },
    },
    required: ["verdicts"],
  } as const;
}

/** A provider-agnostic client that turns a prompt into structured violations. */
export interface LLMClient {
  reportViolations(prompt: string, policyIds: string[]): Promise<RawViolation[]>;
  /** Independent second-pass verification of already-grounded claims. See llmPolicyCheck.ts. */
  judgeClaims(prompt: string, claimCount: number): Promise<JudgeVerdict[]>;
}
