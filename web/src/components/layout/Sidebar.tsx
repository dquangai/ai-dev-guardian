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

  const { data: diagnostics } = useApi<SystemDiagnostics>('/system/diagnostics', [], {
    enabled: !(user?.role === 'super-admin' && !user?.teamId),
  })
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
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* Sidebar Header - VinSmart Future Brand restored & expanded to h-20 */}
      <div className="flex h-20 items-center border-b border-slate-200 px-6 shrink-0">
        <div className="flex items-center gap-3">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M6 6L16 26L26 6H20L16 16L12 6H6Z" fill="#9E0B10" />
            <path fillRule="evenodd" clipRule="evenodd" d="M12 6L16 14L20 6H24L16 22L8 6H6Z" fill="#D32F2F" />
          </svg>
          <div className="leading-none">
            <p className="text-base font-black tracking-wider text-[#9E0B10]">VINSMART</p>
            <p className="text-[11px] font-extrabold tracking-widest text-[#9E0B10]/90 mt-0.5">FUTURE</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 py-4 px-0">
        {items.map((item) => {
          const badge = badgeFor(item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={true}
              className={({ isActive }) =>
                `flex items-center justify-between py-3.5 px-6 text-sm font-bold ${
                  isActive
                    ? 'bg-red-50/80 text-[#9E0B10] border-l-4 border-[#9E0B10]'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 border-l-4 border-transparent'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span>{item.label}</span>
                  {badge !== undefined && badge > 0 && (
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-bold ${
                        isActive ? 'bg-[#9E0B10] text-white' : 'bg-red-100 text-[#9E0B10]'
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

      {/* Bottom System Status Box */}
      <div className="m-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">System Status</p>
        <div className="space-y-2.5">
          <div>
            <span className="text-slate-500 font-medium">AI Engine</span>
            <p className="font-bold text-slate-900 text-xs mt-0.5">{engineLabel(diagnostics?.llm)}</p>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200/80 pt-2">
            <span className="text-slate-500 font-medium">Git Branch</span>
            <span className="font-mono font-bold text-slate-900">{diagnostics?.gitBranch ?? 'master'}</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200/80 pt-2">
            <span className="text-slate-500 font-medium">Gate Guard</span>
            <span className="font-bold text-slate-800">
              {diagnostics?.gateGuardActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  )
}
