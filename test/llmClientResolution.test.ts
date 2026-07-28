import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveLLMClient } from "../src/checks/llm/resolveClient";

const ENV_KEYS = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GUARDIAN_LLM_PROVIDER", "GUARDIAN_LLM_MODEL"];
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
