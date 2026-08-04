import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react'
import { DemoModeSelector } from '../components/auth/DemoModeSelector'
import { LoginHero } from '../components/auth/LoginHero'
import { useAuth } from '../context/AuthContext'
import { defaultRouteForRole, pageAllowedForRole } from '../lib/navigation'
import type { Role } from '../lib/rbac'

export function Login() {
  const { user, loginWithCredentials, loginAsDemo } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      if (!ok) setError('Sai email hoặc mật khẩu — Vui lòng thử lại hoặc chọn vai trò Demo bên dưới.')
    } catch {
      setError('Không thể kết nối đến máy chủ — Vui lòng thử lại sau.')
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
      setError('Không thể kết nối đến máy chủ — Vui lòng thử lại sau.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-[#FAFAFA] font-sans antialiased selection:bg-[#9E0B10] selection:text-white">
      <LoginHero />

      {/* Right Form Panel */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-[#FAFAFA] bg-[radial-gradient(#e5e7eb_1.2px,transparent_1.2px)] [background-size:24px_24px] px-6 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_40px_rgba(158,11,16,0.06)]">
            {/* Logo & Headline */}
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#9E0B10]/5 border border-[#9E0B10]/15 shadow-sm">
                <ShieldCheck className="text-[#9E0B10]" size={26} />
              </div>
              <h2 className="mt-4 text-xl font-bold text-gray-900 tracking-tight">Đăng nhập hệ thống</h2>
              <p className="mt-1.5 text-xs text-gray-500">Cổng xác thực dự án AI Dev Guardian</p>
            </div>

            {/* Login Tabs */}
            <div className="mb-6 flex border-b border-gray-200 text-sm">
              <span className="border-b-2 border-[#9E0B10] px-2 pb-2.5 font-semibold text-[#9E0B10] cursor-pointer">
                Email doanh nghiệp
              </span>
              <span
                title="Azua ID single sign-on chưa kết nối"
                className="ml-6 cursor-not-allowed px-2 pb-2.5 text-gray-300 font-medium"
              >
                Azua ID
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Email công việc</label>
                <div className="relative mt-1.5">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@guardian.dev"
                    className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm text-gray-800 placeholder-gray-400 focus:border-[#9E0B10] focus:outline-none focus:ring-2 focus:ring-red-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Mật khẩu</label>
                <div className="relative mt-1.5">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-10 text-sm text-gray-800 placeholder-gray-400 focus:border-[#9E0B10] focus:outline-none focus:ring-2 focus:ring-red-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-1">
                <label className="flex items-center gap-2.5 text-xs text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="rounded border-gray-300 text-[#9E0B10] focus:ring-[#9E0B10]"
                  />
                  Ghi nhớ đăng nhập
                </label>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-100 p-2.5 text-xs text-[#9E0B10] leading-relaxed">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-[#9E0B10] py-2.5 text-sm font-semibold text-white shadow-md shadow-red-950/10 hover:bg-[#80070B] disabled:opacity-60 disabled:pointer-events-none"
              >
                {submitting ? 'Đang xác thực…' : 'Đăng nhập'}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              <div className="h-px flex-1 bg-gray-200" />
              HOẶC
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <button
              type="button"
              disabled
              title="Azua ID single sign-on chưa kết nối"
              className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50/20 py-2.5 text-sm font-semibold text-[#9E0B10]/60"
            >
              <ShieldCheck size={16} />
              Đăng nhập qua Azua ID
            </button>
          </div>
        </div>

        {/* Demo Mode Container */}
        <div className="w-full max-w-md">
          <DemoModeSelector onSelectRole={handleDemoLogin} disabled={submitting} />
        </div>

        <p className="text-center text-[10px] font-medium tracking-wide text-gray-400">
          © 2026 AI Dev Guardian · Quy định bảo mật · Điều khoản sử dụng
        </p>
      </div>
    </div>
  )
}
