import fs from "node:fs";
import path from "node:path";
import { DEFAULT_POLICY_DIR } from "../../policy/loader";

/** Non-secret overrides only — API keys stay in .env and are never read/written here. */
export interface EngineConfig {
  llmProvider?: "anthropic" | "openai";
  llmModel?: string;
  judgeModel?: string;
  semgrepConfig?: string;
}

const CONFIG_PATH = path.join(DEFAULT_POLICY_DIR, "..", "engine-config.json");

const ENV_KEYS: Record<keyof EngineConfig, string> = {
  llmProvider: "GUARDIAN_LLM_PROVIDER",
  llmModel: "GUARDIAN_LLM_MODEL",
  judgeModel: "GUARDIAN_JUDGE_MODEL",
  semgrepConfig: "GUARDIAN_SEMGREP_CONFIG",
};

export function readEngineConfig(): EngineConfig {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as EngineConfig;
  } catch {
    return {};
  }
}

/** Applies the saved overrides onto process.env — called at server boot and after every save,
 * so in-process audit runs (orchestrator reads process.env at call time) pick them up live. */
export function applyEngineConfigToEnv(config: EngineConfig = readEngineConfig()): void {
  for (const [key, envKey] of Object.entries(ENV_KEYS) as [keyof EngineConfig, string][]) {
    const value = config[key];
    if (value) process.env[envKey] = value;
    else delete process.env[envKey];
  }
}

export function writeEngineConfig(config: EngineConfig): EngineConfig {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  applyEngineConfigToEnv(config);
  return config;
}

export interface EngineDiagnostics {
  provider: "anthropic" | "openai" | null;
  hasAnthropicKey: boolean;
  hasOpenAIKey: boolean;
  effectiveLlmModel: string | null;
  effectiveJudgeModel: string | null;
  effectiveSemgrepConfig: string;
}

export function readEngineDiagnostics(): EngineDiagnostics {
  const explicit = process.env.GUARDIAN_LLM_PROVIDER?.trim().toLowerCase();
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);
  const provider =
    explicit === "anthropic" || explicit === "openai"
      ? explicit
      : hasAnthropicKey
        ? "anthropic"
        : hasOpenAIKey
          ? "openai"
          : null;

  return {
    provider,
    hasAnthropicKey,
    hasOpenAIKey,
    effectiveLlmModel: process.env.GUARDIAN_LLM_MODEL?.trim() || null,
    effectiveJudgeModel: process.env.GUARDIAN_JUDGE_MODEL?.trim() || null,
    effectiveSemgrepConfig: process.env.GUARDIAN_SEMGREP_CONFIG?.trim() || "p/security-audit",
  };
}
