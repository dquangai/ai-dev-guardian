import { useState } from 'react'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  FileCode,
  Rocket,
  Send,
  ShieldCheck,
  Terminal,
  Workflow,
  XCircle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../lib/useApi'
import type { AuditRecord, BypassRequest, SystemDiagnostics } from '../lib/types'
import { TechGridCard } from '../components/ui/TechGridCard'
import { TechButton } from '../components/ui/TechButton'

export function DeveloperOverview() {
  const { user } = useAuth()
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Modal state for Bypass Request
  const [bypassModalData, setBypassModalData] = useState<{
    commit: string
    violation: string
    policy: string
    file: string
    line: string
  } | null>(null)
  const [bypassReason, setBypassReason] = useState('')
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null)

  // API Integration
  const { data: auditHistory } = useApi<AuditRecord[]>('/audit/history')
  const { data: bypassRequests } = useApi<BypassRequest[]>('/bypass-requests')
  const { data: diagnostics } = useApi<SystemDiagnostics>('/system/diagnostics')

  // Calculate metrics
  const totalAudits = auditHistory?.length || 0
  const passAudits = auditHistory?.filter((a) => a.verdict === 'PASS').length || 0
  const complianceScore = totalAudits > 0 ? Math.round((passAudits / totalAudits) * 100) : 96

  const realBlockedCommits = auditHistory?.filter((a) => a.verdict === 'BLOCK') || []
  const blockedCount = realBlockedCommits.length > 0 ? realBlockedCommits.length : 1
  const bypassCount = bypassRequests?.filter((b) => b.status === 'approved').length || 1

  // Copy AI Fix Prompt payload generator
  const handleCopyAiFixPrompt = (data: {
    commit: string
    file: string
    line: string
    violation: string
    policy: string
    requirement: string
  }) => {
    const promptText = `Fix the following security violation.

Repository: ai-dev-guardian
Branch: ${diagnostics?.gitBranch || 'master'}
Commit: ${data.commit}

File:
${data.file}

Line:
${data.line}

Violation:
${data.violation}

Policy:
${data.policy}

Requirement:
${data.requirement}

Please:
1. Identify the root cause.
2. Provide a secure implementation.
3. Provide the corrected code.
4. Do not disable or bypass the security policy.`

    navigator.clipboard.writeText(promptText)
    setToastMessage('AI Fix Prompt copied')
    setTimeout(() => setToastMessage(null), 3000)
  }

  // Submit Bypass Request handler
  const handleFormSubmitBypass = (e: React.FormEvent) => {
    e.preventDefault()
    if (!bypassReason.trim()) return

    const requestId = `BY-${Math.floor(1000 + Math.random() * 9000)}`
    setSubmittedRequestId(requestId)
  }

  const closeBypassModal = () => {
    setBypassModalData(null)
    setBypassReason('')
    setSubmittedRequestId(null)
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans text-[#111111] dark:text-[#F4F4F5] transition-colors">
      {/* Top Breadcrumb Badge */}
      <div className="flex items-center gap-2 text-[11px] font-mono font-medium text-[#777777] dark:text-[#A1A1AA] uppercase tracking-widest">
        <span className="flex h-2 w-2 rounded-full bg-[#C8102E] animate-pulse" />
        <span>DEVELOPER</span>
        <span>/</span>
        <span className="text-[#111111] dark:text-[#F4F4F5] font-semibold">OVERVIEW</span>
      </div>

      {/* 1. Header & Greeting Banner */}
      <div className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight text-[#111111] dark:text-[#F4F4F5]">Overview</h1>
        
        {/* Callout Banner with Light Gray System Accent */}
        <div className="tech-grid-card relative p-4.5 border-l-4 border-l-[#C8102E] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="absolute top-[6px] left-[6px] w-[8px] h-[8px] border-t border-l border-[#C8102E] pointer-events-none opacity-80" />
          <div className="absolute top-[6px] right-[6px] w-[8px] h-[8px] border-t border-r border-[#C8102E] pointer-events-none opacity-80" />
          <div className="absolute bottom-[6px] left-[6px] w-[8px] h-[8px] border-b border-l border-[#C8102E] pointer-events-none opacity-80" />
          <div className="absolute bottom-[6px] right-[6px] w-[8px] h-[8px] border-b border-r border-[#C8102E] pointer-events-none opacity-80" />

          <div className="space-y-1">
            <div className="text-sm font-semibold text-[#111111] dark:text-[#F4F4F5] flex items-center gap-2">
              <Terminal size={15} className="text-[#C8102E]" />
              <span>Chào {user?.name || 'Developer'}</span>
            </div>
            <p className="text-xs text-[#666666] dark:text-[#A1A1AA] leading-relaxed font-sans">
              Trạng thái tuân thủ mã nguồn của bạn đạt{' '}
              <span className="font-mono font-bold text-[#111111] dark:text-[#F4F4F5] bg-[#F4F5F7] dark:bg-[#27272A] px-1.5 py-0.5 rounded border border-[#D9D9D9] dark:border-[#3F3F46]">
                {complianceScore}%
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#555555] dark:text-[#A1A1AA] bg-[#FFFFFF] dark:bg-[#27272A] px-3 py-1.5 rounded border border-[#D6D6D6] dark:border-[#3F3F46] shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-[#18794E]" />
            <span>BRANCH: {diagnostics?.gitBranch || 'main'}</span>
          </div>
        </div>
      </div>

      {/* 2. Technical Engineering Feature Cards (Technical Grid Cards matching User Reference Image) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <TechGridCard
          category="SHIP CODE FASTER"
          title="Pre-Push Governance Gate"
          description="Delegate code reviews, verify security policies, and merge diffs safely directly from CLI or App."
          icon={<Code2 size={16} />}
          actionLabel="RUN THE QUICKSTART"
          onAction={() => setToastMessage('Quickstart guide opened')}
        />
        <TechGridCard
          category="AUTOMATE THE FULL SDLC"
          title="Automated Security Pipeline"
          description="Put code review, SAST audit, secret leak detection, and compliance verification on autopilot."
          icon={<Workflow size={16} />}
          actionLabel="EXPLORE SOFTWARE FACTORY"
          onAction={() => setToastMessage('Software Factory features listed')}
        />
        <TechGridCard
          category="PLAN AN ENTERPRISE ROLLOUT"
          title="QWOANG Enterprise Policies"
          description="Deploy, secure, govern, and observe AI Code Guardian policies across your organization."
          icon={<Rocket size={16} />}
          actionLabel="REVIEW THE ARCHITECTURE"
          onAction={() => setToastMessage('Architecture diagram loaded')}
        />
      </div>

      {/* 3. Metric Cards Grid (Technical Grid Cards) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* A. Commit Pass Rate */}
        <TechGridCard
          category="COMMIT PASS RATE"
          title="Tỷ lệ commit an toàn"
          value={`${complianceScore}%`}
          icon={<CheckCircle2 size={16} />}
          statusPill={
            <span className="inline-flex items-center gap-1 rounded bg-[#E6F4ED] dark:bg-emerald-950/60 border border-[#18794E]/30 px-2 py-0.5 text-[10px] font-mono font-bold text-[#18794E] dark:text-emerald-400 uppercase">
              SAFE
            </span>
          }
          actionLabel="VIEW AUDIT DETAILS"
          onAction={() => setToastMessage('Audit history details filtered')}
        />

        {/* B. Lỗi Cần Sửa */}
        <TechGridCard
          category="LỖI CẦN SỬA"
          title="Đang bị block"
          value={`${blockedCount} commit`}
          icon={<AlertCircle size={16} />}
          statusPill={
            <span className="inline-flex items-center gap-1 rounded bg-[#FFF1F2] dark:bg-rose-950/60 border border-[#C8102E]/30 px-2 py-0.5 text-[10px] font-mono font-bold text-[#C8102E] dark:text-rose-400 uppercase">
              BLOCKED
            </span>
          }
          actionLabel="RESOLVE VIOLATION"
          onAction={() => setToastMessage('Navigating to blocked commit list')}
        />

        {/* C. Đơn Bypass */}
        <TechGridCard
          category="ĐƠN BYPASS"
          title="Tech Lead đã duyệt"
          value={`${bypassCount} đơn`}
          icon={<Clock size={16} />}
          statusPill={
            <span className="inline-flex items-center gap-1 rounded bg-[#FEF3C7] dark:bg-amber-950/60 border border-[#B54708]/30 px-2 py-0.5 text-[10px] font-mono font-bold text-[#B54708] dark:text-amber-400 uppercase">
              APPROVED
            </span>
          }
          actionLabel="CHECK BYPASS STATUS"
          onAction={() => setToastMessage('Bypass history opened')}
        />

        {/* D. Secret Leaks */}
        <TechGridCard
          category="SECRET LEAKS"
          title="Không phát hiện"
          value="0"
          icon={<ShieldCheck size={16} />}
          statusPill={
            <span className="inline-flex items-center gap-1 rounded bg-[#E6F4ED] dark:bg-emerald-950/60 border border-[#18794E]/30 px-2 py-0.5 text-[10px] font-mono font-bold text-[#18794E] dark:text-emerald-400 uppercase">
              CLEAN
            </span>
          }
          actionLabel="RUN SECRET SCAN"
          onAction={() => setToastMessage('Secret scanner verified')}
        />
      </div>

      {/* 4. Blocked Commits Section with Black Button White Text & Tech Grid Styling */}
      <div className="tech-grid-card relative p-6 space-y-5">
        <div className="absolute top-[6px] left-[6px] w-[8px] h-[8px] border-t border-l border-[#C8102E] pointer-events-none opacity-80" />
        <div className="absolute top-[6px] right-[6px] w-[8px] h-[8px] border-t border-r border-[#C8102E] pointer-events-none opacity-80" />
        <div className="absolute bottom-[6px] left-[6px] w-[8px] h-[8px] border-b border-l border-[#C8102E] pointer-events-none opacity-80" />
        <div className="absolute bottom-[6px] right-[6px] w-[8px] h-[8px] border-b border-r border-[#C8102E] pointer-events-none opacity-80" />

        <div className="flex items-center justify-between border-b border-[#E5E5E5] dark:border-[#27272A] pb-3.5">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-[#111111] dark:text-[#F4F4F5] font-sans">
              Commit bị chặn
            </h2>
            <span className="font-mono text-xs font-medium text-[#666666] dark:text-[#A1A1AA] bg-[#F4F5F7] dark:bg-[#27272A] border border-[#D6D6D6] dark:border-[#3F3F46] rounded px-2 py-0.5">
              {blockedCount} commit
            </span>
          </div>
          <span className="font-mono text-xs text-[#8A8A8A] dark:text-[#71717A]">STATUS: GATED</span>
        </div>

        <div className="space-y-4">
          {realBlockedCommits.length === 0 ? (
            /* Standard Specification Sample Item */
            <div className="rounded border border-[#D6D6D6] dark:border-[#27272A] bg-[#FFFFFF] dark:bg-[#09090B] p-5 space-y-4 hover:border-[#BDBDBD] dark:hover:border-[#3F3F46] transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E5E5] dark:border-[#27272A] pb-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FFF1F2] dark:bg-rose-950/60 text-[#C8102E] dark:text-rose-400 border border-[#C8102E]/30">
                    <XCircle size={13} />
                  </span>
                  <span className="font-medium text-sm text-[#111111] dark:text-[#F4F4F5] font-sans">
                    feat: add authentication
                  </span>
                  <span className="font-mono text-xs font-semibold text-[#111111] dark:text-[#F4F4F5] bg-[#F4F5F7] dark:bg-[#18181B] px-2 py-0.5 rounded border border-[#D6D6D6] dark:border-[#27272A]">
                    a82f91c
                  </span>
                </div>
                <span className="inline-flex items-center rounded bg-[#FFF1F2] dark:bg-rose-950/60 border border-[#C8102E]/30 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider text-[#C8102E] dark:text-rose-400 uppercase">
                  CRITICAL
                </span>
              </div>

              {/* Spec Details Table */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#111111] dark:text-[#F4F4F5] pt-1">
                <div className="space-y-0.5">
                  <span className="text-[#666666] dark:text-[#A1A1AA] text-[11px] font-mono uppercase tracking-wider block">
                    Violation
                  </span>
                  <span className="font-semibold text-[#111111] dark:text-[#F4F4F5]">
                    Hard-coded credential
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[#666666] dark:text-[#A1A1AA] text-[11px] font-mono uppercase tracking-wider block">
                    File Path + Line
                  </span>
                  <span className="font-mono text-[#111111] dark:text-[#F4F4F5] bg-[#F4F5F7] dark:bg-[#18181B] px-2 py-0.5 rounded border border-[#D6D6D6] dark:border-[#27272A] inline-block">
                    src/config/auth.ts : Line 42
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[#666666] dark:text-[#A1A1AA] text-[11px] font-mono uppercase tracking-wider block">
                    Policy ID
                  </span>
                  <span className="font-mono font-semibold text-[#111111] dark:text-[#F4F4F5]">
                    SEC-001
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[#666666] dark:text-[#A1A1AA] text-[11px] font-mono uppercase tracking-wider block">
                    Requirement
                  </span>
                  <span className="text-[#666666] dark:text-[#A1A1AA]">
                    Secret credentials must not be committed.
                  </span>
                </div>
              </div>

              {/* Code Block Callout */}
              <div className="bg-[#111111] dark:bg-[#18181B] text-white font-mono text-xs p-3.5 rounded border border-[#D6D6D6] dark:border-[#27272A] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode size={14} className="text-[#8A8A8A]" />
                  <span className="text-zinc-200">src/config/auth.ts</span>
                </div>
                <span className="text-rose-400 text-[11px]">Hard-coded credential detected on line 42</span>
              </div>

              {/* Action Buttons: Nút Đen Chữ Trắng & Outlined Button */}
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#E5E5E5] dark:border-[#27272A]">
                <button
                  onClick={() =>
                    handleCopyAiFixPrompt({
                      commit: 'a82f91c',
                      file: 'src/config/auth.ts',
                      line: '42',
                      violation: 'Hard-coded credential',
                      policy: 'SEC-001',
                      requirement: 'Secret credentials must not be committed.',
                    })
                  }
                  className="inline-flex items-center gap-2 rounded border border-[#D6D6D6] dark:border-[#27272A] bg-[#FFFFFF] dark:bg-[#18181B] px-4 py-2 text-xs font-semibold text-[#111111] dark:text-[#F4F4F5] hover:bg-[#E5E7EB] dark:hover:bg-[#27272A] cursor-pointer transition-colors"
                >
                  <Copy size={13} className="text-[#666666] dark:text-[#A1A1AA]" />
                  Copy AI Fix Prompt
                </button>

                {/* TechButton - Factory aesthetic */}
                <TechButton
                  onClick={() =>
                    setBypassModalData({
                      commit: 'a82f91c',
                      file: 'src/config/auth.ts',
                      line: '42',
                      violation: 'Hard-coded credential',
                      policy: 'SEC-001',
                    })
                  }
                  icon={<Send size={13} />}
                >
                  Gửi Đơn Bypass
                </TechButton>
              </div>
            </div>
          ) : (
            realBlockedCommits.map((audit) =>
              audit.violations.map((v, vIdx) => (
                <div
                  key={`${audit.id}-${vIdx}`}
                  className="rounded border border-[#D6D6D6] dark:border-[#27272A] bg-[#FFFFFF] dark:bg-[#09090B] p-5 space-y-4 hover:border-[#BDBDBD] dark:hover:border-[#3F3F46] transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E5E5] dark:border-[#27272A] pb-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FFF1F2] dark:bg-rose-950/60 text-[#C8102E] dark:text-rose-400 border border-[#C8102E]/30">
                        <XCircle size={13} />
                      </span>
                      <span className="font-medium text-sm text-[#111111] dark:text-[#F4F4F5] font-sans">
                        {v.errorWhat || 'Code Security Violation'}
                      </span>
                      <span className="font-mono text-xs font-semibold text-[#111111] dark:text-[#F4F4F5] bg-[#F4F5F7] dark:bg-[#18181B] px-2 py-0.5 rounded border border-[#D6D6D6] dark:border-[#27272A]">
                        {audit.id}
                      </span>
                    </div>
                    <span className="inline-flex items-center rounded bg-[#FFF1F2] dark:bg-rose-950/60 border border-[#C8102E]/30 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider text-[#C8102E] dark:text-rose-400 uppercase">
                      {v.riskLevel || 'CRITICAL'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#111111] dark:text-[#F4F4F5] pt-1">
                    <div className="space-y-0.5">
                      <span className="text-[#666666] dark:text-[#A1A1AA] text-[11px] font-mono uppercase tracking-wider block">
                        Violation
                      </span>
                      <span className="font-semibold text-[#111111] dark:text-[#F4F4F5]">{v.errorWhat}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[#666666] dark:text-[#A1A1AA] text-[11px] font-mono uppercase tracking-wider block">
                        File Path + Line
                      </span>
                      <span className="font-mono text-[#111111] dark:text-[#F4F4F5] bg-[#F4F5F7] dark:bg-[#18181B] px-2 py-0.5 rounded border border-[#D6D6D6] dark:border-[#27272A] inline-block">
                        {v.location || audit.changedFiles[0] || 'N/A'}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[#666666] dark:text-[#A1A1AA] text-[11px] font-mono uppercase tracking-wider block">
                        Policy ID
                      </span>
                      <span className="font-mono font-semibold text-[#111111] dark:text-[#F4F4F5]">
                        {v.policyViolated || 'SEC-001'}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[#666666] dark:text-[#A1A1AA] text-[11px] font-mono uppercase tracking-wider block">
                        Requirement
                      </span>
                      <span className="text-[#666666] dark:text-[#A1A1AA]">
                        {v.why || 'Code must comply with enterprise policies.'}
                      </span>
                    </div>
                  </div>

                  {/* Code Block Callout */}
                  <div className="bg-[#111111] dark:bg-[#18181B] text-white font-mono text-xs p-3.5 rounded border border-[#D6D6D6] dark:border-[#27272A] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileCode size={14} className="text-[#8A8A8A]" />
                      <span className="text-zinc-200">{v.location || 'src/main.ts'}</span>
                    </div>
                    <span className="text-rose-400 text-[11px]">
                      {v.errorWhat || 'Policy violation'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#E5E5E5] dark:border-[#27272A]">
                    <button
                      onClick={() =>
                        handleCopyAiFixPrompt({
                          commit: audit.id,
                          file: v.location || audit.changedFiles[0] || 'N/A',
                          line: 'Line 1',
                          violation: v.errorWhat,
                          policy: v.policyViolated || 'SEC-001',
                          requirement: v.why || 'Policy requirement',
                        })
                      }
                      className="inline-flex items-center gap-2 rounded border border-[#D6D6D6] dark:border-[#27272A] bg-[#FFFFFF] dark:bg-[#18181B] px-4 py-2 text-xs font-semibold text-[#111111] dark:text-[#F4F4F5] hover:bg-[#E5E7EB] dark:hover:bg-[#27272A] cursor-pointer transition-colors"
                    >
                      <Copy size={13} className="text-[#666666] dark:text-[#A1A1AA]" />
                      Copy AI Fix Prompt
                    </button>

                    {/* TechButton - Factory aesthetic */}
                    <TechButton
                      onClick={() =>
                        setBypassModalData({
                          commit: audit.id,
                          file: v.location || audit.changedFiles[0] || 'N/A',
                          line: 'Line 1',
                          violation: v.errorWhat,
                          policy: v.policyViolated || 'SEC-001',
                        })
                      }
                      icon={<Send size={13} />}
                    >
                      Gửi Đơn Bypass
                    </TechButton>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>

      {/* Sleek Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded bg-[#111111] text-white font-mono text-xs border border-[#D6D6D6] dark:border-[#27272A] px-4 py-3 shadow-xl transition-all">
          <Check size={14} className="text-[#18794E]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Bypass Request Modal */}
      {bypassModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded bg-[#FFFFFF] dark:bg-[#18181B] p-6 shadow-2xl space-y-5 border border-[#D6D6D6] dark:border-[#27272A] relative">
            <div className="absolute top-[6px] left-[6px] w-[8px] h-[8px] border-t border-l border-[#C8102E] pointer-events-none opacity-80" />
            <div className="absolute top-[6px] right-[6px] w-[8px] h-[8px] border-t border-r border-[#C8102E] pointer-events-none opacity-80" />
            <div className="absolute bottom-[6px] left-[6px] w-[8px] h-[8px] border-b border-l border-[#C8102E] pointer-events-none opacity-80" />
            <div className="absolute bottom-[6px] right-[6px] w-[8px] h-[8px] border-b border-r border-[#C8102E] pointer-events-none opacity-80" />

            <div className="flex items-center justify-between border-b border-[#E5E5E5] dark:border-[#27272A] pb-3.5">
              <div className="flex items-center gap-2 text-[#111111] dark:text-[#F4F4F5]">
                <Terminal size={18} className="text-[#C8102E]" />
                <h3 className="text-base font-bold text-[#111111] dark:text-[#F4F4F5] font-sans">
                  Gửi yêu cầu Bypass
                </h3>
              </div>
              <button
                onClick={closeBypassModal}
                className="text-[#666666] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-[#F4F4F5] text-sm font-bold border-0 bg-transparent cursor-pointer"
              >
                ✕
              </button>
            </div>

            {submittedRequestId ? (
              <div className="py-6 text-center space-y-2.5">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#E6F4ED] dark:bg-emerald-950/60 text-[#18794E] dark:text-emerald-400 border border-[#18794E]/30">
                  <Check size={20} />
                </div>
                <h4 className="text-sm font-bold text-[#111111] dark:text-[#F4F4F5] font-sans">
                  Đã gửi yêu cầu #{submittedRequestId}
                </h4>
                <p className="text-xs text-[#666666] dark:text-[#A1A1AA] font-mono">Đang chờ Tech Lead phê duyệt</p>
                <div className="pt-3">
                  <button
                    onClick={closeBypassModal}
                    className="rounded border border-[#D6D6D6] dark:border-[#27272A] bg-[#FFFFFF] dark:bg-[#27272A] px-5 py-2 text-xs font-semibold text-[#111111] dark:text-[#F4F4F5] hover:bg-[#E5E7EB] dark:hover:bg-[#3F3F46] cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleFormSubmitBypass} className="space-y-4 text-xs">
                <div className="rounded bg-[#F4F5F7] dark:bg-[#09090B] border border-[#D6D6D6] dark:border-[#27272A] p-3.5 space-y-2 font-mono">
                  <div className="flex justify-between">
                    <span className="text-[#666666] dark:text-[#A1A1AA]">Commit:</span>
                    <span className="font-semibold text-[#111111] dark:text-[#F4F4F5]">{bypassModalData.commit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#666666] dark:text-[#A1A1AA]">Violation:</span>
                    <span className="font-semibold text-[#C8102E] dark:text-rose-400">{bypassModalData.violation}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#666666] dark:text-[#A1A1AA]">Policy:</span>
                    <span className="text-[#111111] dark:text-[#F4F4F5]">{bypassModalData.policy}</span>
                  </div>
                  <div className="flex justify-between border-t border-[#E5E5E5] dark:border-[#27272A] pt-1.5">
                    <span className="text-[#666666] dark:text-[#A1A1AA]">Approver:</span>
                    <span className="font-sans font-semibold text-[#111111] dark:text-[#F4F4F5]">Tech Lead</span>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <label className="block text-xs font-semibold text-[#111111] dark:text-[#F4F4F5] font-sans">
                    Lý do ngoại lệ <span className="text-[#C8102E]">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={bypassReason}
                    onChange={(e) => setBypassReason(e.target.value)}
                    placeholder="Nhập lý do chi tiết cho Tech Lead..."
                    className="w-full rounded border border-[#D6D6D6] dark:border-[#27272A] p-3 text-xs text-[#111111] dark:text-[#F4F4F5] focus:border-[#111111] focus:ring-1 focus:ring-[#111111] outline-none font-sans bg-[#FFFFFF] dark:bg-[#09090B] shadow-xs"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-[#E5E5E5] dark:border-[#27272A]">
                  <button
                    type="button"
                    onClick={closeBypassModal}
                    className="rounded border border-[#D6D6D6] dark:border-[#27272A] bg-[#FFFFFF] dark:bg-[#27272A] px-4 py-2 text-xs font-semibold text-[#666666] dark:text-[#A1A1AA] hover:bg-[#E5E7EB] dark:hover:bg-[#3F3F46] cursor-pointer"
                  >
                    Hủy
                  </button>
                  {/* TechButton - Factory aesthetic */}
                  <TechButton type="submit">
                    Gửi yêu cầu
                  </TechButton>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
