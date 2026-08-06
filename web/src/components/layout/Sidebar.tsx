import { NavLink } from 'react-router-dom'
import { useApi } from '../../lib/useApi'
import type { SystemDiagnostics } from '../../lib/types'
import { useAuth } from '../../context/AuthContext'
import { navItemsFor } from '../../lib/navigation'
import { engineLabel } from '../../lib/engineLabel'

export function Sidebar() {
  const { user } = useAuth()
  const items = user ? navItemsFor(user.role, user.teamId) : []
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
      <div className="relative flex h-20 items-center justify-center px-4 border-b border-slate-200/80 bg-white shrink-0">
        <img src="/logo.png" alt="AI Dev Guardian Logo" className="h-16 w-auto object-contain drop-shadow-md scale-150 transform origin-center" />
      </div>

      <nav className="flex-1 space-y-1.5 px-3 py-5">
        {items.map((item) => {
          const badge = badgeFor(item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={true}
              className={({ isActive }) =>
                `group flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition-colors duration-150 ${
                  isActive
                    ? 'bg-red-50/90 text-[#9E0B10] font-bold border-l-4 border-[#9E0B10] shadow-xs'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="tracking-tight">{item.label}</span>
                  {badge !== undefined && badge > 0 && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold transition-colors ${
                        isActive
                          ? 'bg-[#9E0B10] text-white shadow-sm'
                          : 'bg-red-100/80 text-[#9E0B10] group-hover:bg-red-100'
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
          <span className="text-slate-500 font-medium">AI Engine</span>
          <span className="font-bold text-slate-900">{engineLabel(diagnostics?.llm)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 font-medium">Git Branch</span>
          <span className="font-mono font-bold text-slate-900">{diagnostics?.gitBranch ?? 'master'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-slate-500 font-medium">
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
