import Anthropic from "@anthropic-ai/sdk";
import {
  REPORT_VIOLATIONS_TOOL_DESCRIPTION,
  REPORT_VIOLATIONS_TOOL_NAME,
  buildViolationsSchema,
  JUDGE_CLAIMS_TOOL_DESCRIPTION,
  JUDGE_CLAIMS_TOOL_NAME,
  buildJudgeClaimsSchema,
  type JudgeVerdict,
  type LLMClient,
  type RawViolation,
} from "./types";

export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5";

// Low, non-zero temperature: the default (1.0) was adding arbitrary sampling noise to a
// classification-style task, both diluting the self-consistency re-check (critical findings were
// being lost to sampling variance, not genuine model disagreement — see eval/results history) and
// making eval runs hard to compare run-to-run. Not 0 — a self-consistency check run at temperature
// 0 would be near-vestigial (same input converges to ~the same answer, wasting the 2nd call).
const CHECK_TEMPERATURE = 0.2;

export function createAnthropicClient(model: string = DEFAULT_ANTHROPIC_MODEL): LLMClient {
  const client = new Anthropic();

  return {
    async reportViolations(prompt: string, policyIds: string[]): Promise<RawViolation[]> {
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        temperature: CHECK_TEMPERATURE,
        tools: [
          {
            name: REPORT_VIOLATIONS_TOOL_NAME,
            description: REPORT_VIOLATIONS_TOOL_DESCRIPTION,
            input_schema: buildViolationsSchema(policyIds) as unknown as Anthropic.Tool.InputSchema,
          },
        ],
        tool_choice: { type: "tool", name: REPORT_VIOLATIONS_TOOL_NAME },
        messages: [{ role: "user", content: prompt }],
      });

      const toolUse = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );
      if (!toolUse) return [];

      return (toolUse.input as { violations: RawViolation[] }).violations ?? [];
    },

    async judgeClaims(prompt: string, claimCount: number): Promise<JudgeVerdict[]> {
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        temperature: CHECK_TEMPERATURE,
        tools: [
          {
            name: JUDGE_CLAIMS_TOOL_NAME,
            description: JUDGE_CLAIMS_TOOL_DESCRIPTION,
            input_schema: buildJudgeClaimsSchema(claimCount) as unknown as Anthropic.Tool.InputSchema,
          },
        ],
        tool_choice: { type: "tool", name: JUDGE_CLAIMS_TOOL_NAME },
        messages: [{ role: "user", content: prompt }],
      });

      const toolUse = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );
      if (!toolUse) return [];

      return (toolUse.input as { verdicts: JudgeVerdict[] }).verdicts ?? [];
    },
  };
}
