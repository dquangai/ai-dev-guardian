import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, Briefcase, Eye, EyeOff, LayoutGrid, Lock, Mail } from 'lucide-react'
import { DemoModeSelector } from '../components/auth/DemoModeSelector'
import { LoginHero } from '../components/auth/LoginHero'
import { TechButton } from '../components/ui/TechButton'
import { useAuth } from '../context/AuthContext'
import { defaultRouteForRole, pageAllowedForRole } from '../lib/navigation'

/** Every demo account (original 5 + anyone added for a team) shares this one login value — see
 * GUARDIAN_DEMO_PASSWORD server-side (users.ts checkPassword). Not a real secret: it's the same
 * publicly-documented value shown to any visitor on the NoteBook "Tài khoản Demo" tab, so this
 * constant only needs to match it for the demo-picker autofill below — never used for real auth. */
const DEMO_LOGIN_VALUE = 'demo1234'

export function Login() {
  const { user, loginWithCredentials } = useAuth()
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
    const target =
      from && pageAllowedForRole(user.role, from, user.teamId) ? from : defaultRouteForRole(user.role, user.teamId)
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

  function handleSelectDemoUser(userEmail: string) {
    setEmail(userEmail)
    setPassword(DEMO_LOGIN_VALUE)
    setError(null)
  }

  return (
    <div className="flex min-h-screen bg-[#FAFAFA] font-sans antialiased selection:bg-[#9E0B10] selection:text-white">
      <LoginHero />

      {/* Right Form Panel with Soft Red Dot Matrix Background */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-[#FAFAFA] bg-[radial-gradient(rgba(158,11,16,0.15)_1.2px,transparent_1.2px)] [background-size:24px_24px] px-6 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_40px_rgba(158,11,16,0.06)]">
            {/* Logo, Headline & NoteBook Button */}
            <div className="mb-6 flex items-start justify-between border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">Đăng nhập hệ thống</h2>
                <p className="mt-1 text-xs text-gray-500">Cổng xác thực dự án AI Dev Guardian</p>
              </div>

              <button
                type="button"
                onClick={() => navigate('/notebook')}
                title="Xem sổ tay hướng dẫn sử dụng hệ thống"
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/60 px-3 py-1.5 text-xs font-semibold text-[#9E0B10] hover:bg-[#9E0B10] hover:text-white transition-all cursor-pointer shadow-2xs group shrink-0"
              >
                <BookOpen size={14} className="text-[#9E0B10] group-hover:text-white transition-colors" />
                <span className="font-mono font-bold tracking-tight">NoteBook</span>
              </button>
            </div>

            {/* Login Tabs with Icons */}
            <div className="mb-6 flex items-center border-b border-gray-200 text-sm">
              <button
                type="button"
                className="flex items-center gap-2 border-b-2 border-[#9E0B10] px-3 pb-2.5 text-sm font-semibold text-[#9E0B10] cursor-pointer bg-transparent border-t-0 border-x-0"
              >
                <Briefcase size={16} className="text-[#9E0B10]" />
                <span>Email doanh nghiệp</span>
              </button>

              <button
                type="button"
                disabled
                title="Microsoft Single Sign-On (chưa kết nối)"
                className="ml-4 flex items-center gap-2 px-3 pb-2.5 text-sm font-medium text-slate-400 cursor-not-allowed bg-transparent border-0"
              >
                <LayoutGrid size={16} className="text-slate-400" />
                <span>Microsoft 365</span>
              </button>
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

              <TechButton
                type="submit"
                disabled={submitting}
                fullWidth
                size="lg"
              >
                {submitting ? 'ĐANG XÁC THỰC…' : 'ĐĂNG NHẬP'}
              </TechButton>
            </form>

            <div className="my-6 flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              <div className="h-px flex-1 bg-gray-200" />
              HOẶC
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <button
              type="button"
              disabled
              title="Microsoft Single Sign-On (chưa kết nối)"
              className="flex w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-xl border border-gray-300/80 bg-white py-2.5 text-sm font-semibold text-gray-700 shadow-xs opacity-90"
            >
              <svg className="h-4.5 w-4.5 shrink-0" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="10" height="10" fill="#F25022" />
                <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
                <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
                <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
              </svg>
              <span>Continue with Microsoft</span>
            </button>
          </div>
        </div>

        {/* Demo Mode Container */}
        <div className="w-full max-w-md">
          <DemoModeSelector onSelectUser={handleSelectDemoUser} disabled={submitting} />
        </div>

        <p className="text-center text-[10px] font-medium tracking-wide text-gray-400">
          © 2026 AI Dev Guardian · Quy định bảo mật · Điều khoản sử dụng
        </p>
      </div>
    </div>
  )
}
