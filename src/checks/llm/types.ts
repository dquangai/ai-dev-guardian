export interface RawViolation {
  errorWhat: string;
  /** Must be one of the policy ids passed to reportViolations for this call. */
  policyId: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  why: string;
  howToFix: string;
  /** Natural-language prompt the developer can paste into their own AI assistant. */
  promptToFix: string;
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
          required: ["errorWhat", "policyId", "riskLevel", "why", "howToFix", "promptToFix"],
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
