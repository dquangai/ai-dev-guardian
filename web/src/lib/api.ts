export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

let currentToken: string | null = null
let onUnauthorized: (() => void) | null = null

/** Called by AuthContext after login/logout/hydration so every request carries the current
 * session token — and by AuthContext once, at startup, to learn about 401s (expired/invalid
 * token) so it can force a logout instead of the app silently misbehaving. */
export function setAuthToken(token: string | null): void {
  currentToken = token
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
      ...init?.headers,
    },
  })

  const isJson = res.headers.get('content-type')?.includes('application/json')
  const body = isJson ? await res.json().catch(() => null) : null

  if (res.status === 401) {
    onUnauthorized?.()
  }
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
