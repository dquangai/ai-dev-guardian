import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cog,
  FileText,
  Lock,
  Play,
  Shield,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react'
import { useApi } from '../lib/useApi'
import type { AuditRecord, DashboardSummary, Subsystem } from '../lib/types'
import { StatCard } from '../components/ui/StatCard'
import { Panel } from '../components/ui/Panel'
import { StatusPill, verdictVariant, type PillVariant } from '../components/ui/StatusPill'
import { useAuth } from '../context/AuthContext'

const SUBSYSTEM_ICON: Record<string, { icon: React.ReactNode; bg: string; pill: PillVariant }> = {
  'secret-scan': { icon: <Lock size={18} />, bg: 'bg-red-50 text-red-500', pill: 'green' },
  'architecture-check': { icon: <Shield size={18} />, bg: 'bg-amber-50 text-amber-500', pill: 'green' },
  'llm-policy-check': { icon: <Sparkles size={18} />, bg: 'bg-violet-50 text-violet-500', pill: 'blue' },
  'policy-router': { icon: <FileText size={18} />, bg: 'bg-indigo-50 text-indigo-500', pill: 'violet' },
}

export function Overview() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const canRunAudit = can('audit:run')
  const { data: summary } = useApi<DashboardSummary>('/dashboard/summary')
  const { data: subsystems } = useApi<Subsystem[]>('/dashboard/subsystems')
  const { data: recent } = useApi<AuditRecord[]>('/dashboard/recent-activity?limit=4')

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              <ShieldCheck size={14} /> VinSmart Future AI Pre-Push Code Governance
            </span>
            <h2 className="mt-4 max-w-xl text-2xl font-semibold text-gray-900">
              Automated code governance before your commits reach Git.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-500">
              AI Dev Guardian checks code diffs against strict security rules, architecture
              boundaries, circular dependencies, and Gemini 3.5 Flash policy reasoning.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <button
              onClick={() => navigate(canRunAudit ? '/code-audit' : '/findings')}
              className="flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <Play size={15} fill="currentColor" /> {canRunAudit ? 'Launch Code Audit' : 'View Findings'}
            </button>
            <span className="text-xs text-gray-400">Deterministic Checks + Gemini AI</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Governance Health"
          value={`${summary?.governanceHealthPct ?? 0}%`}
          icon={<ShieldCheck size={18} />}
          iconClassName="text-emerald-500"
          progress={summary?.governanceHealthPct ?? 0}
        />
        <StatCard
          label="Total Audits"
          value={summary?.totalAudits ?? 0}
          icon={<Activity size={18} />}
          iconClassName="text-blue-500"
          sub="Logged in session"
        />
        <StatCard
          label="Passed"
          value={summary?.passed ?? 0}
          icon={<CheckCircle2 size={18} />}
          iconClassName="text-emerald-500"
          sub="100% compliant"
          subClassName="text-emerald-600"
        />
        <StatCard
          label="Warnings"
          value={summary?.warnings ?? 0}
          icon={<AlertTriangle size={18} />}
          iconClassName="text-amber-500"
          sub="Non-blocking"
          subClassName="text-amber-600"
        />
        <StatCard
          label="Merge Blocked"
          value={summary?.mergeBlocked ?? 0}
          icon={<XCircle size={18} />}
          iconClassName="text-red-500"
          sub="Rejected at gate"
          subClassName="text-red-600"
        />
        <StatCard
          label="Critical Leaks"
          value={summary?.criticalLeaks ?? 0}
          icon={<Lock size={18} />}
          iconClassName="text-red-500"
          sub="Secrets & Architecture"
          subClassName="text-red-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel
          title="Engine Subsystems Breakdown"
          icon={<Cog size={16} className="text-gray-400" />}
          action={<span className="text-xs text-gray-400">Active Guards</span>}
        >
          <div className="space-y-3">
            {subsystems?.map((s) => {
              const meta = SUBSYSTEM_ICON[s.id] ?? { icon: <Shield size={18} />, bg: 'bg-gray-100', pill: 'gray' as PillVariant }
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${meta.bg}`}>
                      {meta.icon}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-500">{s.description}</div>
                    </div>
                  </div>
                  <StatusPill variant={meta.pill}>{s.status}</StatusPill>
                </div>
              )
            })}
          </div>
        </Panel>

        <Panel
          title="Recent Audit History Activity"
          icon={<Clock size={16} className="text-gray-400" />}
          action={
            <button
              onClick={() => navigate('/findings')}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              View All ({recent?.length ?? 0})
            </button>
          }
        >
          <div className="space-y-3">
            {recent && recent.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-400">No audits logged yet.</p>
            )}
            {recent?.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <StatusPill variant={verdictVariant(r.verdict)}>
                      {r.verdict === 'BLOCK' ? 'MERGE BLOCKED' : 'PASSED'}
                    </StatusPill>
                    <span className="text-xs text-gray-400">
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Files: {r.changedFiles[0] ?? '—'}
                    {r.changedFiles.length > 1 ? ` +${r.changedFiles.length - 1} more` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">
                    {r.violations.length} violations
                  </div>
                  <div className="text-xs text-gray-400">Target: {r.target}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}
