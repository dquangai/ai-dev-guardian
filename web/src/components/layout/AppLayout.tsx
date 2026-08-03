import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

const TITLES: Record<string, string> = {
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
  const title = TITLES[location.pathname] ?? 'AI Dev Guardian'

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
