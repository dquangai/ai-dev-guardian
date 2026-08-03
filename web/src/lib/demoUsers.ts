import type { Role } from './rbac'

export interface DemoUser {
  id: string
  name: string
  email: string
  role: Role
}

/**
 * There is no backend user store (see RBAC section in README) — the dashboard has no server-side
 * session/password check. This directory + password only exist so the Login page can demonstrate
 * a real login form; the actual authorization boundary is still the role asserted afterward via
 * `x-guardian-role`, enforced server-side in src/server/authMiddleware.ts.
 */
export const DEMO_USERS: Record<Role, DemoUser> = {
  admin: {
    id: 'admin-1',
    name: 'Alex Morgan',
    email: 'admin@guardian.dev',
    role: 'admin',
  },
  'senior-dev': {
    id: 'senior-dev-1',
    name: 'Jordan Lee',
    email: 'senior.dev@guardian.dev',
    role: 'senior-dev',
  },
  developer: {
    id: 'developer-1',
    name: 'Sam Rivera',
    email: 'dev@guardian.dev',
    role: 'developer',
  },
  auditor: {
    id: 'auditor-1',
    name: 'Casey Nguyen',
    email: 'auditor@guardian.dev',
    role: 'auditor',
  },
}

export const DEMO_PASSWORD = 'guardian123'

export function findDemoUserByEmail(email: string): DemoUser | null {
  const normalized = email.trim().toLowerCase()
  return Object.values(DEMO_USERS).find((u) => u.email.toLowerCase() === normalized) ?? null
}
