import type { Role } from './rbac'

export interface NavItem {
  to: string
  label: string
  /** Distinct icon key from Sidebar's icon map — kept as a string so this file has no JSX/React import. */
  icon:
    | 'overview'
    | 'findings'
    | 'policies'
    | 'propose-policy'
    | 'policy-approvals'
    | 'bypass-approvals'
    | 'code-audit'
    | 'diagnostics'
    | 'engine-config'
    | 'teams'
}

/**
 * Sidebar contents AND route access are both driven from this single per-role list — a role only
 * ever sees the pages it's allowed into, and ProtectedRoute checks the same list (via
 * pageAllowedForRole) so there's no gap between what's linked and what's reachable by URL.
 */
/** T-24: shown to Super Admin only once they've picked an active team via the Header switcher
 * (see AuthContext's actAsTeam) — the same 3 pages a real admin of that team would see. Kept as a
 * short, explicit subset rather than reusing NAV_BY_ROLE.admin wholesale, matching exactly what
 * was scoped for this task (not policy-approvals/bypass-approvals/diagnostics/engine-config). */
const SUPER_ADMIN_TEAM_CONTEXT_NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: 'overview' },
  { to: '/findings', label: 'Findings', icon: 'findings' },
  { to: '/policies', label: 'Policies', icon: 'policies' },
]

const TEAM_MANAGEMENT_NAV: NavItem = { to: '/teams', label: 'Team Management', icon: 'teams' }

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  // T-23/T-24: super-admin is org-wide (no single team) until they act as one — see
  // navItemsFor() below, which is what callers should actually use (this raw table only covers
  // the "no team selected" case for super-admin).
  'super-admin': [TEAM_MANAGEMENT_NAV],
  admin: [
    { to: '/', label: 'Overview', icon: 'overview' },
    { to: '/findings', label: 'Findings', icon: 'findings' },
    { to: '/policies', label: 'Policies', icon: 'policies' },
    { to: '/policy-approvals', label: 'Policy Approvals Hub', icon: 'policy-approvals' },
    { to: '/bypass-approvals', label: 'Bypass Approvals Hub', icon: 'bypass-approvals' },
    { to: '/diagnostics', label: 'System Diagnostics', icon: 'diagnostics' },
    { to: '/engine-config', label: 'AI Engine Config', icon: 'engine-config' },
  ],
  'senior-dev': [
    { to: '/', label: 'Overview', icon: 'overview' },
    { to: '/findings', label: 'Findings', icon: 'findings' },
    { to: '/policies', label: 'Active Policies', icon: 'policies' },
    { to: '/policies/propose', label: 'Propose New Policy', icon: 'propose-policy' },
    { to: '/policy-approvals', label: 'Policy Approvals Hub', icon: 'policy-approvals' },
    { to: '/bypass-approvals', label: 'Bypass Approvals Hub', icon: 'bypass-approvals' },
    { to: '/diagnostics', label: 'System Diagnostics', icon: 'diagnostics' },
  ],
  developer: [
    { to: '/', label: 'Overview', icon: 'overview' },
    { to: '/findings', label: 'My Findings', icon: 'findings' },
    { to: '/policies', label: 'Active Policies', icon: 'policies' },
    { to: '/code-audit', label: 'Code Audit', icon: 'code-audit' },
  ],
  auditor: [
    { to: '/', label: 'Overview', icon: 'overview' },
    { to: '/findings', label: 'Findings', icon: 'findings' },
    { to: '/policies', label: 'Active Policies', icon: 'policies' },
    { to: '/diagnostics', label: 'System Diagnostics', icon: 'diagnostics' },
    { to: '/engine-config', label: 'AI Engine Config', icon: 'engine-config' },
  ],
}

/** The single source of truth for what's in the sidebar / reachable by URL — accounts for
 * super-admin's team context (T-24), which the plain per-role table above can't express. */
export function navItemsFor(role: Role, teamId?: string): NavItem[] {
  if (role !== 'super-admin') return NAV_BY_ROLE[role]
  return teamId ? [...SUPER_ADMIN_TEAM_CONTEXT_NAV, TEAM_MANAGEMENT_NAV] : [TEAM_MANAGEMENT_NAV]
}

export function pageAllowedForRole(role: Role, pathname: string, teamId?: string): boolean {
  return navItemsFor(role, teamId).some((item) => item.to === pathname)
}

export function defaultRouteForRole(role: Role, teamId?: string): string {
  return navItemsFor(role, teamId)[0]?.to ?? '/login'
}
