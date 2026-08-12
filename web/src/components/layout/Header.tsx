import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useApi } from '../../lib/useApi'
import type { SystemDiagnostics } from '../../lib/types'
import { engineLabel } from '../../lib/engineLabel'
import { TeamSwitcher } from './TeamSwitcher'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  const first = parts[0][0]
  const last = parts[parts.length - 1][0]
  return (parts.length === 1 ? first : first + last).toUpperCase()
}

export function Header({ title }: { title: string; onRefresh?: () => void }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { data: diagnostics } = useApi<SystemDiagnostics>('/system/diagnostics', [], {
    enabled: !(user?.role === 'super-admin' && !user?.teamId),
  })

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const engineText = engineLabel(diagnostics?.llm)

  return (
    <header className="relative z-40 flex h-20 items-center justify-between border-b border-slate-200 bg-white px-8 shrink-0">
      {/* Left: Expanded Title & Corporate Brand Capsule */}
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">{title}</h1>
        <span className="inline-flex items-center gap-2 rounded-full bg-red-50 border border-red-200 px-4 py-1.5 text-xs font-bold text-[#9E0B10]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#9E0B10]" />
          Vingroup AI Guard
        </span>
      </div>

      {/* Right: Engine Chip, Team Switcher, User Profile */}
      <div className="flex items-center gap-5 text-sm">
        {/* AI Engine Capsule */}
        <div className="hidden lg:flex items-center gap-2.5 rounded-full bg-slate-100 px-4 py-2 text-xs text-slate-600 font-medium">
          <span className="text-slate-400 font-normal">AI Engine:</span>
          <span className="font-bold text-slate-900">{engineText}</span>
        </div>

        {/* Team Context Switcher */}
        {user?.role === 'super-admin' && <TeamSwitcher />}

        {/* User Profile Card & Static Logout Button */}
        {user && (
          <div className="flex items-center gap-4 border-l border-slate-200 pl-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-[#9E0B10] text-sm font-black ring-2 ring-red-200">
                {initials(user.name)}
              </span>
              <div className="hidden sm:block leading-tight">
                <div className="text-sm font-bold text-slate-900">{user.name}</div>
                <div className="text-[10px] font-black uppercase tracking-wider text-[#9E0B10]">
                  {user.role === 'super-admin' ? 'SUPER ADMIN' : user.role}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="rounded-xl bg-red-50 text-[#9E0B10] hover:bg-[#9E0B10] hover:text-white px-4 py-2 text-xs font-bold cursor-pointer border-0"
            >
              Đăng xuất
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
