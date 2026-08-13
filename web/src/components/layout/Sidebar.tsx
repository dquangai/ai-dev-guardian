import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useApi } from '../../lib/useApi'
import { navItemsFor } from '../../lib/navigation'
import { QwoangLogo } from '../ui/QwoangLogo'

function formatRole(role: string): string {
  switch (role) {
    case 'super-admin':
      return 'Super Admin'
    case 'senior-dev':
      return 'Senior Dev'
    case 'admin':
      return 'Admin'
    case 'developer':
      return 'Developer'
    case 'auditor':
      return 'Auditor'
    default:
      return role
  }
}

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'U'
  const first = parts[0][0]
  const last = parts[parts.length - 1][0]
  return (parts.length === 1 ? first : first + last).toUpperCase()
}

export function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const items = user ? navItemsFor(user.role, user.teamId) : []
  const hasItem = (to: string) => items.some((i) => i.to === to)

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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const badgeFor = (to: string): number | undefined => {
    if (to === '/findings') return history?.filter((r) => r.verdict === 'BLOCK').length
    if (to === '/policies') return policies?.length
    if (to === '/policy-approvals') return policyRequests?.length
    if (to === '/bypass-approvals') return bypassRequests?.length
    return undefined
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* Sidebar Header - QWOANG Brand */}
      <div className="flex h-20 items-center border-b border-slate-200 px-6 shrink-0">
        <QwoangLogo size="md" showSub={true} subText="AI GUARDIAN" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 py-4 px-0 overflow-y-auto">
        {items.map((item) => {
          const badge = badgeFor(item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={true}
              className={({ isActive }) =>
                `flex items-center justify-between py-3 px-6 text-xs font-semibold ${
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
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
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

      {/* Bottom User Profile Card */}
      {user && (
        <div ref={menuRef} className="p-4 border-t border-slate-200/80 relative">
          {/* Popover Dropdown for Logout */}
          {userMenuOpen && (
            <div className="absolute bottom-full left-4 right-4 mb-2 z-50 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/10 text-xs space-y-2">
              <div className="px-2 py-1.5 border-b border-slate-100">
                <p className="font-semibold text-slate-900 text-sm truncate">{user.name}</p>
                <p className="text-slate-500 font-mono text-[11px] truncate mt-0.5">{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#9E0B10] hover:bg-red-50 cursor-pointer border-0 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Đăng xuất
              </button>
            </div>
          )}

          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 hover:bg-slate-50 transition-colors cursor-pointer text-left shadow-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#B40000] text-white text-xs font-bold shadow-xs">
                {userInitials(user.name)}
              </span>
              <div className="min-w-0 leading-tight">
                <div className="text-sm font-semibold text-slate-900 truncate">{user.name}</div>
                <div className="text-xs text-slate-500 font-medium truncate mt-0.5">
                  {formatRole(user.role)}
                </div>
              </div>
            </div>
            <svg
              className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}
    </aside>
  )
}
