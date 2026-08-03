import type { Role } from './rbac'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Least-privilege placeholders until AuthContext calls setApiIdentity() after a real login —
// every route these could hit is behind ProtectedRoute, so they're never actually used to
// authorize anything; kept low-privilege anyway rather than defaulting to 'admin'.
let currentRole: Role = 'developer'
let currentUser = 'anonymous'

/** Called by AuthContext whenever the logged-in user changes. */
export function setApiIdentity(role: Role, userId: string): void {
  currentRole = role
  currentUser = userId
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-guardian-role': currentRole,
      'x-guardian-user': currentUser,
      ...init?.headers,
    },
  })

  const isJson = res.headers.get('content-type')?.includes('application/json')
  const body = isJson ? await res.json().catch(() => null) : null

  if (!res.ok) {
    throw new ApiError(res.status, body?.message ?? res.statusText)
  }
  return body as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
