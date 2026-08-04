import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { hasPermission, ROLES, ROLE_LABELS, type Permission, type Role } from '../lib/rbac'
import { DEMO_PASSWORD, DEMO_USERS, findDemoUserByEmail, type DemoUser } from '../lib/demoUsers'
import { setApiIdentity } from '../lib/api'

const SESSION_KEY = 'guardian.session'

export type AuthUser = DemoUser

interface AuthContextValue {
  user: AuthUser | null
  roleLabel: string | null
  /** Validates against the demo user directory — see lib/demoUsers.ts for why this is mock-only. */
  loginWithCredentials: (email: string, password: string, remember: boolean) => boolean
  loginAsDemo: (role: Role) => void
  logout: () => void
  can: (permission: Permission) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * A session persisted by an older build (e.g. a role later renamed or removed) must never reach
 * the rest of the app as a live `user` — every role-keyed lookup (NAV_BY_ROLE, ROLE_LABELS, ...)
 * assumes `Role` is exhaustive and throws on an unknown key, which would otherwise white-screen
 * the whole dashboard for anyone who logged in before a role was renamed/removed.
 */
function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as AuthUser
    if (!(ROLES as string[]).includes(parsed.role)) {
      localStorage.removeItem(SESSION_KEY)
      sessionStorage.removeItem(SESSION_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function persistUser(user: AuthUser, remember: boolean): void {
  const raw = JSON.stringify(user)
  if (remember) {
    localStorage.setItem(SESSION_KEY, raw)
    sessionStorage.removeItem(SESSION_KEY)
  } else {
    sessionStorage.setItem(SESSION_KEY, raw)
    localStorage.removeItem(SESSION_KEY)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser)

  useEffect(() => {
    if (user) setApiIdentity(user.role, user.id)
  }, [user])

  function loginWithCredentials(email: string, password: string, remember: boolean): boolean {
    if (password !== DEMO_PASSWORD) return false
    const match = findDemoUserByEmail(email)
    if (!match) return false
    persistUser(match, remember)
    setUser(match)
    return true
  }

  function loginAsDemo(role: Role): void {
    const demoUser = DEMO_USERS[role]
    persistUser(demoUser, true)
    setUser(demoUser)
  }

  function logout(): void {
    localStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SESSION_KEY)
    setUser(null)
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      roleLabel: user ? ROLE_LABELS[user.role] : null,
      loginWithCredentials,
      loginAsDemo,
      logout,
      can: (permission) => (user ? hasPermission(user.role, permission) : false),
    }),
    [user]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
