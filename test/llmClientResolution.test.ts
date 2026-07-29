import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  resolveLLMClient,
  resolveJudgeClient,
  DEFAULT_ANTHROPIC_JUDGE_MODEL,
} from "../src/checks/llm/resolveClient";
import { DEFAULT_ANTHROPIC_MODEL } from "../src/checks/llm/anthropicClient";

const ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GUARDIAN_LLM_PROVIDER",
  "GUARDIAN_LLM_MODEL",
  "GUARDIAN_JUDGE_MODEL",
];
const originalValues = new Map(ENV_KEYS.map((k) => [k, process.env[k]]));

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

describe("resolveLLMClient", () => {
  beforeEach(clearEnv);
  afterEach(() => {
    clearEnv();
    for (const [key, value] of originalValues) {
      if (value !== undefined) process.env[key] = value;
    }
  });

  it("trả về null khi không có API key nào được set", () => {
    expect(resolveLLMClient()).toBeNull();
  });

  it("dùng Anthropic khi chỉ ANTHROPIC_API_KEY được set", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    expect(resolveLLMClient()?.provider).toBe("anthropic");
  });

  it("dùng OpenAI khi chỉ OPENAI_API_KEY được set", () => {
    process.env.OPENAI_API_KEY = "test-key";
    expect(resolveLLMClient()?.provider).toBe("openai");
  });

  it("ưu tiên Anthropic khi cả hai key đều được set và không có override", () => {
    process.env.ANTHROPIC_API_KEY = "a";
    process.env.OPENAI_API_KEY = "b";
    expect(resolveLLMClient()?.provider).toBe("anthropic");
  });

  it("GUARDIAN_LLM_PROVIDER=openai buộc dùng OpenAI dù Anthropic key cũng có sẵn", () => {
    process.env.ANTHROPIC_API_KEY = "a";
    process.env.OPENAI_API_KEY = "b";
    process.env.GUARDIAN_LLM_PROVIDER = "openai";
    expect(resolveLLMClient()?.provider).toBe("openai");
  });

  it("trả về null nếu GUARDIAN_LLM_PROVIDER trỏ tới provider thiếu key tương ứng", () => {
    process.env.GUARDIAN_LLM_PROVIDER = "openai";
    process.env.ANTHROPIC_API_KEY = "a";
    expect(resolveLLMClient()).toBeNull();
  });
});

describe("resolveJudgeClient", () => {
  beforeEach(clearEnv);
  afterEach(() => {
    clearEnv();
    for (const [key, value] of originalValues) {
      if (value !== undefined) process.env[key] = value;
    }
  });

  it("trả về null khi không có API key nào được set (giống resolveLLMClient)", () => {
    expect(resolveJudgeClient()).toBeNull();
  });

  it("dùng cùng provider với resolveLLMClient khi cùng key được set", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    expect(resolveJudgeClient()?.provider).toBe(resolveLLMClient()?.provider);
    expect(resolveJudgeClient()?.provider).toBe("anthropic");
  });

  it("GUARDIAN_LLM_PROVIDER cũng chi phối provider của judge (dùng chung logic detect)", () => {
    process.env.ANTHROPIC_API_KEY = "a";
    process.env.OPENAI_API_KEY = "b";
    process.env.GUARDIAN_LLM_PROVIDER = "openai";
    expect(resolveJudgeClient()?.provider).toBe("openai");
  });

  it("trả về null nếu GUARDIAN_LLM_PROVIDER trỏ tới provider thiếu key tương ứng", () => {
    process.env.GUARDIAN_LLM_PROVIDER = "openai";
    process.env.ANTHROPIC_API_KEY = "a";
    expect(resolveJudgeClient()).toBeNull();
  });

  it("model mặc định của judge khác model mặc định của main check (rẻ hơn, nhanh hơn)", () => {
    expect(DEFAULT_ANTHROPIC_JUDGE_MODEL).not.toBe(DEFAULT_ANTHROPIC_MODEL);
  });

  it("GUARDIAN_JUDGE_MODEL được set không làm resolveJudgeClient throw hay đổi provider", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.GUARDIAN_JUDGE_MODEL = "some-custom-model";
    expect(() => resolveJudgeClient()).not.toThrow();
    expect(resolveJudgeClient()?.provider).toBe("anthropic");
  });
});
