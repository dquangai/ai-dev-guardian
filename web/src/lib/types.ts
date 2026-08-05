export type Severity = 'low' | 'medium' | 'high' | 'critical'

export interface Violation {
  errorWhat: string
  policyViolated: string
  riskLevel: Severity
  why: string
  howToFix: string
  location: string
  promptToFix: string
  source: 'secret-scan' | 'llm-policy-check' | 'architecture-check' | 'semgrep-check'
}

export interface Policy {
  id: string
  category: string
  scope: string[]
  severity: Severity
  tags: string[]
  body: string
  raw: string
  /** Auto-managed metadata (T-17), absent on policies never saved through the dashboard. */
  version?: number
  lastUpdated?: string
  updatedBy?: string
  changeSummary?: string
}

export type ChangeRequestAction = 'create' | 'update' | 'delete'
export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected'

export interface PolicyChangeRequest {
  id: string
  policyId: string
  action: ChangeRequestAction
  content?: string
  changeSummary?: string
  submittedBy: string
  submittedAt: string
  status: ChangeRequestStatus
  reviewedBy?: string
  reviewedAt?: string
  reviewNote?: string
  /** Present when this response just wrote/deleted a policy file — no auto commit/push (T-10). */
  gitHint?: string
}

/** T-18: one row per policy from GET /api/notifications/policies, unread relative to the caller. */
export interface PolicyNotification {
  id: string
  version: number
  lastUpdated?: string
  updatedBy?: string
  changeSummary?: string
  unread: boolean
}

export interface AuditRecord {
  id: string
  timestamp: string
  verdict: 'PASS' | 'BLOCK'
  violations: Violation[]
  changedFiles: string[]
  target: 'staged' | 'branch'
  triggeredBy: string
}

export interface DashboardSummary {
  governanceHealthPct: number
  totalAudits: number
  passed: number
  warnings: number
  mergeBlocked: number
  criticalLeaks: number
}

export interface Subsystem {
  id: string
  name: string
  description: string
  status: string
}

export type BypassStatus = 'pending' | 'approved' | 'rejected'

export interface BypassRequest {
  id: string
  auditId?: string
  reason: string
  requestedBy: string
  requestedAt: string
  status: BypassStatus
  reviewedBy?: string
  reviewedAt?: string
  reviewNote?: string
}

export interface EngineConfig {
  llmProvider?: 'anthropic' | 'openai'
  llmModel?: string
  judgeModel?: string
  semgrepConfig?: string
}

export interface EngineDiagnostics {
  provider: 'anthropic' | 'openai' | null
  hasAnthropicKey: boolean
  hasOpenAIKey: boolean
  effectiveLlmModel: string | null
  effectiveJudgeModel: string | null
  effectiveSemgrepConfig: string
}

export interface SystemDiagnostics {
  nodeVersion: string
  platform: string
  gitBranch: string
  isGitRepo: boolean
  gateGuardActive: boolean
  policiesLoaded: number
  cachedPassHashes: number
  cacheFileExists: boolean
  llm: EngineDiagnostics
}
