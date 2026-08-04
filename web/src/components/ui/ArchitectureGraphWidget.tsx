import { useState, type CSSProperties } from 'react'
import { Cpu, ShieldCheck, Lock, GitMerge, Sparkles, FileCode, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react'
import type { AuditRecord, Subsystem, Violation } from '../../lib/types'

/** Orbit geometry — see the `.animate-orbit-*` keyframes in index.css for the two-part
 * rotate/counter-rotate trick that keeps each planet's icon upright while it revolves. */
const STAGE_SIZE = 288
const ORBIT_RADIUS = 96
const ORBIT_DURATION = 28

/** Non-blocking per computeDashboardSummary's BLOCKING_SEVERITIES on the server — kept in sync by hand. */
const BLOCKING_SEVERITIES = new Set(['medium', 'high', 'critical'])

type StepState = 'compliant' | 'warning' | 'blocked'

interface StepLayout {
  id: string
  fallbackLabel: string
  fallbackType: string
  icon: React.ReactNode
  color: string
}

/** Display order only — checks actually run in parallel (orchestrator.ts's Promise.all), but a
 * left-to-right "gate" reads far more naturally than a hub-and-spoke for "checks a commit passes". */
const LAYOUT: StepLayout[] = [
  { id: 'secret-scan', fallbackLabel: 'Secret Scanner', fallbackType: 'Static Rule', icon: <Lock size={20} />, color: '#E11D48' },
  { id: 'architecture-check', fallbackLabel: 'Circular Dep Graph', fallbackType: 'Madge Engine', icon: <GitMerge size={20} />, color: '#059669' },
  { id: 'llm-policy-check', fallbackLabel: 'AI Policy Judge', fallbackType: 'LLM Reasoning', icon: <Sparkles size={20} />, color: '#7C3AED' },
  { id: 'policy-router', fallbackLabel: 'Policy Rules Router', fallbackType: 'Rule Matcher', icon: <FileCode size={20} />, color: '#0284C7' },
]

const CORE_ID = 'core'

function violationsFor(sourceId: string, audit?: AuditRecord): Violation[] {
  return audit?.violations.filter((v) => v.source === sourceId) ?? []
}

/** compliant = no findings at all; blocked = at least one finding severe enough to fail the gate. */
function stepState(violations: Violation[]): StepState {
  if (violations.length === 0) return 'compliant'
  return violations.some((v) => BLOCKING_SEVERITIES.has(v.riskLevel)) ? 'blocked' : 'warning'
}

/** State reads as the halo (border + outer glow) around a planet; brighter red than the corporate
 * #9E0B10 since the deep brand red barely reads as a glow against a near-black background. */
const GLOW_CLASS: Record<StepState, string> = {
  compliant: 'border-emerald-400 shadow-[0_0_18px_4px_rgba(16,185,129,0.45)]',
  warning: 'border-amber-400 shadow-[0_0_18px_4px_rgba(245,158,11,0.45)]',
  blocked: 'border-[#ff5468] shadow-[0_0_20px_5px_rgba(255,84,104,0.5)]',
}

/** A category color reads as a lit sphere: soft highlight upper-left, shadow lower-right, like a
 * real planet — rather than a flat tinted badge. The category itself (what kind of check this is)
 * is the "material"; GLOW_CLASS (audit state) is layered on top as the halo. */
function planetSphereStyle(hex: string): CSSProperties {
  return {
    backgroundColor: hex,
    backgroundImage: [
      'radial-gradient(circle at 32% 26%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.16) 18%, transparent 42%)',
      'radial-gradient(circle at 68% 78%, rgba(0,0,0,0.55) 0%, transparent 62%)',
    ].join(', '),
  }
}

/** The sun gets a warmer, brighter core than the planets to read as a star rather than a planet. */
const SUN_SPHERE_STYLE: CSSProperties = {
  backgroundColor: '#c8102e',
  backgroundImage: [
    'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.95) 0%, rgba(255,214,153,0.55) 12%, transparent 45%)',
    'radial-gradient(circle at 70% 78%, rgba(0,0,0,0.4) 0%, transparent 60%)',
  ].join(', '),
}

/** Bright spoke — the link from a planet to the sun, lit up while that planet is selected. */
const SPOKE_BRIGHT: Record<StepState, string> = {
  compliant: 'bg-emerald-400 shadow-[0_0_8px_2px_rgba(16,185,129,0.6)]',
  warning: 'bg-amber-400 shadow-[0_0_8px_2px_rgba(245,158,11,0.6)]',
  blocked: 'bg-[#ff5468] shadow-[0_0_8px_2px_rgba(255,84,104,0.6)]',
}

/** Dim spoke — same state color, low opacity, shown for planets that aren't selected. */
const SPOKE_DIM: Record<StepState, string> = {
  compliant: 'bg-emerald-400/25',
  warning: 'bg-amber-400/25',
  blocked: 'bg-[#ff5468]/25',
}

function spokeClass(state: StepState | null, isSelected: boolean): string {
  if (!state) return isSelected ? 'bg-white/50' : 'bg-white/10'
  return isSelected ? SPOKE_BRIGHT[state] : SPOKE_DIM[state]
}

/** A handful of fixed-position radial-gradient dots — cheap CSS-only starfield, no images/JS/animation. */
const STARFIELD_STYLE: React.CSSProperties = {
  backgroundImage: [
    'radial-gradient(1.2px 1.2px at 8% 22%, rgba(255,255,255,0.9), transparent 100%)',
    'radial-gradient(1px 1px at 18% 68%, rgba(255,255,255,0.6), transparent 100%)',
    'radial-gradient(1.5px 1.5px at 28% 12%, rgba(255,255,255,0.85), transparent 100%)',
    'radial-gradient(1px 1px at 38% 82%, rgba(255,255,255,0.55), transparent 100%)',
    'radial-gradient(1.3px 1.3px at 47% 40%, rgba(255,255,255,0.8), transparent 100%)',
    'radial-gradient(1px 1px at 56% 15%, rgba(255,255,255,0.5), transparent 100%)',
    'radial-gradient(1.4px 1.4px at 64% 70%, rgba(255,255,255,0.85), transparent 100%)',
    'radial-gradient(1px 1px at 73% 30%, rgba(255,255,255,0.6), transparent 100%)',
    'radial-gradient(1.5px 1.5px at 82% 85%, rgba(255,255,255,0.8), transparent 100%)',
    'radial-gradient(1px 1px at 90% 45%, rgba(255,255,255,0.55), transparent 100%)',
    'radial-gradient(1.2px 1.2px at 96% 20%, rgba(255,255,255,0.7), transparent 100%)',
    'radial-gradient(1px 1px at 12% 92%, rgba(255,255,255,0.5), transparent 100%)',
    'radial-gradient(1.3px 1.3px at 60% 92%, rgba(255,255,255,0.7), transparent 100%)',
    'radial-gradient(1px 1px at 3% 50%, rgba(255,255,255,0.5), transparent 100%)',
    'radial-gradient(1.2px 1.2px at 43% 58%, rgba(255,255,255,0.65), transparent 100%)',
  ].join(', '),
}

const STATE_BADGE: Record<StepState, { label: string; className: string; icon: React.ReactNode }> = {
  compliant: { label: '100% An toàn', className: 'bg-emerald-50 border-emerald-200/80 text-emerald-800', icon: <CheckCircle2 size={14} className="text-emerald-600" /> },
  warning: { label: 'Cảnh báo — không chặn merge', className: 'bg-amber-50 border-amber-200/80 text-amber-800', icon: <AlertTriangle size={14} className="text-amber-600" /> },
  blocked: { label: 'Vi phạm — merge bị chặn', className: 'bg-red-50 border-red-200/80 text-[#9E0B10]', icon: <ShieldAlert size={14} className="text-[#9E0B10]" /> },
}

export function ArchitectureGraphWidget({
  subsystems,
  latestAudit,
}: {
  subsystems?: Subsystem[] | null
  latestAudit?: AuditRecord
}) {
  const [activeNode, setActiveNode] = useState<string>(CORE_ID)

  const subsystemById = new Map((subsystems ?? []).map((s) => [s.id, s]))

  const steps = LAYOUT.map((layout) => {
    const violations = violationsFor(layout.id, latestAudit)
    return {
      ...layout,
      subsystem: subsystemById.get(layout.id),
      violations,
      state: latestAudit ? stepState(violations) : null,
    }
  })

  const coreState: StepState | null = !latestAudit
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
          label: 'Kết quả tổng hợp',
          type: 'Pre-push Gate Verdict',
          status: latestAudit ? latestAudit.verdict : 'IDLE',
          icon: <Cpu size={20} />,
          color: '#9E0B10',
          state: coreState,
          violations: latestAudit?.violations ?? [],
        }
      : (() => {
          const s = steps.find((x) => x.id === activeNode)!
          return {
            id: s.id,
            label: s.subsystem?.name ?? s.fallbackLabel,
            type: s.subsystem?.description ?? s.fallbackType,
            status: s.subsystem?.status ?? 'UNKNOWN',
            icon: s.icon,
            color: s.color,
            state: s.state,
            violations: s.violations,
          }
        })()

  const badge = current.state ? STATE_BADGE[current.state] : null

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] relative overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-red-50 border border-red-100 text-[#9E0B10]">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Live Code Architecture Node Graph</h3>
            <p className="text-xs text-slate-500 font-medium">Luồng kiểm tra pre-push qua từng trạm gác bảo mật</p>
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

      {/* Solar-system canvas — checks orbit the aggregated result; click one to light up its link to the sun */}
      <div className="relative rounded-2xl border border-white/10 bg-[radial-gradient(ellipse_at_top,_#1a0b16_0%,_#0a0510_55%,_#050308_100%)] p-6 overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={STARFIELD_STYLE} />
        <div className="pointer-events-none absolute -top-8 left-1/4 h-40 w-40 rounded-full bg-red-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 right-1/4 h-40 w-40 rounded-full bg-violet-600/15 blur-3xl" />

        <div className="relative mx-auto" style={{ width: STAGE_SIZE, height: STAGE_SIZE }}>
          {/* Static orbit path guide */}
          <div
            className="absolute rounded-full border border-dashed border-white/15"
            style={{
              width: ORBIT_RADIUS * 2,
              height: ORBIT_RADIUS * 2,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />

          {steps.map((step, i) => {
            const isSelected = activeNode === step.id
            const angle = (i / steps.length) * 360
            const delay = -(i / steps.length) * ORBIT_DURATION
            const glow = step.state ? GLOW_CLASS[step.state] : 'border-white/20'
            const spokeVars = {
              '--orbit-duration': `${ORBIT_DURATION}s`,
              '--orbit-delay': `${delay}s`,
              '--orbit-static-angle': `${angle}deg`,
            } as CSSProperties

            return (
              <div key={step.id} className="absolute left-1/2 top-1/2 h-0 w-0 animate-orbit-spoke" style={spokeVars}>
                {/* Spoke: link from the sun to this planet */}
                <div
                  className={`absolute left-0 top-0 h-0.5 origin-left rounded-full ${spokeClass(step.state, isSelected)} ${
                    isSelected ? 'shadow-[0_0_6px_2px_rgba(255,255,255,0.3)]' : ''
                  }`}
                  style={{ width: ORBIT_RADIUS }}
                />
                {/* Planet: counter-rotates so its icon stays upright while it revolves */}
                <div
                  className="absolute left-0 top-0 animate-orbit-counter"
                  style={{ '--orbit-radius': `${ORBIT_RADIUS}px`, ...spokeVars } as CSSProperties}
                >
                  <button
                    onClick={() => setActiveNode(step.id)}
                    title={step.subsystem?.name ?? step.fallbackLabel}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 flex h-14 w-14 items-center justify-center rounded-full border-2 text-white ${glow} ${
                      isSelected ? 'outline outline-2 outline-offset-2 outline-white/70' : ''
                    }`}
                    style={planetSphereStyle(step.color)}
                  >
                    <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">{step.icon}</span>
                  </button>
                </div>
              </div>
            )
          })}

          {/* Sun — the aggregated result */}
          <button
            onClick={() => setActiveNode(CORE_ID)}
            title="Kết quả tổng hợp"
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-20 w-20 items-center justify-center rounded-full text-white border-2 border-red-300 shadow-[0_0_36px_10px_rgba(158,11,16,0.55)] ${
              activeNode === CORE_ID ? 'outline outline-2 outline-offset-2 outline-white/70' : ''
            }`}
            style={SUN_SPHERE_STYLE}
          >
            <Cpu size={26} className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
          </button>
        </div>

        <p className="relative mt-4 text-center text-[10px] font-medium text-white/40">
          Bấm vào một trạm gác để xem chi tiết & đường liên kết tới Kết quả tổng hợp
        </p>
      </div>

      {/* Selected Node Details */}
      <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200/80 p-3.5">
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
