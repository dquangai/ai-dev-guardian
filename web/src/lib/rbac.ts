/**
 * Mirrors src/server/rbac.ts. Kept as a small, dependency-free duplicate here
 * (rather than importing across the web/backend boundary) so the frontend
 * bundle never reaches into Node-only backend code — this file must stay
 * pure and in sync by hand if the backend matrix changes.
 */
export type Role = 'admin' | 'senior-dev' | 'developer' | 'auditor'

export const ROLES: Role[] = ['admin', 'senior-dev', 'developer', 'auditor']

export type Permission =
  | 'policy:view'
  | 'policy:edit-direct'
  | 'policy:propose'
  | 'policy:approve'
  | 'audit:run'
  | 'audit:view'
  | 'cache:manage'
  | 'bypass:request'
  | 'bypass:approve'
  | 'engine-config:view'
  | 'engine-config:edit'

const PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'policy:view',
    'policy:edit-direct',
    'policy:approve',
    'audit:run',
    'audit:view',
    'cache:manage',
    'bypass:request',
    'bypass:approve',
    'engine-config:view',
    'engine-config:edit',
  ],
  'senior-dev': [
    'policy:view',
    'policy:propose',
    'audit:run',
    'audit:view',
    'bypass:request',
    'engine-config:view',
  ],
  developer: ['policy:view', 'audit:run', 'audit:view', 'bypass:request', 'engine-config:view'],
  auditor: ['policy:view', 'audit:view', 'bypass:approve', 'engine-config:view'],
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin / Team Lead',
  'senior-dev': 'Senior Developer',
  developer: 'Developer',
  auditor: 'Auditor',
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role]?.includes(permission) ?? false
}
