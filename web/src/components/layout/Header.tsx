import { RefreshCw, Sparkles } from 'lucide-react'
import { ROLES, ROLE_LABELS } from '../../lib/rbac'
import { useRole } from '../../context/RoleContext'

export function Header({ title, onRefresh }: { title: string; onRefresh?: () => void }) {
  const { role, setRole } = useRole()

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-8 py-5">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-3">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
          className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 focus:outline-none"
          title="Demo role switcher — simulates signing in as a different RBAC role"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
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
      </div>
    </header>
  )
}
