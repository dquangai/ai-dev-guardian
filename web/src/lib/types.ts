export type Severity = 'low' | 'medium' | 'high' | 'critical'

export interface Violation {
  errorWhat: string
  policyViolated: string
  riskLevel: Severity
  why: string
  howToFix: string
  location: string
  promptToFix: string
  source: 'secret-scan' | 'llm-policy-check' | 'architecture-check' | 'semgrep-check' | 'git-workflow-check' | 'testing-standards-check'
  /** Last author of the violating line via `git blame`, when the server could resolve one — see
   * src/report/types.ts on the API side. Absent for violations not tied to a single line. */
  author?: { name: string; email: string }
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

/** T-23: one of the 4 fixed team-scoped demo accounts (never includes super-admin, which is
 * org-wide and never a team "member"). */
export interface TeamMember {
  id: string
  name: string
  email: string
  role: 'admin' | 'senior-dev' | 'developer' | 'auditor'
}

export interface Team {
  id: string
  name: string
  createdAt: string
  createdBy: string
  members: TeamMember[]
}

/** `users` is every team-scoped demo user with their *current* teamId (or undefined if
 * unassigned) — used to populate the "add member" picker without a separate /api/users call. */
export interface TeamsResponse {
  teams: Team[]
  users: (TeamMember & { teamId?: string })[]
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
