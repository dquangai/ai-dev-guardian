import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Header } from './Header'
import { useAuth } from '../../context/AuthContext'
import { navItemsFor } from '../../lib/navigation'

const FALLBACK_TITLES: Record<string, string> = {
  '/': 'Executive Dashboard',
  '/code-audit': 'Code Audit',
  '/findings': 'Findings',
  '/policies': 'Policy Management',
  '/policies/propose': 'Propose New Policy',
  '/policy-approvals': 'Policy Approvals Hub',
  '/bypass-approvals': 'Bypass Approvals Hub',
  '/diagnostics': 'System Diagnostics',
  '/engine-config': 'AI Engine Config',
  '/teams': 'Team Management',
}

export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()

  const roleNavItem = user
    ? navItemsFor(user.role, user.teamId).find((item) => item.to === location.pathname)
    : undefined
  const title = roleNavItem?.label ?? FALLBACK_TITLES[location.pathname] ?? 'AI Dev Guardian'

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#F4F5F7] dark:bg-[#09090B] text-[#111111] dark:text-[#F4F4F5] font-sans transition-colors">
      <Header title={title} onRefresh={() => navigate(0)} />
      <main className="flex-1 overflow-y-auto px-8 py-6">
        <Outlet />
      </main>
    </div>
  )
}
