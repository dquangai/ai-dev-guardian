import OpenAI from "openai";
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

export const DEFAULT_OPENAI_MODEL = "gpt-4.1";

// Plain (non-strict) function calling only treats the JSON Schema as advisory — the model can (and
// in practice does) omit a field listed in `required`, e.g. the judge dropping `claimIsTrue`
// entirely while still writing a `reasoning` that concludes the claim is true. `strict: true` turns
// on OpenAI's constrained decoding, which actually guarantees every `required` field is present
// (needs `additionalProperties: false` on every object level in the schema, already set in
// buildViolationsSchema/buildJudgeClaimsSchema for this reason).
const STRICT_SCHEMA = true;

// Low, non-zero temperature: the default (1.0) was adding arbitrary sampling noise to a
// classification-style task, both diluting the self-consistency re-check (critical findings were
// being lost to sampling variance, not genuine model disagreement — see eval/results history) and
// making eval runs hard to compare run-to-run. Not 0 — a self-consistency check run at temperature
// 0 would be near-vestigial (same input converges to ~the same answer, wasting the 2nd call).
const CHECK_TEMPERATURE = 0.2;

export function createOpenAIClient(model: string = DEFAULT_OPENAI_MODEL): LLMClient {
  const client = new OpenAI();

  return {
    async reportViolations(prompt: string, policyIds: string[]): Promise<RawViolation[]> {
      const response = await client.chat.completions.create({
        model,
        temperature: CHECK_TEMPERATURE,
        tools: [
          {
            type: "function",
            function: {
              name: REPORT_VIOLATIONS_TOOL_NAME,
              description: REPORT_VIOLATIONS_TOOL_DESCRIPTION,
              parameters: buildViolationsSchema(policyIds),
              strict: STRICT_SCHEMA,
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

    async judgeClaims(prompt: string, claimCount: number): Promise<JudgeVerdict[]> {
      const response = await client.chat.completions.create({
        model,
        temperature: CHECK_TEMPERATURE,
        tools: [
          {
            type: "function",
            function: {
              name: JUDGE_CLAIMS_TOOL_NAME,
              description: JUDGE_CLAIMS_TOOL_DESCRIPTION,
              parameters: buildJudgeClaimsSchema(claimCount),
              strict: STRICT_SCHEMA,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: JUDGE_CLAIMS_TOOL_NAME } },
        messages: [{ role: "user", content: prompt }],
      });

      const toolCall = response.choices[0]?.message.tool_calls?.[0];
      if (!toolCall || toolCall.type !== "function") return [];

      const args = JSON.parse(toolCall.function.arguments) as { verdicts: JudgeVerdict[] };
      return args.verdicts ?? [];
    },
  };
}
