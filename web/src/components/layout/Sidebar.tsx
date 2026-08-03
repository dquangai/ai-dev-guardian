import {
  Activity,
  AlertTriangle,
  Database,
  FileText,
  GitBranch,
  History,
  LayoutDashboard,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useApi } from '../../lib/useApi'
import type { SystemDiagnostics } from '../../lib/types'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  badge?: number
}

export function Sidebar() {
  const { data: diagnostics } = useApi<SystemDiagnostics>('/system/diagnostics')
  const { data: policies } = useApi<{ length: number }[]>('/policies')
  const { data: history } = useApi<unknown[]>('/audit/history')
  const { data: cache } = useApi<{ passedDiffHashes: string[] }>('/audit/cache')

  const openFindingsCount = Array.isArray(history)
    ? history.filter((r) => (r as { verdict?: string }).verdict === 'BLOCK').length
    : undefined

  const items: NavItem[] = [
    { to: '/', label: 'Overview', icon: <LayoutDashboard size={18} /> },
    { to: '/code-audit', label: 'Code Audit', icon: <Shield size={18} /> },
    { to: '/findings', label: 'Findings', icon: <AlertTriangle size={18} />, badge: openFindingsCount },
    { to: '/policies', label: 'Policies', icon: <FileText size={18} />, badge: policies?.length },
    {
      to: '/audit-history',
      label: 'Audit History',
      icon: <History size={18} />,
      badge: Array.isArray(history) ? history.length : undefined,
    },
    {
      to: '/audit-cache',
      label: 'Audit Cache',
      icon: <Database size={18} />,
      badge: cache?.passedDiffHashes.length,
    },
    { to: '/diagnostics', label: 'System Diagnostics', icon: <Activity size={18} /> },
    { to: '/engine-config', label: 'AI Engine Config', icon: <Settings size={18} /> },
  ]

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
          <ShieldCheck className="text-blue-600" size={22} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-gray-900">AI Dev Guardian</span>
            <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
              v0.1
            </span>
          </div>
          <p className="text-xs text-gray-500">Google Code Governance</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="flex items-center gap-3">
                  <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>{item.icon}</span>
                  {item.label}
                </span>
                {item.badge !== undefined && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="m-3 space-y-3 rounded-xl bg-gray-50 p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-gray-500">
            <Sparkles size={14} className="text-violet-500" /> AI Engine
          </span>
          <span className="font-semibold text-gray-900">Gemini 2.5 Flash</span>
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
