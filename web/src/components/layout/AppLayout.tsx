import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useAuth } from '../../context/AuthContext'
import { NAV_BY_ROLE } from '../../lib/navigation'

const FALLBACK_TITLES: Record<string, string> = {
  '/': 'Executive Dashboard',
  '/code-audit': 'Code Audit',
  '/findings': 'Findings',
  '/policies': 'Policy Management',
  '/audit-history': 'Audit History',
  '/audit-cache': 'Audit Cache',
  '/diagnostics': 'System Diagnostics',
  '/engine-config': 'AI Engine Config',
}

export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()

  // Header title follows the role's own nav label (e.g. "My Findings" for a developer)
  // rather than a fixed page name, so it doesn't contradict what the sidebar just called it.
  const roleNavItem = user ? NAV_BY_ROLE[user.role].find((item) => item.to === location.pathname) : undefined
  const title = roleNavItem?.label ?? FALLBACK_TITLES[location.pathname] ?? 'AI Dev Guardian'

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={title} onRefresh={() => navigate(0)} />
        <main className="flex-1 overflow-y-auto px-8 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
