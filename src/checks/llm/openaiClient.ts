import OpenAI from "openai";
import {
  REPORT_VIOLATIONS_TOOL_DESCRIPTION,
  REPORT_VIOLATIONS_TOOL_NAME,
  buildViolationsSchema,
  type LLMClient,
  type RawViolation,
} from "./types";

export const DEFAULT_OPENAI_MODEL = "gpt-4.1";

export function createOpenAIClient(model: string = DEFAULT_OPENAI_MODEL): LLMClient {
  const client = new OpenAI();

  return {
    async reportViolations(prompt: string, policyIds: string[]): Promise<RawViolation[]> {
      const response = await client.chat.completions.create({
        model,
        tools: [
          {
            type: "function",
            function: {
              name: REPORT_VIOLATIONS_TOOL_NAME,
              description: REPORT_VIOLATIONS_TOOL_DESCRIPTION,
              parameters: buildViolationsSchema(policyIds),
            },
          },
        ],
        tool_choice: { type: "function", function: { name: REPORT_VIOLATIONS_TOOL_NAME } },
        messages: [{ role: "user", content: prompt }],
      });

      const toolCall = response.choices[0]?.message.tool_calls?.[0];
      if (!toolCall || toolCall.type !== "function") return [];

      const args = JSON.parse(toolCall.function.arguments) as { violations: RawViolation[] };
      return args.violations ?? [];
    },
  };
}
