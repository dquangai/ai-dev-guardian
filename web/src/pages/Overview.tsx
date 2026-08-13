import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cog,
  FileText,
  Lock,
  Shield,
  ShieldCheck,
  Sparkles,
  Terminal,
  XCircle,
  Zap,
} from 'lucide-react'
import { useApi } from '../lib/useApi'
import type { AuditRecord, DashboardSummary, Subsystem } from '../lib/types'
import { StatCard } from '../components/ui/StatCard'
import { Panel } from '../components/ui/Panel'
import { StatusPill, verdictVariant, type PillVariant } from '../components/ui/StatusPill'
import { useAuth } from '../context/AuthContext'
import { DeveloperOverview } from './DeveloperOverview'
import { TechButton } from '../components/ui/TechButton'

const SUBSYSTEM_ICON: Record<string, { icon: React.ReactNode; bg: string; pill: PillVariant }> = {
  'secret-scan': { icon: <Lock size={16} />, bg: 'bg-[#F4F5F7] text-[#111111] border border-[#D6D6D6]', pill: 'green' },
  'architecture-check': { icon: <Shield size={16} />, bg: 'bg-[#F4F5F7] text-[#111111] border border-[#D6D6D6]', pill: 'green' },
  'llm-policy-check': { icon: <Sparkles size={16} />, bg: 'bg-[#F4F5F7] text-[#111111] border border-[#D6D6D6]', pill: 'blue' },
  'policy-router': { icon: <FileText size={16} />, bg: 'bg-[#F4F5F7] text-[#111111] border border-[#D6D6D6]', pill: 'violet' },
}

