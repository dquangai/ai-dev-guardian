import {
  Activity,
  AlertTriangle,
  ClipboardCheck,
  FilePlus2,
  FileText,
  GitBranch,
  LayoutDashboard,
  Settings,
  Shield,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useApi } from '../../lib/useApi'
import type { SystemDiagnostics } from '../../lib/types'
import { useAuth } from '../../context/AuthContext'
import { NAV_BY_ROLE, type NavItem } from '../../lib/navigation'
import { engineLabel } from '../../lib/engineLabel'

const ICONS: Record<NavItem['icon'], React.ReactNode> = {
  overview: <LayoutDashboard size={18} />,
  findings: <AlertTriangle size={18} />,
  policies: <FileText size={18} />,
  'propose-policy': <FilePlus2 size={18} />,
  'policy-approvals': <ClipboardCheck size={18} />,
  'bypass-approvals': <ShieldQuestion size={18} />,
  'code-audit': <Shield size={18} />,
  diagnostics: <Activity size={18} />,
  'engine-config': <Settings size={18} />,
}

export function Sidebar() {
  const { user } = useAuth()
  const items = user ? NAV_BY_ROLE[user.role] : []
  const hasItem = (to: string) => items.some((i) => i.to === to)

  const { data: diagnostics } = useApi<SystemDiagnostics>('/system/diagnostics')
  const { data: policies } = useApi<{ length: number }[]>('/policies', [], { enabled: hasItem('/policies') })
  const { data: history } = useApi<{ verdict: string }[]>('/audit/history', [], {
    enabled: hasItem('/findings'),
  })
  const { data: policyRequests } = useApi<{ length: number }[]>('/policies/requests?status=pending', [], {
    enabled: hasItem('/policy-approvals'),
  })
  const { data: bypassRequests } = useApi<{ length: number }[]>('/bypass-requests?status=pending', [], {
    enabled: hasItem('/bypass-approvals'),
  })

  const badgeFor = (to: string): number | undefined => {
    if (to === '/findings') return history?.filter((r) => r.verdict === 'BLOCK').length
    if (to === '/policies') return policies?.length
    if (to === '/policy-approvals') return policyRequests?.length
    if (to === '/bypass-approvals') return bypassRequests?.length
    return undefined
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-slate-200/80 bg-white shadow-[2px_0_15px_rgba(0,0,0,0.02)]">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl red-gradient text-white shadow-[0_4px_12px_rgba(158,11,16,0.3)]">
          <ShieldCheck size={22} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-extrabold tracking-tight text-slate-900">AI Dev Guardian</span>
            <span className="rounded-md bg-red-50 border border-red-100 px-1.5 py-0.5 text-[10px] font-bold text-[#9E0B10]">
              v0.1
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-500">Vingroup AI Security</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1.5 px-3.5 py-4">
        {items.map((item) => {
          const badge = badgeFor(item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold ${
                  isActive
                    ? 'bg-red-50/80 text-[#9E0B10] border-l-4 border-[#9E0B10] shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="flex items-center gap-3">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        isActive
                          ? 'bg-[#9E0B10] text-white shadow-sm'
                          : 'bg-slate-100 text-slate-500 group-hover:bg-red-50 group-hover:text-[#9E0B10]'
                      }`}
                    >
                      {ICONS[item.icon]}
                    </span>
                    {item.label}
                  </span>
                  {badge !== undefined && badge > 0 && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        isActive
                          ? 'bg-[#9E0B10] text-white'
                          : 'bg-red-100/70 text-[#9E0B10]'
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="m-4 space-y-3 rounded-2xl bg-slate-50/80 border border-slate-200/80 p-4 text-xs font-medium">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-slate-600">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-100 text-amber-700">
              <Sparkles size={12} />
            </span>
            AI Engine
          </span>
          <span className="font-bold text-slate-900">{engineLabel(diagnostics?.llm)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-slate-600">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-cyan-100 text-cyan-700">
              <GitBranch size={12} />
            </span>
            Git Branch
          </span>
          <span className="font-mono font-bold text-slate-900">{diagnostics?.gitBranch ?? 'master'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100" /> Gate Guard
          </span>
          <span className="font-bold tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
            {diagnostics?.gateGuardActive ? 'ACTIVE' : 'INACTIVE'}
          </span>
        </div>
      </div>
    </aside>
  )
}
