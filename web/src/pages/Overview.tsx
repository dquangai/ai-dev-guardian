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
import type { AuditRecord, DashboardSummary, Subsystem, SystemDiagnostics } from '../lib/types'
import { StatCard } from '../components/ui/StatCard'
import { Panel } from '../components/ui/Panel'
import { StatusPill, verdictVariant, type PillVariant } from '../components/ui/StatusPill'
import { useAuth } from '../context/AuthContext'
import { ArchitectureGraphWidget } from '../components/ui/ArchitectureGraphWidget'
import { engineShortName } from '../lib/engineLabel'

const SUBSYSTEM_ICON: Record<string, { icon: React.ReactNode; bg: string; pill: PillVariant }> = {
  'secret-scan': { icon: <Lock size={18} />, bg: 'bg-red-50 text-[#9E0B10] border border-red-100', pill: 'green' },
  'architecture-check': { icon: <Shield size={18} />, bg: 'bg-amber-50 text-amber-700 border border-amber-100', pill: 'green' },
  'llm-policy-check': { icon: <Sparkles size={18} />, bg: 'bg-purple-50 text-purple-700 border border-purple-100', pill: 'blue' },
  'policy-router': { icon: <FileText size={18} />, bg: 'bg-blue-50 text-blue-700 border border-blue-100', pill: 'violet' },
}

export function Overview() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const canRunAudit = can('audit:run')
  const { data: summary } = useApi<DashboardSummary>('/dashboard/summary')
  const { data: subsystems } = useApi<Subsystem[]>('/dashboard/subsystems')
  const { data: recent } = useApi<AuditRecord[]>('/dashboard/recent-activity?limit=4')
  const { data: diagnostics } = useApi<SystemDiagnostics>('/system/diagnostics')

  return (
    <div className="space-y-6">
      {/* Vingroup Modern Red Hero Banner */}
      <section className="rounded-2xl red-gradient p-8 shadow-xl text-white relative overflow-hidden">
        <div className="flex items-start justify-between gap-6 relative z-10">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 px-3.5 py-1 text-xs font-extrabold text-white shadow-sm">
              <Sparkles size={14} /> VinSmart Future AI Pre-Push Code Governance
            </span>
            <h2 className="mt-4 max-w-xl text-2xl font-extrabold tracking-tight text-white leading-snug">
              Automated code governance before your commits reach Git.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-red-50/90 font-medium">
              AI Dev Guardian checks code diffs against strict security rules, architecture
              boundaries, circular dependencies, and {engineShortName(diagnostics?.llm)} policy reasoning.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2.5">
            <button
              onClick={() => navigate(canRunAudit ? '/code-audit' : '/findings')}
              className="flex items-center gap-2.5 rounded-xl bg-white px-6 py-3 text-sm font-extrabold text-[#9E0B10] shadow-lg hover:bg-slate-50"
            >
              <Play size={16} fill="currentColor" /> {canRunAudit ? 'Launch Code Audit' : 'View Findings'}
            </button>
            <span className="text-xs font-semibold text-red-100/80">Deterministic Checks + {engineShortName(diagnostics?.llm)} AI</span>
          </div>
        </div>
      </section>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Governance Health"
          value={`${summary?.governanceHealthPct ?? 0}%`}
          icon={<ShieldCheck size={18} />}
          iconClassName="text-[#9E0B10]"
          progress={summary?.governanceHealthPct ?? 0}
        />
        <StatCard
          label="Total Audits"
          value={summary?.totalAudits ?? 0}
          icon={<Activity size={18} />}
          iconClassName="text-blue-700"
          sub="Logged in session"
          subClassName="text-slate-500"
        />
        <StatCard
          label="Passed"
          value={summary?.passed ?? 0}
          icon={<CheckCircle2 size={18} />}
          iconClassName="text-emerald-700"
          sub="100% compliant"
          subClassName="text-emerald-700 font-bold"
        />
        <StatCard
          label="Warnings"
          value={summary?.warnings ?? 0}
          icon={<AlertTriangle size={18} />}
          iconClassName="text-amber-700"
          sub="Non-blocking"
          subClassName="text-amber-700 font-semibold"
        />
        <StatCard
          label="Merge Blocked"
          value={summary?.mergeBlocked ?? 0}
          icon={<XCircle size={18} />}
          iconClassName="text-[#9E0B10]"
          sub="Rejected at gate"
          subClassName="text-[#9E0B10] font-semibold"
        />
        <StatCard
          label="Critical Leaks"
          value={summary?.criticalLeaks ?? 0}
          icon={<Lock size={18} />}
          iconClassName="text-[#9E0B10]"
          sub="Secrets & Architecture"
          subClassName="text-[#9E0B10] font-semibold"
        />
      </div>

      {/* Architecture Node Graph Component */}
      <ArchitectureGraphWidget subsystems={subsystems} latestAudit={recent?.[0]} />

      {/* Subsystems Breakdown & Recent Activity */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel
          title="Engine Subsystems Breakdown"
          icon={<Cog size={16} className="text-slate-600" />}
          action={<span className="text-xs font-bold text-slate-500">Active Guards</span>}
        >
          <div className="space-y-3">
            {subsystems?.map((s) => {
              const meta = SUBSYSTEM_ICON[s.id] ?? { icon: <Shield size={18} />, bg: 'bg-slate-100 text-slate-600', pill: 'gray' as PillVariant }
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl bg-slate-50/70 border border-slate-200/80 px-4 py-3 hover:border-red-200 hover:bg-white"
                >
                  <div className="flex items-center gap-3">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-2xs ${meta.bg}`}>
                      {meta.icon}
                    </span>
                    <div>
                      <div className="text-sm font-extrabold text-slate-900">{s.name}</div>
                      <div className="text-xs text-slate-500 font-medium">{s.description}</div>
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
          icon={<Clock size={16} className="text-slate-600" />}
          action={
            <button
              onClick={() => navigate('/findings')}
              className="text-xs font-bold text-[#9E0B10] hover:underline"
            >
              View All ({recent?.length ?? 0})
            </button>
          }
        >
          <div className="space-y-3">
            {recent && recent.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">No audits logged yet.</p>
            )}
            {recent?.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl bg-slate-50/70 border border-slate-200/80 px-4 py-3 hover:border-red-200 hover:bg-white">
                <div>
                  <div className="flex items-center gap-2">
                    <StatusPill variant={verdictVariant(r.verdict)}>
                      {r.verdict === 'BLOCK' ? 'MERGE BLOCKED' : 'PASSED'}
                    </StatusPill>
                    <span className="text-xs text-slate-500 font-mono font-medium">
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="mt-1 text-xs font-mono text-slate-600 font-medium">
                    Files: {r.changedFiles[0] ?? '—'}
                    {r.changedFiles.length > 1 ? ` +${r.changedFiles.length - 1} more` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-extrabold text-slate-900">
                    {r.violations.length} violations
                  </div>
                  <div className="text-xs text-slate-500 font-mono">Target: {r.target}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}
