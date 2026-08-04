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
}

/**
 * Sidebar contents AND route access are both driven from this single per-role list — a role only
 * ever sees the pages it's allowed into, and ProtectedRoute checks the same list (via
 * pageAllowedForRole) so there's no gap between what's linked and what's reachable by URL.
 */
export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
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

export function pageAllowedForRole(role: Role, pathname: string): boolean {
  return NAV_BY_ROLE[role].some((item) => item.to === pathname)
}

export function defaultRouteForRole(role: Role): string {
  return NAV_BY_ROLE[role][0]?.to ?? '/login'
}
