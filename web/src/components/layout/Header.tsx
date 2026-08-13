import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  ChevronDown,
  LogOut,
  Monitor,
  Moon,
  Sun,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useApi } from '../../lib/useApi'
import { navItemsFor } from '../../lib/navigation'
import { TeamSwitcher } from './TeamSwitcher'
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

export function Header({ title }: { title: string; onRefresh?: () => void }) {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Dynamic Navigation Items based on User Role & Permissions
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
    if (to === '/policies') return policies?.length || 11
    if (to === '/policy-approvals') return policyRequests?.length
    if (to === '/bypass-approvals') return bypassRequests?.length
    return undefined
  }

  return (
    <header className="relative z-40 flex h-16 items-center justify-between border-b border-[#D9D9D9] dark:border-[#27272A] bg-[#F4F5F7] dark:bg-[#09090B] px-8 font-sans text-xs shrink-0 select-none transition-colors">
      {/* Left: QWOANG Brand Logo & Navigation */}
      <div className="flex items-center gap-6 sm:gap-8 h-full min-w-0">
        {/* QWOANG Brand Logo */}
        <div
          onClick={() => navigate('/')}
          className="flex items-center cursor-pointer group pr-4 border-r border-[#D9D9D9] dark:border-[#27272A] h-7 shrink-0"
          title={`QWOANG AI Dev Guardian - ${title}`}
        >
          <QwoangLogo size="sm" showSub={true} subText="AI GUARDIAN" />
        </div>

        {/* Top Navigation Bar with Single-Line Nav Items */}
        <nav className="flex items-center gap-5 lg:gap-7 h-full min-w-0 overflow-x-auto no-scrollbar">
          {items.map((item) => {
            const isActive =
              item.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.to)
            const badge = badgeFor(item.to)

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={true}
                className={`relative flex items-center gap-2 h-full text-sm font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'text-[#111111] dark:text-[#F4F4F5] font-bold'
                    : 'text-[#555555] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-[#F4F4F5]'
                }`}
              >
                <span className="whitespace-nowrap">{item.label}</span>
                {badge !== undefined && badge > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.2 text-xs font-bold font-sans ${
                      isActive
                        ? 'bg-[#B40009] text-white shadow-2xs'
                        : 'bg-rose-100 dark:bg-rose-950/60 text-[#B40009] dark:text-rose-400'
                    }`}
                  >
                    {badge}
                  </span>
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#B40009] rounded-t-full" />
                )}
              </NavLink>
            )
          })}
        </nav>
      </div>

      {/* Right: Theme Toggle Buttons, Context Pill & User Profile */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Action Button 1: Sun / Moon Light Mode Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title="Light / Dark mode toggle"
          className="h-9 w-9 rounded-xl border border-[#D9D9D9] dark:border-[#27272A] bg-white dark:bg-[#18181B] hover:bg-[#E5E7EB] dark:hover:bg-[#27272A] flex items-center justify-center text-[#555555] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-[#F4F4F5] shadow-2xs transition-all cursor-pointer border-0"
        >
          {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        {/* Action Button 2: Monitor System Mode Toggle */}
        <button
          onClick={() => setTheme('system')}
          title="System theme"
          className={`h-9 w-9 rounded-xl border flex items-center justify-center shadow-2xs transition-all cursor-pointer border-0 ${
            theme === 'system'
              ? 'border-[#B40009]/50 bg-rose-50/50 dark:bg-rose-950/40 text-[#B40009] dark:text-rose-400 font-bold'
              : 'border-[#D9D9D9] dark:border-[#27272A] bg-white dark:bg-[#18181B] text-[#555555] dark:text-[#A1A1AA] hover:bg-[#E5E7EB] dark:hover:bg-[#27272A] hover:text-[#111111]'
          }`}
        >
          <Monitor size={16} />
        </button>

        {/* Context / Team Switcher Pill */}
        {user?.role === 'super-admin' ? (
          <TeamSwitcher />
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-[#D9D9D9] dark:border-[#27272A] bg-[#F0F4F9] dark:bg-[#18181B] px-3.5 py-1.5 text-xs shadow-2xs">
            <span className="text-[#475569] dark:text-[#94A3B8] font-normal">Context:</span>
            <span className="font-bold text-[#111111] dark:text-[#F4F4F5]">Default Team</span>
            <ChevronDown size={14} className="text-[#475569] dark:text-[#94A3B8] ml-0.5" />
          </div>
        )}

        {/* Divider */}
        <div className="h-7 border-r border-[#D9D9D9] dark:border-[#27272A] mx-1" />

        {/* User Profile Pill & Popover Menu */}
        {user && (
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2.5 rounded-xl border border-transparent p-1 transition-all cursor-pointer text-left"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#B40009] text-white text-xs font-bold shadow-2xs">
                {userInitials(user.name)}
              </span>
              <div className="hidden sm:block leading-tight">
                <div className="text-xs font-bold text-[#111111] dark:text-[#F4F4F5] max-w-[130px] truncate">
                  {user.name}
                </div>
                <div className="text-[10px] text-[#777777] dark:text-[#A1A1AA] font-medium truncate">
                  {formatRole(user.role)}
                </div>
              </div>
              <ChevronDown
                size={14}
                className={`text-[#777777] dark:text-[#71717A] shrink-0 transition-transform duration-200 ${
                  userMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Popover Dropdown Menu */}
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-2.5 z-50 w-64 rounded-[12px] border border-[#D6D6D6] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-4 shadow-2xl text-xs space-y-3.5 font-sans">
                {/* User Header Section */}
                <div className="flex items-start gap-3 pb-3 border-b border-[#E5E7EB] dark:border-[#27272A]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#111111] text-white text-sm font-bold shadow-xs font-mono">
                    {userInitials(user.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-[#111111] dark:text-[#F4F4F5] text-sm truncate leading-snug">
                      {user.name}
                    </p>
                    <p className="text-[#666666] dark:text-[#A1A1AA] font-mono text-[11px] truncate mt-0.5">
                      {user.email}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="inline-block font-mono text-[9px] bg-[#111111] text-white dark:bg-[#F4F4F5] dark:text-[#111111] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                        {formatRole(user.role)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* System Status Line */}
                <div className="flex items-center justify-between text-[10px] font-mono text-[#666666] dark:text-[#A1A1AA] bg-[#F8F9FA] dark:bg-[#27272A] px-2.5 py-1.5 rounded-[6px] border border-[#E5E5E5] dark:border-[#3F3F46]">
                  <span>ACCESS CONTROL:</span>
                  <span className="font-bold text-[#18794E] dark:text-emerald-400">ENFORCED</span>
                </div>

                {/* Logout Trigger */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center justify-between px-3 py-2 rounded-[8px] bg-[#FFF5F5] dark:bg-rose-950/40 text-[#C8102E] dark:text-rose-400 font-bold hover:bg-[#C8102E] hover:text-white dark:hover:bg-[#C8102E] dark:hover:text-white transition-all cursor-pointer border border-[#FFD1D1] dark:border-rose-900/40 group"
                >
                  <span className="font-mono text-xs uppercase tracking-wider">Đăng xuất</span>
                  <LogOut size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
