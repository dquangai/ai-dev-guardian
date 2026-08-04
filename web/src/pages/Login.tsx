import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { defaultRouteForRole, pageAllowedForRole } from '../lib/navigation'
import type { Role } from '../lib/rbac'

const DEMO_BUTTONS: { role: Role; label: string; className: string }[] = [
  { role: 'admin', label: '👑 Login as ADMIN', className: 'bg-blue-600 hover:bg-blue-700' },
  {
    role: 'senior-dev',
    label: '⭐ Login as SENIOR DEV-LEAD',
    className: 'bg-emerald-600 hover:bg-emerald-700',
  },
  { role: 'developer', label: '💻 Login as DEV', className: 'bg-amber-500 hover:bg-amber-600' },
  { role: 'auditor', label: '🔍 Login as AUDITOR', className: 'bg-slate-500 hover:bg-slate-600' },
]

export function Login() {
  const { user, loginWithCredentials, loginAsDemo } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!user) return
    const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname
    const target = from && pageAllowedForRole(user.role, from) ? from : defaultRouteForRole(user.role)
    navigate(target, { replace: true })
  }, [user, location.state, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const ok = await loginWithCredentials(email, password, remember)
      if (!ok) setError('Email hoặc mật khẩu không đúng — thử một trong các nút demo bên dưới.')
    } catch {
      setError('Không kết nối được tới server — thử lại sau.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDemoLogin(role: Role) {
    setError(null)
    setSubmitting(true)
    try {
      await loginAsDemo(role)
    } catch {
      setError('Không kết nối được tới server — thử lại sau.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
            <ShieldCheck className="text-blue-600" size={26} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-lg font-semibold text-gray-900">AI Dev Guardian</span>
            <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
              v0.1
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">Google Code Governance</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase text-gray-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@guardian.dev"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-gray-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="rounded border-gray-300"
            />
            Remember me on this device
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {submitting ? 'Đang đăng nhập…' : 'Log in'}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-[11px] uppercase text-gray-400">
          <div className="h-px flex-1 bg-gray-200" />
          Or continue with a demo role
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <div className="space-y-2">
          {DEMO_BUTTONS.map((btn) => (
            <button
              key={btn.role}
              onClick={() => handleDemoLogin(btn.role)}
              disabled={submitting}
              className={`w-full rounded-full px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${btn.className}`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <p className="mt-5 text-center text-[11px] text-gray-400">
          The form above needs <code className="rounded bg-gray-100 px-1 py-0.5">GUARDIAN_DEMO_PASSWORD</code> set
          in the server's <code className="rounded bg-gray-100 px-1 py-0.5">.env</code> (see{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5">.env.example</code>) — any demo email above works with
          it. The buttons below need no password.
        </p>
      </div>
    </div>
  )
}
