import { LogOut, RefreshCw, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useApi } from '../../lib/useApi'
import type { SystemDiagnostics } from '../../lib/types'
import { StatusPill, type PillVariant } from '../ui/StatusPill'
import type { Role } from '../../lib/rbac'
import { engineLabel } from '../../lib/engineLabel'
import { NotificationBell } from './NotificationBell'
import { TeamSwitcher } from './TeamSwitcher'

const ROLE_PILL: Record<Role, PillVariant> = {
  admin: 'red',
  'super-admin': 'red',
  'senior-dev': 'blue',
  developer: 'amber',
  auditor: 'gray',
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function Header({ title, onRefresh }: { title: string; onRefresh?: () => void }) {
  const { user, roleLabel, logout } = useAuth()
  const navigate = useNavigate()
  // T-26: Super Admin with no active team context can't satisfy the team-scoped `member` relation
  // this endpoint requires — skip the call rather than let it 403 on every page load.
  const { data: diagnostics } = useApi<SystemDiagnostics>('/system/diagnostics', [], {
    enabled: !(user?.role === 'super-admin' && !user?.teamId),
  })

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="flex h-20 items-center justify-between border-b border-slate-200/80 bg-white px-8 shrink-0 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        <span className="flex items-center gap-2 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-bold text-[#9E0B10]">
          <span className="h-2 w-2 rounded-full bg-[#9E0B10] ring-4 ring-red-100 animate-pulse" />
          Vingroup AI Guard
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-full bg-red-50/70 border border-red-100 px-3.5 py-1.5 text-xs font-semibold text-[#9E0B10] md:flex">
          <Sparkles size={14} className="text-[#9E0B10]" />
          Powered by <span className="font-extrabold">{engineLabel(diagnostics?.llm)}</span>
        </div>
        <button
          onClick={onRefresh}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-red-50 hover:text-[#9E0B10] hover:border-red-200"
          title="Refresh"
        >
          <RefreshCw size={15} />
        </button>

        {user?.role === 'super-admin' && <TeamSwitcher />}
        {user && <NotificationBell />}

        {user && (
          <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl red-gradient text-xs font-extrabold text-white shadow-[0_4px_12px_rgba(158,11,16,0.3)] border border-red-400/30">
              {initials(user.name)}
            </div>
            <div className="hidden text-left leading-tight sm:block">
              <div className="text-sm font-bold text-slate-900">{user.name}</div>
              {roleLabel && (
                <StatusPill variant={ROLE_PILL[user.role]}>{roleLabel}</StatusPill>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-[#9E0B10]"
              title="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
