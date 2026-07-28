import Anthropic from "@anthropic-ai/sdk";
import {
  REPORT_VIOLATIONS_TOOL_DESCRIPTION,
  REPORT_VIOLATIONS_TOOL_NAME,
  buildViolationsSchema,
  type LLMClient,
  type RawViolation,
} from "./types";

export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5";

export function createAnthropicClient(model: string = DEFAULT_ANTHROPIC_MODEL): LLMClient {
  const client = new Anthropic();

  return {
    async reportViolations(prompt: string, policyIds: string[]): Promise<RawViolation[]> {
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
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
  };
}
