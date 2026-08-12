import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildViolationsSchema, buildJudgeClaimsSchema } from "../src/checks/llm/types";

/**
 * Regression coverage for a real bug found via eval/runEval.ts --case: without
 * `strict: true` (+ `additionalProperties: false` in the schema), OpenAI's plain
 * function calling only treats the JSON Schema as advisory — the model silently
 * omitted the required `claimIsTrue` field on several judge verdicts while still
 * writing a `reasoning` that concluded the claim was true, and the missing field
 * was then read as `false` (falsy) by checkPoliciesWithLLM, incorrectly dropping
 * a correct violation. `strict: true` turns on constrained decoding, which
 * actually guarantees every `required` field is present.
 */
describe("buildViolationsSchema — strict-mode shape", () => {
  it("đặt additionalProperties: false ở cả object gốc lẫn object item lồng bên trong", () => {
    const schema = buildViolationsSchema(["policy-a"]);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.violations.items.additionalProperties).toBe(false);
  });

  it("required liệt kê đủ mọi property của item (bắt buộc với strict mode)", () => {
    const schema = buildViolationsSchema(["policy-a"]);
    const propertyNames = Object.keys(schema.properties.violations.items.properties);
    expect(schema.properties.violations.items.required.sort()).toEqual(propertyNames.sort());
  });
});

describe("buildJudgeClaimsSchema — strict-mode shape", () => {
  it("đặt additionalProperties: false ở cả object gốc lẫn object item lồng bên trong", () => {
    const schema = buildJudgeClaimsSchema(3);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.verdicts.items.additionalProperties).toBe(false);
  });

  it("required liệt kê đủ mọi property của item, bao gồm claimIsTrue (field từng bị model bỏ sót)", () => {
    const schema = buildJudgeClaimsSchema(3);
    const propertyNames = Object.keys(schema.properties.verdicts.items.properties);
    expect(schema.properties.verdicts.items.required.sort()).toEqual(propertyNames.sort());
    expect(schema.properties.verdicts.items.required).toContain("claimIsTrue");
  });
});

const createMock = vi.fn();

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: createMock } };
  },
}));

describe("createOpenAIClient — gọi API với strict: true", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("reportViolations gửi tool.function.strict = true", async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { tool_calls: [] } }],
    });
    const { createOpenAIClient } = await import("../src/checks/llm/openaiClient");
    const client = createOpenAIClient();

    await client.reportViolations("prompt", ["policy-a"]);

    expect(createMock).toHaveBeenCalledTimes(1);
    const callArgs = createMock.mock.calls[0][0];
    expect(callArgs.tools[0].function.strict).toBe(true);
    expect(callArgs.tools[0].function.parameters.additionalProperties).toBe(false);
  });

  it("judgeClaims gửi tool.function.strict = true", async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { tool_calls: [] } }],
    });
    const { createOpenAIClient } = await import("../src/checks/llm/openaiClient");
    const client = createOpenAIClient();

    await client.judgeClaims("prompt", 1);

    expect(createMock).toHaveBeenCalledTimes(1);
    const callArgs = createMock.mock.calls[0][0];
    expect(callArgs.tools[0].function.strict).toBe(true);
    expect(callArgs.tools[0].function.parameters.additionalProperties).toBe(false);
  });
});
