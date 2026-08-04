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
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#9E0B10]/5 border border-[#9E0B10]/10">
          <ShieldCheck className="text-[#9E0B10]" size={22} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-gray-900">AI Dev Guardian</span>
            <span className="rounded-md bg-[#9E0B10]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#9E0B10]">
              v0.1
            </span>
          </div>
          <p className="text-xs text-gray-500">Vingroup AI Security</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {items.map((item) => {
          const badge = badgeFor(item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-[#9E0B10]/5 text-[#9E0B10] border border-[#9E0B10]/10' 
                    : 'text-gray-600 hover:bg-gray-50 border border-transparent'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="flex items-center gap-3">
                    <span className={isActive ? 'text-[#9E0B10]' : 'text-gray-400'}>{ICONS[item.icon]}</span>
                    {item.label}
                  </span>
                  {badge !== undefined && badge > 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        isActive ? 'bg-[#9E0B10]/10 text-[#9E0B10]' : 'bg-[#9E0B10]/5 text-[#9E0B10]'
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

      <div className="m-3 space-y-3 rounded-xl bg-gray-50 p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-gray-500">
            <Sparkles size={14} className="text-amber-500" /> AI Engine
          </span>
          <span className="font-semibold text-gray-900">Gemini 3.5 Flash</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-gray-500">
            <GitBranch size={14} /> Git Branch
          </span>
          <span className="font-semibold text-gray-900">{diagnostics?.gitBranch ?? 'unknown'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-gray-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Gate Guard
          </span>
          <span className="font-semibold text-emerald-600">
            {diagnostics?.gateGuardActive ? 'ACTIVE' : 'INACTIVE'}
          </span>
        </div>
      </div>
    </aside>
  )
}
