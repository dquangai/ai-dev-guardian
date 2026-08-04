import type { EngineDiagnostics } from './types'

const PROVIDER_FULL_NAME: Record<'anthropic' | 'openai', string> = {
  anthropic: 'Anthropic Claude',
  openai: 'OpenAI GPT',
}

const PROVIDER_SHORT_NAME: Record<'anthropic' | 'openai', string> = {
  anthropic: 'Claude',
  openai: 'GPT',
}

/** "Anthropic Claude · claude-sonnet-5" style label for detailed displays (Sidebar, Header). */
export function engineLabel(llm?: EngineDiagnostics | null): string {
  if (!llm?.provider) return 'AI Engine not configured'
  return llm.effectiveLlmModel ? `${PROVIDER_FULL_NAME[llm.provider]} · ${llm.effectiveLlmModel}` : PROVIDER_FULL_NAME[llm.provider]
}

/** "Claude" / "GPT" style short name for taglines ("Deterministic Checks + GPT AI"). */
export function engineShortName(llm?: EngineDiagnostics | null): string {
  if (!llm?.provider) return 'AI'
  return PROVIDER_SHORT_NAME[llm.provider]
}