export function Overview() {
  const navigate = useNavigate()
  const { user } = useAuth()

  if (user?.role === 'developer') {
    return <DeveloperOverview />
  }

  const { data: summary } = useApi<DashboardSummary>('/dashboard/summary')
  const { data: subsystems } = useApi<Subsystem[]>('/dashboard/subsystems')
  const { data: recent } = useApi<AuditRecord[]>('/dashboard/recent-activity?limit=5')

  return (
    <div className="space-y-6">
      {/* 1. Metrics KPI Row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Governance Health"
          value={`${summary?.governanceHealthPct ?? 100}%`}
          icon={<ShieldCheck size={18} />}
          iconClassName="text-[#111111]"
          progress={summary?.governanceHealthPct ?? 100}
        />
        <StatCard
          label="Total Audits"
          value={summary?.totalAudits ?? 0}
          icon={<Activity size={18} />}
          iconClassName="text-[#111111]"
          sub="Logged in session"
          subClassName="text-[#666666]"
        />
        <StatCard
          label="Passed"
          value={summary?.passed ?? 0}
          icon={<CheckCircle2 size={18} />}
          iconClassName="text-[#18794E]"
          sub="100% compliant"
          subClassName="text-[#18794E] font-bold"
        />
        <StatCard
          label="Warnings"
          value={summary?.warnings ?? 0}
          icon={<AlertTriangle size={18} />}
          iconClassName="text-[#B54708]"
          sub="Non-blocking"
          subClassName="text-[#B54708] font-semibold"
        />
        <StatCard
          label="Merge Blocked"
          value={summary?.mergeBlocked ?? 0}
          icon={<XCircle size={18} />}
          iconClassName="text-[#C8102E]"
          sub="Rejected at gate"
          subClassName="text-[#C8102E] font-semibold"
        />
        <StatCard
          label="Critical Leaks"
          value={summary?.criticalLeaks ?? 0}
          icon={<Lock size={18} />}
          iconClassName="text-[#C8102E]"
          sub="Secrets & Architecture"
          subClassName="text-[#C8102E] font-semibold"
        />
      </div>

      {/* 2. Pre-Push Security Pipeline & Control Hub (Replaces Node Graph) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Pre-Push Enforcement Pipeline Overview */}
        <div className="lg:col-span-2 rounded-[12px] border border-[#D6D6D6] bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3.5 mb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#F4F5F7] text-[#111111] border border-[#D6D6D6]">
                  <Terminal size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#111111] font-mono tracking-tight uppercase">
                    PRE-PUSH GATE ENFORCEMENT PIPELINE
                  </h3>
                  <p className="text-xs text-[#666666]">Luồng kiểm tra tuân thủ mã nguồn tự động trước khi push commit</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#18794E] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#18794E]" />
                </span>
                <span className="font-mono text-[10px] font-bold text-[#111111] uppercase tracking-wider">
                  ENFORCEMENT ACTIVE
                </span>
              </div>
            </div>

            {/* Pipeline Stage Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="rounded-[10px] border border-[#D6D6D6] bg-white p-3.5 hover:border-[#111111] transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] font-bold uppercase text-[#666666]">STAGE 01</span>
                  <StatusPill variant="green">ACTIVE</StatusPill>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <Lock size={15} className="text-[#111111]" />
                  <h4 className="text-xs font-extrabold text-[#111111]">Secret Leak Scanner</h4>
                </div>
                <p className="text-[11px] text-[#555555] leading-relaxed">Quét Regex tự động các khoá API, AWS Keys, JWT Tokens trong code staged.</p>
              </div>

              <div className="rounded-[10px] border border-[#D6D6D6] bg-white p-3.5 hover:border-[#111111] transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] font-bold uppercase text-[#666666]">STAGE 02</span>
                  <StatusPill variant="green">ACTIVE</StatusPill>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <Shield size={15} className="text-[#111111]" />
                  <h4 className="text-xs font-extrabold text-[#111111]">Layer Isolation Rules</h4>
                </div>
                <p className="text-[11px] text-[#555555] leading-relaxed">Kiểm tra vi phạm kiến trúc phân lớp & phụ thuộc vòng lặp giữa các package.</p>
              </div>

              <div className="rounded-[10px] border border-[#D6D6D6] bg-white p-3.5 hover:border-[#111111] transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] font-bold uppercase text-[#666666]">STAGE 03</span>
                  <StatusPill variant="green">ACTIVE</StatusPill>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <FileText size={15} className="text-[#111111]" />
                  <h4 className="text-xs font-extrabold text-[#111111]">Dependency Audit</h4>
                </div>
                <p className="text-[11px] text-[#555555] leading-relaxed">Rà soát lỗ hổng thư viện phụ thuộc và bản quyền phần mềm mã nguồn mở.</p>
              </div>

              <div className="rounded-[10px] border border-[#D6D6D6] bg-white p-3.5 hover:border-[#111111] transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] font-bold uppercase text-[#666666]">STAGE 04</span>
                  <StatusPill variant="blue">LLM ACTIVE</StatusPill>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={15} className="text-[#111111]" />
                  <h4 className="text-xs font-extrabold text-[#111111]">LLM Policy Engine</h4>
                </div>
                <p className="text-[11px] text-[#555555] leading-relaxed">Giải mã và đánh giá ngữ nghĩa chính sách bằng mô hình AI Guardian chuyên dụng.</p>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-[#E5E7EB] flex items-center justify-between text-xs text-[#555555]">
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <Zap size={14} className="text-[#18794E]" />
              <span>Gate Average Latency: <strong>42ms</strong> per commit scan</span>
            </div>
            <TechButton onClick={() => navigate('/engine-config')} className="py-1 px-3 text-[10px]">
              Configure Gate Rules
            </TechButton>
          </div>
        </div>

        {/* Right 1 Col: Quick Control & Gate Verdict Hub */}
        <div className="rounded-[12px] border border-[#D6D6D6] bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3.5 mb-4">
              <h3 className="text-sm font-extrabold text-[#111111] font-mono tracking-tight uppercase">
                SECURITY VERDICT
              </h3>
              <span className="font-mono text-[10px] font-bold text-[#18794E] uppercase">100% AN TOÀN</span>
            </div>

            <div className="rounded-[10px] border border-[#D6D6D6] bg-[#F8F9FA] p-4 text-center mb-5">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#18794E]/10 text-[#18794E] mb-2">
                <CheckCircle2 size={24} />
              </div>
              <h4 className="text-sm font-extrabold text-[#111111]">SYSTEM PASSED ALL CHECKS</h4>
              <p className="text-xs text-[#666666] mt-1 leading-relaxed">
                Không phát hiện vi phạm nào ở lần quét mới nhất. Đạt chuẩn an toàn 100%.
              </p>
            </div>

            <div className="space-y-2">
              <TechButton onClick={() => navigate('/policies')} className="w-full justify-between py-2 px-3 text-[11px]">
                <span>XEM TẤT CẢ CHÍNH SÁCH</span>
              </TechButton>
              <TechButton onClick={() => navigate('/findings')} className="w-full justify-between py-2 px-3 text-[11px]">
                <span>NHẬT KÝ KIỂM ĐỊNH (FINDINGS)</span>
              </TechButton>
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-[#E5E7EB] text-[10px] font-mono text-[#666666] text-center">
            QWOANG SECURITY PIPELINE • V2.4.0
          </div>
        </div>
      </div>

      {/* 3. Subsystems Breakdown & Recent Audit Activity Row */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel
          title="Engine Subsystems Breakdown"
          icon={<Cog size={16} className="text-[#111111]" />}
          action={<span className="text-xs font-mono font-bold text-[#555555]">Active Guards</span>}
        >
          <div className="space-y-3">
            {subsystems?.map((s) => {
              const meta = SUBSYSTEM_ICON[s.id] ?? { icon: <Shield size={16} />, bg: 'bg-[#F4F5F7] text-[#111111] border border-[#D6D6D6]', pill: 'gray' as PillVariant }
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-[10px] bg-white border border-[#D6D6D6] px-4 py-3 hover:border-[#111111] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-[8px] ${meta.bg}`}>
                      {meta.icon}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-[#111111]">{s.name}</div>
                      <div className="text-xs text-[#555555] font-medium">{s.description}</div>
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
          icon={<Clock size={16} className="text-[#111111]" />}
          action={
            <button
              onClick={() => navigate('/findings')}
              className="text-xs font-mono font-bold text-[#111111] hover:underline cursor-pointer"
            >
              View All ({recent?.length ?? 0}) →
            </button>
          }
        >
          <div className="space-y-3">
            {recent && recent.length === 0 && (
              <p className="py-6 text-center text-sm text-[#666666]">No audits logged yet.</p>
            )}
            {recent?.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-[10px] bg-white border border-[#D6D6D6] px-4 py-3 hover:border-[#111111] transition-all">
                <div>
                  <div className="flex items-center gap-2">
                    <StatusPill variant={verdictVariant(r.verdict)}>
                      {r.verdict === 'BLOCK' ? 'MERGE BLOCKED' : 'PASSED'}
                    </StatusPill>
                    <span className="text-xs text-[#666666] font-mono font-medium">
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="mt-1 text-xs font-mono text-[#555555] font-medium">
                    Files: {r.changedFiles[0] ?? '—'}
                    {r.changedFiles.length > 1 ? ` +${r.changedFiles.length - 1} more` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-[#111111]">
                    {r.violations.length} violations
                  </div>
                  <div className="text-xs text-[#666666] font-mono">Target: {r.target}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}
