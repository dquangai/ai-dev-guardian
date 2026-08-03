import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { hasPermission, ROLE_LABELS, type Permission, type Role } from '../lib/rbac'
import { setApiIdentity } from '../lib/api'

const STORAGE_KEY = 'guardian.role'

interface RoleContextValue {
  role: Role
  label: string
  userId: string
  setRole: (role: Role) => void
  can: (permission: Permission) => boolean
}

const RoleContext = createContext<RoleContextValue | null>(null)

function readStoredRole(): Role {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'admin' || stored === 'senior-dev' || stored === 'developer' || stored === 'auditor'
    ? stored
    : 'admin'
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(readStoredRole)
  const userId = `${role}@local`

  useEffect(() => {
    setApiIdentity(role, userId)
    localStorage.setItem(STORAGE_KEY, role)
  }, [role, userId])

  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      label: ROLE_LABELS[role],
      userId,
      setRole: setRoleState,
      can: (permission) => hasPermission(role, permission),
    }),
    [role, userId]
  )

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error('useRole must be used within a RoleProvider')
  return ctx
}
