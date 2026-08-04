import { LogOut, RefreshCw, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { StatusPill, type PillVariant } from '../ui/StatusPill'
import type { Role } from '../../lib/rbac'

const ROLE_PILL: Record<Role, PillVariant> = {
  admin: 'blue',
  'senior-dev': 'green',
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

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-8 py-5">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 md:flex">
          <Sparkles size={14} />
          Powered by <span className="font-semibold">Google Gemini 2.5 Flash</span>
        </div>
        <button
          onClick={onRefresh}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
          title="Refresh"
        >
          <RefreshCw size={15} />
        </button>

        {user && (
          <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
              {initials(user.name)}
            </div>
            <div className="hidden text-left leading-tight sm:block">
              <div className="text-sm font-medium text-gray-900">{user.name}</div>
              {roleLabel && (
                <StatusPill variant={ROLE_PILL[user.role]}>{roleLabel}</StatusPill>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600"
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
