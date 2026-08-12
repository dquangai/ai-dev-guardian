import { createAnthropicClient, DEFAULT_ANTHROPIC_MODEL } from "./anthropicClient";
import { createOpenAIClient, DEFAULT_OPENAI_MODEL } from "./openaiClient";
import type { LLMClient } from "./types";

export type ProviderName = "anthropic" | "openai";

export interface ResolvedLLMClient {
  provider: ProviderName;
  /**
   * The actual model string in use — resolves the same default-fallback
   * `createXClient` applies internally, so callers (e.g. eval history
   * snapshots) can record exactly which model produced a result without
   * duplicating that fallback logic themselves.
   */
  model: string;
  client: LLMClient;
}

function detectProvider(): ProviderName | null {
  const explicit = process.env.GUARDIAN_LLM_PROVIDER?.trim().toLowerCase();
  if (explicit === "anthropic" || explicit === "openai") return explicit;

  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

/** Builds a client for `provider` if its API key is present; returns null otherwise (never throws). */
function resolveClientForProvider(
  provider: ProviderName | null,
  modelOverride: string | undefined
): ResolvedLLMClient | null {
  if (provider === "anthropic") {
    if (!process.env.ANTHROPIC_API_KEY) return null;
    const model = modelOverride || DEFAULT_ANTHROPIC_MODEL;
    return { provider, model, client: createAnthropicClient(model) };
  }
  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY) return null;
    const model = modelOverride || DEFAULT_OPENAI_MODEL;
    return { provider, model, client: createOpenAIClient(model) };
  }
  return null;
}

/**
 * Picks the LLM client to use: GUARDIAN_LLM_PROVIDER forces a provider (still
 * requires that provider's API key); otherwise falls back to whichever key is
 * set, preferring Anthropic if both are. Returns null if nothing is usable —
 * callers should treat that as "skip the LLM check".
 */
export function resolveLLMClient(): ResolvedLLMClient | null {
  return resolveClientForProvider(detectProvider(), process.env.GUARDIAN_LLM_MODEL);
}

// Cheap/fast tier used for the judge pass — a second, independently-framed
// verification of a violation, not full policy reasoning, so it doesn't need
// the main check's model. Anthropic's is a confirmed current alias; the
// OpenAI default is a reasonable placeholder, not a verified guarantee —
// override either via GUARDIAN_JUDGE_MODEL if it's wrong for your account.
export const DEFAULT_ANTHROPIC_JUDGE_MODEL = "claude-haiku-4-5-20251001";
export const DEFAULT_OPENAI_JUDGE_MODEL = "gpt-4.1-mini";

/**
 * Same provider/key as resolveLLMClient (no separate API key needed) but
 * defaults to a cheaper/faster model for the judge pass — see
 * llmPolicyCheck.ts for what the judge actually verifies. Returns null (not
 * throw) if no key is configured; the judge is an optional, fail-open layer.
 */
export function resolveJudgeClient(): ResolvedLLMClient | null {
  const provider = detectProvider();
  const model =
    process.env.GUARDIAN_JUDGE_MODEL?.trim() ||
    (provider === "anthropic" ? DEFAULT_ANTHROPIC_JUDGE_MODEL : DEFAULT_OPENAI_JUDGE_MODEL);
  return resolveClientForProvider(provider, model);
}
