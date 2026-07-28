export interface RawViolation {
  errorWhat: string;
  /** Must be one of the policy ids passed to reportViolations for this call. */
  policyId: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  why: string;
  howToFix: string;
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
          },
          required: ["errorWhat", "policyId", "riskLevel", "why", "howToFix"],
        },
      },
    },
    required: ["violations"],
  } as const;
}

/** A provider-agnostic client that turns a prompt into structured violations. */
export interface LLMClient {
  reportViolations(prompt: string, policyIds: string[]): Promise<RawViolation[]>;
}
