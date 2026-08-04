import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { hasPermission, ROLE_LABELS, type Permission, type Role } from '../lib/rbac'
import { ApiError, api, setAuthToken, setUnauthorizedHandler } from '../lib/api'

const TOKEN_KEY = 'guardian.token'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: Role
}

interface MeResponse extends AuthUser {
  label: string
  permissions: Permission[]
}

interface LoginResponse {
  token: string
  user: MeResponse
}

interface AuthContextValue {
  user: AuthUser | null
  roleLabel: string | null
  /** False until the stored token (if any) has been checked against the server — consumers
   * (ProtectedRoute) must wait for this before deciding to redirect to /login, since the check
   * is now a network round-trip rather than a synchronous localStorage read. */
  ready: boolean
  loginWithCredentials: (email: string, password: string, remember: boolean) => Promise<boolean>
  loginAsDemo: (role: Role) => Promise<void>
  logout: () => void
  can: (permission: Permission) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)
}

function persistToken(token: string, remember: boolean): void {
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token)
    sessionStorage.removeItem(TOKEN_KEY)
  } else {
    sessionStorage.setItem(TOKEN_KEY, token)
    localStorage.removeItem(TOKEN_KEY)
  }
}

function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
}

function toAuthUser(me: MeResponse): AuthUser {
  return { id: me.id, name: me.name, email: me.email, role: me.role }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)

  function logout(): void {
    clearStoredToken()
    setAuthToken(null)
    setUser(null)
  }

  // Registered once: a 401 from any request (expired/invalid/revoked token) forces logout
  // instead of leaving the app in a half-authenticated state.
  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    const token = readStoredToken()
    if (!token) {
      setReady(true)
      return
    }
    setAuthToken(token)
    api
      .get<MeResponse>('/me')
      .then((me) => setUser(toAuthUser(me)))
      .catch(() => {
        clearStoredToken()
        setAuthToken(null)
      })
      .finally(() => setReady(true))
  }, [])

  async function loginWithCredentials(email: string, password: string, remember: boolean): Promise<boolean> {
    try {
      const res = await api.post<LoginResponse>('/auth/login', { email, password, rememberMe: remember })
      persistToken(res.token, remember)
      setAuthToken(res.token)
      setUser(toAuthUser(res.user))
      return true
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return false
      throw error
    }
  }

  async function loginAsDemo(role: Role): Promise<void> {
    const res = await api.post<LoginResponse>('/auth/demo-login', { role })
    persistToken(res.token, true)
    setAuthToken(res.token)
    setUser(toAuthUser(res.user))
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      roleLabel: user ? ROLE_LABELS[user.role] : null,
      ready,
      loginWithCredentials,
      loginAsDemo,
      logout,
      can: (permission) => (user ? hasPermission(user.role, permission) : false),
    }),
    [user, ready]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
