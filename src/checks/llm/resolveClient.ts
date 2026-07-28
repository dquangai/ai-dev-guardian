import { createAnthropicClient } from "./anthropicClient";
import { createOpenAIClient } from "./openaiClient";
import type { LLMClient } from "./types";

export type ProviderName = "anthropic" | "openai";

function detectProvider(): ProviderName | null {
  const explicit = process.env.GUARDIAN_LLM_PROVIDER?.trim().toLowerCase();
  if (explicit === "anthropic" || explicit === "openai") return explicit;

  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

/**
 * Picks the LLM client to use: GUARDIAN_LLM_PROVIDER forces a provider (still
 * requires that provider's API key); otherwise falls back to whichever key is
 * set, preferring Anthropic if both are. Returns null if nothing is usable —
 * callers should treat that as "skip the LLM check".
 */
export function resolveLLMClient(): { provider: ProviderName; client: LLMClient } | null {
  const provider = detectProvider();
  const model = process.env.GUARDIAN_LLM_MODEL;

  if (provider === "anthropic") {
    if (!process.env.ANTHROPIC_API_KEY) return null;
    return { provider, client: createAnthropicClient(model) };
  }
  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY) return null;
    return { provider, client: createOpenAIClient(model) };
  }
  return null;
}
