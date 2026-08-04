import { useState } from 'react'
import { Cpu, ShieldCheck, Lock, GitMerge, Sparkles, FileCode, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react'
import type { AuditRecord, Subsystem, Violation } from '../../lib/types'

/** Non-blocking per computeDashboardSummary's BLOCKING_SEVERITIES on the server — kept in sync by hand. */
const BLOCKING_SEVERITIES = new Set(['medium', 'high', 'critical'])

interface NodeLayout {
  id: string
  fallbackLabel: string
  fallbackType: string
  icon: React.ReactNode
  x: number
  y: number
  color: string
}

const LAYOUT: NodeLayout[] = [
  { id: 'secret-scan', fallbackLabel: 'Secret Scanner', fallbackType: 'Static Rule', icon: <Lock size={16} />, x: 18, y: 22, color: '#E11D48' },
  { id: 'architecture-check', fallbackLabel: 'Circular Dep Graph', fallbackType: 'Madge Engine', icon: <GitMerge size={16} />, x: 82, y: 22, color: '#059669' },
  { id: 'llm-policy-check', fallbackLabel: 'AI Policy Judge', fallbackType: 'LLM Reasoning', icon: <Sparkles size={16} />, x: 18, y: 78, color: '#7C3AED' },
  { id: 'policy-router', fallbackLabel: 'Policy Rules Router', fallbackType: 'Rule Matcher', icon: <FileCode size={16} />, x: 82, y: 78, color: '#0284C7' },
]

const CORE_ID = 'core'

function violationsFor(sourceId: string, audit?: AuditRecord): Violation[] {
  return audit?.violations.filter((v) => v.source === sourceId) ?? []
}

/** compliant = no findings at all; blocked = at least one finding severe enough to fail the gate. */
function nodeState(violations: Violation[]): 'compliant' | 'warning' | 'blocked' {
  if (violations.length === 0) return 'compliant'
  return violations.some((v) => BLOCKING_SEVERITIES.has(v.riskLevel)) ? 'blocked' : 'warning'
}

const STATE_RING: Record<'compliant' | 'warning' | 'blocked', string> = {
  compliant: 'border-2 border-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]',
  warning: 'border-2 border-amber-400 shadow-[0_0_0_4px_rgba(245,158,11,0.14)]',
  blocked: 'border-2 border-[#9E0B10] shadow-[0_0_0_4px_rgba(158,11,16,0.16)]',
}

const STATE_BADGE: Record<'compliant' | 'warning' | 'blocked', { label: string; className: string; icon: React.ReactNode }> = {
  compliant: { label: '100% An toàn', className: 'bg-emerald-50 border-emerald-200/80 text-emerald-800', icon: <CheckCircle2 size={14} className="text-emerald-600" /> },
  warning: { label: 'Cảnh báo — không chặn merge', className: 'bg-amber-50 border-amber-200/80 text-amber-800', icon: <AlertTriangle size={14} className="text-amber-600" /> },
  blocked: { label: 'Vi phạm — merge bị chặn', className: 'bg-red-50 border-red-200/80 text-[#9E0B10]', icon: <ShieldAlert size={14} className="text-[#9E0B10]" /> },
}

export function ArchitectureGraphWidget({
  subsystems,
  latestAudit,
}: {
  subsystems?: Subsystem[]
  latestAudit?: AuditRecord
}) {
  const [activeNode, setActiveNode] = useState<string>(CORE_ID)

  const subsystemById = new Map((subsystems ?? []).map((s) => [s.id, s]))

  const nodes = LAYOUT.map((layout) => {
    const violations = violationsFor(layout.id, latestAudit)
    return {
      ...layout,
      subsystem: subsystemById.get(layout.id),
      violations,
      state: latestAudit ? nodeState(violations) : null,
    }
  })

  const coreState: 'compliant' | 'warning' | 'blocked' | null = !latestAudit
    ? null
    : latestAudit.verdict === 'BLOCK'
    ? 'blocked'
    : latestAudit.violations.length > 0
    ? 'warning'
    : 'compliant'

  const current =
    activeNode === CORE_ID
      ? {
          id: CORE_ID,
          label: 'Code Architecture Core',
          type: 'System Core',
          status: latestAudit ? latestAudit.verdict : 'IDLE',
          icon: <Cpu size={18} />,
          color: '#9E0B10',
          state: coreState,
          violations: latestAudit?.violations ?? [],
        }
      : (() => {
          const n = nodes.find((x) => x.id === activeNode)!
          return {
            id: n.id,
            label: n.subsystem?.name ?? n.fallbackLabel,
            type: n.subsystem?.description ?? n.fallbackType,
            status: n.subsystem?.status ?? 'UNKNOWN',
            icon: n.icon,
            color: n.color,
            state: n.state,
            violations: n.violations,
          }
        })()

  const badge = current.state ? STATE_BADGE[current.state] : null

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] relative overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-red-50 border border-red-100 text-[#9E0B10]">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Live Code Architecture Node Graph</h3>
            <p className="text-xs text-slate-500 font-medium">Pre-push boundary & dependency isolation map</p>
          </div>
        </div>
        {coreState ? (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${STATE_BADGE[coreState].className}`}>
            {STATE_BADGE[coreState].icon}
            {coreState === 'compliant' ? '100% Compliant' : coreState === 'warning' ? 'Cảnh báo' : 'Merge Blocked'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200/80 px-3 py-1 text-xs font-bold text-slate-500">
            Chưa có audit
          </span>
        )}
      </div>

      {/* SVG Canvas for connecting lines */}
      <div className="relative h-64 w-full rounded-2xl bg-slate-50/80 border border-slate-200/80 p-2 overflow-hidden flex items-center justify-center">
        <svg className="absolute inset-0 h-full w-full pointer-events-none">
          {nodes.map((node) => (
            <line
              key={node.id}
              x1="50%"
              y1="50%"
              x2={`${node.x}%`}
              y2={`${node.y}%`}
              stroke={
                activeNode === node.id
                  ? '#9E0B10'
                  : node.state === 'blocked'
                  ? 'rgba(158, 11, 16, 0.35)'
                  : 'rgba(203, 213, 225, 0.8)'
              }
              strokeWidth={activeNode === node.id ? '2.5' : '1.5'}
              strokeDasharray={activeNode === node.id ? 'none' : '4 4'}
            />
          ))}
        </svg>

        {/* Core node */}
        <button
          onClick={() => setActiveNode(CORE_ID)}
          style={{ left: '50%', top: '50%' }}
          className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-extrabold shadow-md red-gradient text-white border-2 border-red-300 shadow-[0_6px_20px_rgba(158,11,16,0.35)] scale-110"
        >
          <span className="p-1 rounded-lg bg-white/20 text-white">
            <Cpu size={18} />
          </span>
          <span>Code Architecture Core</span>
        </button>

        {/* Checkpoint nodes */}
        {nodes.map((node) => {
          const isSelected = activeNode === node.id
          const ring = node.state ? STATE_RING[node.state] : 'border border-slate-200/90'
          return (
            <button
              key={node.id}
              onClick={() => setActiveNode(node.id)}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-extrabold shadow-md bg-white ${ring} ${
                isSelected ? 'text-[#9E0B10]' : 'text-slate-700'
              }`}
            >
              <span className="p-1 rounded-lg bg-slate-100" style={{ color: node.color }}>
                {node.icon}
              </span>
              <span>{node.subsystem?.name ?? node.fallbackLabel}</span>
            </button>
          )
        })}
      </div>

      {/* Selected Node Details Footer */}
      <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200/80 p-3.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-white border border-slate-200 shadow-2xs" style={{ color: current.color }}>
              {current.icon}
            </span>
            <div>
              <div className="text-xs font-extrabold text-slate-900">{current.label}</div>
              <div className="text-[11px] text-slate-500 font-medium">
                {current.type} • Status: <span className="font-bold text-slate-700">{current.status}</span>
              </div>
            </div>
          </div>
          {badge && (
            <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border ${badge.className}`}>
              {badge.icon} {badge.label}
            </span>
          )}
        </div>

        {current.violations.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t border-slate-200/80 pt-3">
            {current.violations.slice(0, 4).map((v, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-slate-700">
                <span
                  className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${
                    BLOCKING_SEVERITIES.has(v.riskLevel) ? 'bg-red-100 text-[#9E0B10]' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {v.riskLevel}
                </span>
                <span className="font-medium">
                  {v.errorWhat} <span className="text-slate-400 font-mono">({v.location})</span>
                </span>
              </li>
            ))}
            {current.violations.length > 4 && (
              <li className="text-[11px] text-slate-400 font-medium">+{current.violations.length - 4} khác…</li>
            )}
          </ul>
        )}

        {latestAudit && current.violations.length === 0 && (
          <p className="mt-3 border-t border-slate-200/80 pt-3 text-[11px] text-emerald-700 font-semibold">
            Không phát hiện vi phạm nào ở lần quét gần nhất — đạt chuẩn an toàn 100%.
          </p>
        )}

        {!latestAudit && (
          <p className="mt-3 border-t border-slate-200/80 pt-3 text-[11px] text-slate-400 font-medium">
            Chưa có lần audit nào được ghi nhận trong phiên này.
          </p>
        )}
      </div>
    </div>
  )
}
