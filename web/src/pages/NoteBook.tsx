import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  ExternalLink,
  FileText,
  GitPullRequest,
  Layers,
  Moon,
  Rocket,
  Shield,
  Sparkles,
  Sun,
  Terminal,
  UserCheck,
  Workflow,
  Zap,
} from 'lucide-react'
import { QwoangIcon } from '../components/ui/QwoangLogo'
import { TechGridCard } from '../components/ui/TechGridCard'
import { useTheme } from '../context/ThemeContext'

// Keypress-driven terminal walkthrough — the exact command/output format `guardian`
// prints for real, ending in the open-redirect + JWT-verification bugs Guardian has
// actually caught live in a V-ID SSO flow (see sso-redirect.policy.md /
// jwt-session-verification.policy.md). Advances one step per Enter/click, not autoplay.
type LiveStep =
  | { type: 'cmd'; text: string; gapBefore?: boolean }
  | { type: 'out'; text: string; tone?: 'dim' | 'ok' | 'err' }
  | { type: 'block-banner' }
  | { type: 'pass-banner' }
  | {
      type: 'violation'
      index: number
      level: string
      what: string
      policy: string
      why: string
      fix: string
      fixPrompt: string
    }

const VID_LIVE_STEPS: LiveStep[] = [
  { type: 'cmd', text: 'npm install -g ai-dev-guardian' },
  { type: 'out', text: 'added 47 packages in 3s', tone: 'dim' },
  { type: 'cmd', text: 'echo "ANTHROPIC_API_KEY=<your-key-here>" >> .env', gapBefore: true },
  { type: 'cmd', text: 'guardian install-hook', gapBefore: true },
  { type: 'out', text: '[guardian] Đã cài pre-push hook tại .git/hooks/pre-push', tone: 'ok' },
  { type: 'cmd', text: 'git add src/routes/sso-callback.ts src/services/session.ts', gapBefore: true },
  { type: 'cmd', text: 'git commit -m "feat(auth): finish SSO callback redirect + session verification"' },
  { type: 'out', text: '[main 9f3a21c] feat(auth): finish SSO callback redirect + session verification', tone: 'dim' },
  { type: 'out', text: ' 2 files changed, 11 insertions(+), 4 deletions(-)', tone: 'dim' },
  { type: 'cmd', text: 'git push origin main', gapBefore: true },
  { type: 'block-banner' },
  {
    type: 'violation',
    index: 1,
    level: 'CRITICAL',
    what: 'Redirect URL không được validate bằng URL parser chuẩn',
    policy: 'sso-redirect.policy.md',
    why: 'targetUrl.includes("v-id.vn") bypass được bằng hacker.com/?x=v-id.vn hoặc v-id.vn.hacker.com',
    fix: 'Parse URL thật rồi so khớp chính xác hostname, không match chuỗi con',
    fixPrompt:
      'Thay if (targetUrl.includes("v-id.vn")) bằng new URL(targetUrl).hostname === "v-id.vn", bọc try/catch để URL không hợp lệ rơi về trang mặc định.',
  },
  {
    type: 'violation',
    index: 2,
    level: 'HIGH',
    what: 'Session token được decode nhưng không xác thực chữ ký',
    policy: 'jwt-session-verification.policy.md',
    why: 'jwt.decode(token) không verify chữ ký — ai cũng tạo được token giả rồi tự set đúng iss/exp để qua check thủ công phía sau',
    fix: 'Dùng jwt.verify(token, publicKey, { algorithms: ["RS256"] }) thay vì decode(), không suy thuật toán từ header token',
    fixPrompt:
      'Thay authService.readSession dùng jwt.decode bằng jwt.verify với public key cố định + khai báo rõ algorithms; bỏ hoàn toàn nhánh decode-only.',
  },
  { type: 'out', text: "error: failed to push some refs to 'github.com:v-id/platform.git'", tone: 'err' },
  { type: 'cmd', text: 'git commit -am "fix(auth): validate redirect hostname + verify JWT signature"', gapBefore: true },
  { type: 'out', text: '[main a71cd44] fix(auth): validate redirect hostname + verify JWT signature', tone: 'dim' },
  { type: 'out', text: ' 2 files changed, 8 insertions(+), 4 deletions(-)', tone: 'dim' },
  { type: 'cmd', text: 'git push origin main' },
  { type: 'pass-banner' },
  { type: 'out', text: 'To github.com:v-id/platform.git', tone: 'dim' },
  { type: 'out', text: '   9f3a21c..a71cd44  main -> main', tone: 'dim' },
  { type: 'cmd', text: 'guardian dashboard', gapBefore: true },
  { type: 'out', text: '[guardian-server] listening on http://localhost:4000', tone: 'ok' },
]

function LiveStepLine({ step }: { step: LiveStep }) {
  const gapClass = 'gapBefore' in step && step.gapBefore ? 'mt-3' : ''

  if (step.type === 'cmd') {
    return (
      <div className={`flex items-start gap-2.5 ${gapClass}`}>
        <span className="text-[#3FB950] font-bold select-none">$</span>
        <span className="text-[#F0F6FC] font-medium">{step.text}</span>
      </div>
    )
  }

  if (step.type === 'out') {
    const toneClass =
      step.tone === 'ok' ? 'text-[#3FB950]' : step.tone === 'err' ? 'text-[#F85149]' : 'text-[#8B949E]'
    return <div className={`pl-5 ${toneClass}`}>{step.text}</div>
  }

  if (step.type === 'block-banner' || step.type === 'pass-banner') {
    const isPass = step.type === 'pass-banner'
    return (
      <div className={`my-2 rounded-lg border px-3 py-2 ${isPass ? 'border-[#3FB950]/50' : 'border-[#C8102E]/50'}`}>
        <span
          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mr-2 ${
            isPass ? 'bg-[#3FB950] text-[#06210B]' : 'bg-[#C8102E] text-white'
          }`}
        >
          {isPass ? 'PASS' : 'BLOCK'}
        </span>
        <span className="text-[#D6DCE5] text-xs">
          {isPass ? 'Không phát hiện vi phạm policy nào.' : '2 vi phạm được phát hiện trước khi push.'}
        </span>
      </div>
    )
  }

  return (
    <div className="my-2 rounded-lg border border-[#C8102E]/40 bg-[#111827] px-3 py-2.5 space-y-1.5">
      <div className="text-[10px] font-bold text-[#C8102E] font-mono">
        {step.index} · {step.level}
      </div>
      <div className="text-[#D6DCE5] text-xs">⛔ {step.what}</div>
      <div className="text-[11px] text-[#8B949E]">
        <span className="text-[#64748B]">policy </span>
        {step.policy}
      </div>
      <div className="text-[11px] text-[#8B949E]">
        <span className="text-[#64748B]">vì sao </span>
        {step.why}
      </div>
      <div className="text-[11px] text-[#8B949E]">
        <span className="text-[#64748B]">cách sửa </span>
        {step.fix}
      </div>
      <div className="mt-1.5 pl-2 border-l-2 border-[#3FB950]/60 text-[11px] text-[#3FB950]">💬 {step.fixPrompt}</div>
    </div>
  )
}

/** Automatic terminal execution simulation — types commands character-by-character
 * and streams outputs/violations with natural execution pauses and auto-looping. */
function GuardianLiveDemo({ isVi }: { isVi: boolean }) {
  const [completedSteps, setCompletedSteps] = useState<LiveStep[]>([])
  const [activeStepIdx, setActiveStepIdx] = useState(0)
  const [typedText, setTypedText] = useState('')
  const bodyRef = useRef<HTMLDivElement>(null)

  // Auto-scroll terminal body as content arrives
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [completedSteps, typedText])

  useEffect(() => {
    // End of simulation — wait 5 seconds and restart cleanly
    if (activeStepIdx >= VID_LIVE_STEPS.length) {
      const loopTimer = setTimeout(() => {
        setCompletedSteps([])
        setActiveStepIdx(0)
        setTypedText('')
      }, 5000)
      return () => clearTimeout(loopTimer)
    }

    const currentStep = VID_LIVE_STEPS[activeStepIdx]

    if (currentStep.type === 'cmd') {
      // Type command character by character with realistic speed variation
      if (typedText.length < currentStep.text.length) {
        const charTimer = setTimeout(() => {
          setTypedText(currentStep.text.slice(0, typedText.length + 1))
        }, 22 + Math.floor(Math.random() * 18))
        return () => clearTimeout(charTimer)
      } else {
        // Command text complete -> pause before executing/showing output
        const cmdPauseTimer = setTimeout(() => {
          setCompletedSteps((prev) => [...prev, currentStep])
          setTypedText('')
          setActiveStepIdx((idx) => idx + 1)
        }, 450)
        return () => clearTimeout(cmdPauseTimer)
      }
    } else if (currentStep.type === 'out') {
      // Output log streaming pause
      const outTimer = setTimeout(() => {
        setCompletedSteps((prev) => [...prev, currentStep])
        setActiveStepIdx((idx) => idx + 1)
      }, 300)
      return () => clearTimeout(outTimer)
    } else if (currentStep.type === 'block-banner' || currentStep.type === 'pass-banner') {
      // Security scan verdict pause
      const bannerTimer = setTimeout(() => {
        setCompletedSteps((prev) => [...prev, currentStep])
        setActiveStepIdx((idx) => idx + 1)
      }, 750)
      return () => clearTimeout(bannerTimer)
    } else if (currentStep.type === 'violation') {
      // Policy violation detail card pause
      const violationTimer = setTimeout(() => {
        setCompletedSteps((prev) => [...prev, currentStep])
        setActiveStepIdx((idx) => idx + 1)
      }, 850)
      return () => clearTimeout(violationTimer)
    }
  }, [activeStepIdx, typedText])

  const restart = () => {
    setCompletedSteps([])
    setActiveStepIdx(0)
    setTypedText('')
  }

  const isDone = activeStepIdx >= VID_LIVE_STEPS.length
  const currentStep = !isDone ? VID_LIVE_STEPS[activeStepIdx] : null

  return (
    <div className="rounded-2xl bg-[#0A0F1D] border border-[#1F2937] overflow-hidden shadow-2xl text-left outline-none">
      {/* Terminal Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1F2937] bg-[#0F172A]">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#FF5F56] inline-block" />
          <span className="w-3 h-3 rounded-full bg-[#FFBD2E] inline-block" />
          <span className="w-3 h-3 rounded-full bg-[#27C93F] inline-block" />
          <span className="ml-3 text-xs font-mono text-[#94A3B8] flex items-center gap-1.5">
            <Terminal size={13} className="text-[#60A5FA]" />
            dev@v-id — guardian check — zsh
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-[#3FB950] bg-[#3FB950]/10 px-2 py-0.5 rounded border border-[#3FB950]/20 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3FB950] animate-pulse" />
            AUTO RUN
          </span>
        </div>
      </div>

      {/* Terminal Body */}
      <div ref={bodyRef} className="p-6 font-mono text-xs sm:text-sm space-y-1.5 h-[440px] overflow-y-auto">
        {completedSteps.map((step, i) => (
          <LiveStepLine key={i} step={step} />
        ))}

        {/* Active typing command line */}
        {currentStep && currentStep.type === 'cmd' && (
          <div className={`flex items-start gap-2.5 ${currentStep.gapBefore ? 'mt-3' : ''}`}>
            <span className="text-[#3FB950] font-bold select-none">$</span>
            <span className="text-[#F0F6FC] font-medium">
              {typedText}
              <span className="inline-block w-[8px] h-[16px] -mb-[3px] ml-0.5 bg-[#60A5FA] animate-pulse" />
            </span>
          </div>
        )}

        {/* Cursor indicator when executing output or scanning */}
        {currentStep && currentStep.type !== 'cmd' && (
          <div className="flex items-center gap-2.5 pt-1">
            <span className="inline-block w-[8px] h-[16px] -mb-[3px] bg-[#60A5FA] animate-pulse" />
          </div>
        )}

        {/* Terminal prompt when simulation completes before loop */}
        {isDone && (
          <div className="flex items-center gap-2.5 pt-2">
            <span className="text-[#3FB950] font-bold select-none">$</span>
            <span className="inline-block w-[8px] h-[16px] -mb-[3px] bg-[#60A5FA] animate-pulse" />
          </div>
        )}
      </div>

      {/* Terminal Bottom Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0F172A] border-t border-[#1F2937] font-mono text-xs text-[#64748B]">
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-[#3FB950] font-semibold">● zsh</span>
          <span className="hidden sm:inline text-[#8B949E]">
            {isDone
              ? isVi
                ? 'Mô phỏng hoàn tất (Tự động lặp lại)'
                : 'Walkthrough finished (Auto looping)'
              : isVi
                ? 'Đang tự động chạy lệnh...'
                : 'Auto executing commands...'}
          </span>
        </div>
        <button
          onClick={restart}
          className="text-[11px] font-mono text-[#94A3B8] hover:text-[#F0F6FC] transition-colors cursor-pointer bg-transparent border-0 flex items-center gap-1"
          title={isVi ? 'Chạy lại từ đầu' : 'Restart simulation'}
        >
          ↻ {isVi ? 'Chạy lại' : 'Replay'}
        </button>
      </div>
    </div>
  )
}

const CI_WORKFLOW_YAML = `# .github/workflows/guardian.yml
name: Guardian

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  guardian-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # full history — needed to diff origin/<base>...HEAD

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm install -g ai-dev-guardian
      - run: guardian check --ci
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
          OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}
`

const REASONING_LAYERS = [
  {
    title: '1. Structured Tool Schema',
    descVi: 'Bắt buộc LLM trả về enum policyId tồn tại, không thể tự bịa quy tắc không có thực.',
    descEn: 'Enforces LLM tool-calling schema returning valid existing policy IDs without hallucinations.',
  },
  {
    title: '2. Reasoning CoT First',
    descVi: 'Trường reasoning bắt buộc khai báo trước trong schema, ép LLM lập luận trước khi kết luận.',
    descEn: 'Reasoning field is declared first in JSON schema, forcing LLM chain-of-thought before verdict.',
  },
  {
    title: '3. Evidence Grounding',
    descVi: 'Snippet vi phạm phải xuất hiện khớp 100% từng dòng trong file diff thực tế.',
    descEn: 'Violation snippets must match 100% line-by-line with exact added diff lines.',
  },
  {
    title: '4. AST Annotation',
    descVi: 'Gắn thẻ <comment> và <string> cho AST để LLM không nhầm lẫn nhận xét với code chạy thực.',
    descEn: 'Annotates AST nodes with <comment> and <string> so LLM never confuses comments with executable code.',
  },
  {
    title: '5. LLM-as-a-Judge',
    descVi: 'Vòng kiểm tra độc lập thứ 2 sử dụng model siêu tốc để re-evaluate loại bỏ 100% false positive.',
    descEn: 'Independent 2nd-pass evaluator model re-verifies findings to eliminate false positive traps.',
  },
]

export function NoteBook() {
  const navigate = useNavigate()
  const { setTheme, isDark } = useTheme()

  const [copiedCmd, setCopiedCmd] = useState<string | null>(null)
  const [lang, setLang] = useState<'vi' | 'en'>('vi')

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCmd(label)
    setTimeout(() => setCopiedCmd(null), 2500)
  }

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark')
  }

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Bilingual i18n content dictionary
  const isVi = lang === 'vi'

  return (
    <div className="min-h-screen arcade-grid-bg text-[#002060] dark:text-[#E2E8F0] font-sans selection:bg-[#C8102E] selection:text-white transition-colors duration-200">
      {/* 1. HEADER / NAVIGATION */}
      <header className="sticky top-0 z-50 border-b border-[#E2E8F0] dark:border-[#1F2937] bg-[#FFFFFF]/95 dark:bg-[#0A0F1D]/95 backdrop-blur-md px-3 sm:px-6 py-3">
        <div className="w-full max-w-[1600px] mx-auto flex items-center justify-between gap-2 lg:gap-4">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 shrink-0 whitespace-nowrap">
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-2.5 text-left group cursor-pointer border-0 bg-transparent shrink-0"
            >
              <div className="w-8 h-8 rounded-lg bg-[#C8102E] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform p-1.5 shrink-0">
                <QwoangIcon className="w-5 h-5" color="#FFFFFF" />
              </div>
              <div className="whitespace-nowrap">
                <div className="flex items-center gap-1.5 font-mono text-sm font-bold tracking-tight text-[#002060] dark:text-[#F8FAFC]">
                  <span>qwoang</span>
                  <span className="text-[#C8102E]">·guardian</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#C8102E]/10 text-[#C8102E] border border-[#C8102E]/20 font-bold">
                    v1.2.0
                  </span>
                </div>
                <div className="text-[10px] font-mono text-[#64748B] dark:text-[#94A3B8]">
                  QWOANG AI Dev Security & Context Engine
                </div>
              </div>
            </button>
          </div>

          {/* Center Navigation Links matching the 8 sections */}
          <nav className="hidden lg:flex items-center gap-1 font-mono text-xs font-medium bg-[#F8FAFC] dark:bg-[#111827] p-1.5 rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] shadow-xs whitespace-nowrap shrink-0">
            <button
              onClick={() => scrollToSection('self-analysis-demo')}
              className="px-3 py-1.5 rounded-lg text-[#002060] dark:text-[#94A3B8] hover:text-[#C8102E] dark:hover:text-[#F8FAFC] hover:bg-[#C8102E]/5 dark:hover:bg-[#1F2937] transition-colors cursor-pointer border-0 font-semibold whitespace-nowrap"
            >
              {isVi ? 'Trình diễn' : 'Demo'}
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="px-3 py-1.5 rounded-lg text-[#002060] dark:text-[#94A3B8] hover:text-[#C8102E] dark:hover:text-[#F8FAFC] hover:bg-[#C8102E]/5 dark:hover:bg-[#1F2937] transition-colors cursor-pointer border-0 font-semibold whitespace-nowrap"
            >
              {isVi ? 'Cách hoạt động' : 'How It Works'}
            </button>
            <button
              onClick={() => scrollToSection('agent-with-map')}
              className="px-3 py-1.5 rounded-lg text-[#002060] dark:text-[#94A3B8] hover:text-[#C8102E] dark:hover:text-[#F8FAFC] hover:bg-[#C8102E]/5 dark:hover:bg-[#1F2937] transition-colors cursor-pointer border-0 font-semibold whitespace-nowrap"
            >
              {isVi ? 'Bản đồ Agent' : 'Agent Map'}
            </button>
            <button
              onClick={() => scrollToSection('drift-in-ci')}
              className="px-3 py-1.5 rounded-lg text-[#002060] dark:text-[#94A3B8] hover:text-[#C8102E] dark:hover:text-[#F8FAFC] hover:bg-[#C8102E]/5 dark:hover:bg-[#1F2937] transition-colors cursor-pointer border-0 font-semibold whitespace-nowrap"
            >
              {isVi ? 'CI Gate' : 'CI Gate'}
            </button>
            <button
              onClick={() => scrollToSection('evaluation-benchmarks')}
              className="px-3 py-1.5 rounded-lg text-[#002060] dark:text-[#94A3B8] hover:text-[#C8102E] dark:hover:text-[#F8FAFC] hover:bg-[#C8102E]/5 dark:hover:bg-[#1F2937] transition-colors cursor-pointer border-0 font-semibold whitespace-nowrap"
            >
              {isVi ? 'Đánh giá Engine' : 'Evaluation'}
            </button>
            <button
              onClick={() => scrollToSection('whats-in-the-box')}
              className="px-3 py-1.5 rounded-lg text-[#002060] dark:text-[#94A3B8] hover:text-[#C8102E] dark:hover:text-[#F8FAFC] hover:bg-[#C8102E]/5 dark:hover:bg-[#1F2937] transition-colors cursor-pointer border-0 font-semibold whitespace-nowrap"
            >
              {isVi ? 'Hệ thống bao gồm' : "What's in the Box"}
            </button>
          </nav>

          {/* Header Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 whitespace-nowrap">
            {/* Language Switcher Button with Flag Icons */}
            <button
              onClick={() => setLang(isVi ? 'en' : 'vi')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#1F2937] bg-[#F8FAFC] dark:bg-[#111827] text-[#002060] dark:text-[#F8FAFC] hover:text-[#C8102E] dark:hover:text-[#F8FAFC] transition-all cursor-pointer text-xs font-mono font-bold shadow-xs hover:border-[#C8102E]/40 shrink-0 whitespace-nowrap"
              title={isVi ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
            >
              <span className="text-sm leading-none select-none">
                {isVi ? '🇻🇳' : '🇺🇸'}
              </span>
              <span className="uppercase text-[11px] font-bold tracking-wider">
                {isVi ? 'VI' : 'EN'}
              </span>
            </button>

            {/* GitHub Repo Button */}
            <a
              href="https://github.com/dquangai/ai-dev-guardian"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer bg-[#F8FAFC] dark:bg-[#111827] border-[#E2E8F0] dark:border-[#1F2937] text-[#002060] dark:text-[#94A3B8] hover:text-[#C8102E] dark:hover:text-[#F8FAFC] hover:border-[#C8102E]/40 shrink-0 whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5 fill-current text-[#002060] dark:text-[#F8FAFC]" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span className="hidden sm:inline whitespace-nowrap">Star on GitHub</span>
              <span className="text-[10px] opacity-75">1.4k</span>
            </a>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-[#E2E8F0] dark:border-[#1F2937] bg-[#F8FAFC] dark:bg-[#111827] text-[#002060] dark:text-[#94A3B8] hover:text-[#C8102E] dark:hover:text-[#F8FAFC] transition-colors cursor-pointer shrink-0"
              title={isDark ? (isVi ? 'Giao diện sáng' : 'Light Mode') : (isVi ? 'Giao diện tối' : 'Dark Mode')}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* Login Action Button */}
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#C8102E] text-white px-4 py-1.5 text-xs font-bold hover:bg-[#A00C24] transition-all cursor-pointer shadow-xs border-0 shrink-0 whitespace-nowrap"
            >
              <span>{isVi ? 'Đăng nhập' : 'Login'}</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-20">
        {/* 2. HERO SECTION */}
        <section className="text-center space-y-6 pt-4">
          {/* Badge Pill Row */}
          <div className="inline-flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] text-[#002060] dark:text-[#60A5FA]">
            <span className="px-2.5 py-0.5 rounded-full bg-[#002060]/10 dark:bg-[#1E3A8A]/50 border border-[#002060]/20 dark:border-[#3B82F6]/30 flex items-center gap-1 font-bold">
              <Sparkles size={11} className="text-[#C8102E]" /> OPEN SOURCE
            </span>
            <span className="text-[#CBD5E1] dark:text-[#1F2937]">·</span>
            <span className="font-bold">{isVi ? 'GIẤY PHÉP MIT' : 'MIT LICENSE'}</span>
            <span className="text-[#CBD5E1] dark:text-[#1F2937]">·</span>
            <span className="font-bold">TYPESCRIPT & NODE.JS</span>
            <span className="text-[#CBD5E1] dark:text-[#1F2937]">·</span>
            <span className="font-bold">{isVi ? 'QUẢN TRỊ AST & LLM' : 'AST & LLM GOVERNANCE'}</span>
          </div>

          {/* Hero Main Headline */}
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#002060] dark:text-[#F8FAFC] max-w-4xl mx-auto leading-tight font-sans">
            {isVi
              ? 'Ngữ cảnh kiến trúc & Cổng an ninh cho AI Coding Agent.'
              : 'Architectural context & security gates for your coding agents.'}
          </h1>

          {/* Hero Subtitle based on README */}
          <p className="text-sm sm:text-base text-[#475569] dark:text-[#94A3B8] max-w-3xl mx-auto font-sans leading-relaxed">
            {isVi ? (
              <>
                Các AI coding agent không thiếu trí tuệ — chúng chỉ thiếu ngữ cảnh kiến trúc có ranh giới.{' '}
                <strong className="text-[#C8102E] font-bold">ai-dev-guardian</strong> chính là bản đồ:
                thành phần, phụ thuộc, secrets, quy tắc an ninh — trích xuất trực tiếp từ code, kiểm tra trước khi push, phục vụ qua CLI & Web Dashboard.
              </>
            ) : (
              <>
                Coding agents don't lack intelligence — they lack bounded architectural context.{' '}
                <strong className="text-[#C8102E] font-bold">ai-dev-guardian</strong> is the map:
                components, dependencies, secrets, security rules — recovered from your code, checked pre-push, served over CLI & Web Dashboard.
              </>
            )}
          </p>

          {/* Command Box with One-click Copy */}
          <div className="inline-flex flex-col sm:flex-row items-center gap-3 p-2 rounded-xl arcade-command-box shadow-xs max-w-2xl w-full mx-auto text-left">
            <div className="flex-1 flex items-center gap-2 px-3 py-1.5 font-mono text-xs text-[#002060] dark:text-[#F8FAFC] w-full">
              <span className="text-[#C8102E] font-bold select-none">$</span>
              <span className="font-bold">npm install -g ai-dev-guardian</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => handleCopy('npm install -g ai-dev-guardian', 'hero-install')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#C8102E] text-white font-mono text-xs font-bold hover:bg-[#A00C24] transition-all cursor-pointer shadow-xs border-0"
              >
                {copiedCmd === 'hero-install' ? <Check size={13} /> : <Copy size={13} />}
                <span>
                  {copiedCmd === 'hero-install'
                    ? (isVi ? 'Đã chép!' : 'Copied!')
                    : (isVi ? 'Sao chép' : 'Copy')}
                </span>
              </button>
              <span className="text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8] hidden lg:inline">
                {isVi ? 'sau đó chạy' : 'then run'}{' '}
                <code className="text-[#002060] dark:text-[#F8FAFC] font-bold">guardian check --staged</code>
              </span>
            </div>
          </div>

          {/* Supported Agents & Tools */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs font-mono text-[#64748B] dark:text-[#94A3B8]">
            <span className="mr-1">{isVi ? 'Tương thích hoàn hảo với:' : 'Works seamlessly with:'}</span>
            {['Claude Code', 'Cursor', 'Claude Desktop', 'VS Code', 'Windsurf'].map((tool) => (
              <span
                key={tool}
                className="px-2.5 py-1 rounded-md bg-[#FFFFFF] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1F2937] text-[#002060] dark:text-[#F8FAFC] font-medium shadow-2xs"
              >
                {tool}
              </span>
            ))}
          </div>
        </section>

        {/* 3. SELF-ANALYSIS DEMO */}
        <section id="self-analysis-demo" className="scroll-mt-24">
          <GuardianLiveDemo isVi={isVi} />
        </section>

        {/* 4. HOW IT WORKS */}
        <section id="how-it-works" className="space-y-8 scroll-mt-24">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-[#C8102E] uppercase bg-[#C8102E]/10 px-3 py-1 rounded-md border border-[#C8102E]/20">
              <Workflow size={14} className="text-[#C8102E]" /> {isVi ? 'CÁCH HOẠT ĐỘNG' : 'HOW IT WORKS'}
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#002060] dark:text-[#F8FAFC]">
              {isVi
                ? '4 Vòng kiểm tra độc lập mỗi lần Push — Không ảnh hưởng tốc độ'
                : '4 Independent Checks Per Push — Zero Overhead'}
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] max-w-2xl mx-auto">
              {isVi
                ? 'Mọi vòng kiểm tra chỉ chạy trên các dòng diff vừa thay đổi. Cả 4 checker thực thi đồng thời qua Promise.all.'
                : 'Every check runs scoped exclusively to the current diff. All 4 checkers execute concurrently via Promise.all.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <TechGridCard
              category={isVi ? 'DETERMINISTIC · MIỄN PHÍ' : 'DETERMINISTIC · FREE'}
              title={isVi ? '1. Quét Secrets' : '1. Secret Scan'}
              description={isVi ? 'Scanner regex phát hiện AWS key, PEM private key, Slack/GitHub token trên các dòng diff mới.' : 'Regex scanner detecting AWS keys, PEM private keys, Slack/GitHub tokens on added diff lines only.'}
              icon={<Shield size={18} className="text-[#C8102E]" />}
            />
            <TechGridCard
              category="AST + MADGE"
              title={isVi ? '2. Kiểm tra Kiến trúc' : '2. Architecture Check'}
              description={isVi ? 'Phát hiện vòng phụ thuộc tuần hoàn qua Madge. Chỉ báo cáo vòng phụ thuộc bị ảnh hưởng bởi diff.' : 'Madge-backed dependency cycle detection. Only reports cycles touched by this specific diff.'}
              icon={<Layers size={18} className="text-[#C8102E]" />}
            />
            <TechGridCard
              category="OPTIONAL BINARY"
              title={isVi ? '3. Semgrep Static' : '3. Semgrep Static'}
              description={isVi ? 'Chạy bộ quy tắc p/security-audit. Lọc kết quả chính xác theo các dòng mã được thêm vào.' : 'Runs p/security-audit ruleset. Findings filtered strictly to lines added by the diff.'}
              icon={<Code2 size={18} className="text-[#C8102E]" />}
            />
            <TechGridCard
              category={isVi ? '5 LỚP LẬP LUẬN' : '5-LAYER REASONING'}
              title={isVi ? '4. Kiểm tra Policy LLM' : '4. LLM Policy Verification'}
              description={isVi ? 'Xác minh LLM dựa trên bằng chứng với tool-calling schema, AST annotation và LLM-as-a-Judge.' : 'Evidence-grounded LLM verification with tool-calling schema, AST annotation, and LLM-as-a-Judge.'}
              icon={<Zap size={18} className="text-[#C8102E]" />}
            />
          </div>

          {/* 5 Layers against Hallucination Callout */}
          <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-[#FFFFFF] dark:bg-[#111827] p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] dark:border-[#1F2937] pb-4">
              <div>
                <h3 className="text-lg font-bold text-[#002060] dark:text-[#F8FAFC]">
                  {isVi
                    ? 'Lập luận LLM: 5 Lớp chống Ảo giác (Anti-Hallucination)'
                    : 'LLM Reasoning: 5 Layers Against Hallucination'}
                </h3>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  {isVi
                    ? 'Guardian không bao giờ tin cậy đầu ra LLM mù quáng — mọi kết luận phải vượt qua xác minh bằng chứng.'
                    : 'Guardian never trusts LLM outputs blindly — every claim must survive strict evidence verification.'}
                </p>
              </div>
              <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-[#C8102E]/10 text-[#C8102E] font-bold border border-[#C8102E]/20">
                {isVi ? 'ĐÃ KIỂM CHỨNG BỘ DATASET' : 'GOLDEN DATASET TESTED'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 font-mono text-xs">
              {REASONING_LAYERS.map((layer) => (
                <div
                  key={layer.title}
                  className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0A0F1D] border border-[#E2E8F0] dark:border-[#1F2937] space-y-2"
                >
                  <div className="font-bold text-[#C8102E] text-xs font-sans">{layer.title}</div>
                  <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-sans leading-snug">
                    {isVi ? layer.descVi : layer.descEn}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. YOUR AGENT, WITH A MAP */}
        <section id="agent-with-map" className="space-y-8 scroll-mt-24">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-[#C8102E] uppercase bg-[#C8102E]/10 px-3 py-1 rounded-md border border-[#C8102E]/20">
              <Layers size={14} className="text-[#C8102E]" /> {isVi ? 'NGỮ CẢNH KIẾN TRÚC' : 'ARCHITECTURAL CONTEXT'}
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#002060] dark:text-[#F8FAFC]">
              {isVi ? 'AI Agent được trang bị Bản đồ Kiến trúc Chi tiết' : 'Your Agent, With a Bounded Architectural Map'}
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] max-w-2xl mx-auto">
              {isVi
                ? 'Guardian đóng vai trò bản đồ: Phân tích AST qua @ast-grep/napi và truy xuất RAG-lite tập tin vệ tinh.'
                : 'Guardian acts as the map: AST parsing via @ast-grep/napi and per-language satellite file RAG-lite.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Without Guardian */}
            <div className="p-6 rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 space-y-4">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-mono text-xs font-bold uppercase">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {isVi ? 'Coding Agent Không Có Bản Đồ' : 'Blind Coding Agent (Without Map)'}
              </div>
              <ul className="space-y-2.5 text-xs font-sans text-[#475569] dark:text-[#94A3B8]">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">✕</span>
                  <span>
                    {isVi
                      ? 'Viết code chạy được nhưng âm thầm vi phạm ranh giới phụ thuộc tuần hoàn.'
                      : 'Writes functional code that silently breaks circular dependency constraints.'}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">✕</span>
                  <span>
                    {isVi
                      ? 'Hardcode secrets hoặc tắt xác thực trong các route dev nội bộ.'
                      : 'Hardcodes secrets or disables authentication in local dev routes.'}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">✕</span>
                  <span>
                    {isVi
                      ? 'Tự động vá code với cú pháp ảo giác hoặc logic nghiệp vụ bị hỏng.'
                      : 'Auto-patches code with hallucinated syntax or broken business logic.'}
                  </span>
                </li>
              </ul>
            </div>

            {/* With Guardian */}
            <div className="p-6 rounded-2xl border border-[#002060] dark:border-[#3B82F6] bg-[#FFFFFF] dark:bg-[#111827] space-y-4 shadow-sm">
              <div className="flex items-center gap-2 text-[#002060] dark:text-[#60A5FA] font-mono text-xs font-bold uppercase">
                <span className="w-2 h-2 rounded-full bg-[#002060] dark:bg-[#60A5FA]" />
                {isVi ? 'Coding Agent Có Guardian Hướng Dẫn' : 'Guardian-Guided Agent (With Map)'}
              </div>
              <ul className="space-y-2.5 text-xs font-sans text-[#002060] dark:text-[#CBD5E1]">
                <li className="flex items-start gap-2">
                  <span className="text-[#C8102E] font-bold">✓</span>
                  <span>
                    {isVi
                      ? 'Truy xuất vệ tinh RAG-lite lấy chính xác định nghĩa type & function.'
                      : 'RAG-lite satellite retrieval fetches exact type & function definitions.'}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#C8102E] font-bold">✓</span>
                  <span>
                    {isVi
                      ? 'Cổng pre-push chặn commit lỗi trước khi chạm vào repo chính.'
                      : 'Pre-push gates block bad commits before they ever touch origin repository.'}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#C8102E] font-bold">✓</span>
                  <span>
                    {isVi
                      ? 'Prompt-as-a-Fix: Đề xuất câu prompt chỉnh sửa tự nhiên có thể dán ngay.'
                      : 'Prompt-as-a-Fix: Guardian proposes ready-to-paste natural language fix prompts.'}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 6. DRIFT, CAUGHT IN CI */}
        <section id="drift-in-ci" className="space-y-8 scroll-mt-24">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-[#C8102E] uppercase bg-[#C8102E]/10 px-3 py-1 rounded-md border border-[#C8102E]/20">
              <GitPullRequest size={14} className="text-[#C8102E]" /> {isVi ? 'CỔNG KIỂM SOÁT CI/CD' : 'CI/CD DRIFT GATE'}
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#002060] dark:text-[#F8FAFC]">
              {isVi ? 'Phát hiện sai lệch kiến trúc ngay tại Pull Request' : 'Drift, Caught Right on Pull Request'}
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] max-w-2xl mx-auto">
              {isVi
                ? 'Chạy guardian check --ci trên GitHub Actions. Tự động đăng 1 comment duy nhất kèm prompt sửa lỗi.'
                : 'Run guardian check --ci on GitHub Actions. Posts a single deduplicated PR comment with actionable fix prompts.'}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: GitHub Actions YAML */}
            <div className="lg:col-span-7 rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-[#0A0F1D] p-5 text-[#F0F6FC] font-mono text-xs space-y-3">
              <div className="flex items-center justify-between text-[#94A3B8] border-b border-[#1F2937] pb-3">
                <span className="flex items-center gap-2">
                  <GitPullRequest size={14} className="text-[#60A5FA]" />
                  .github/workflows/guardian.yml
                </span>
                <button
                  onClick={() => handleCopy(CI_WORKFLOW_YAML, 'ci-section')}
                  className="text-xs text-[#60A5FA] hover:underline cursor-pointer flex items-center gap-1 border-0 bg-transparent font-bold"
                >
                  {copiedCmd === 'ci-section' ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedCmd === 'ci-section' ? (isVi ? 'Đã sao chép' : 'Copied') : (isVi ? 'Sao chép YAML' : 'Copy YAML')}</span>
                </button>
              </div>
              <pre className="overflow-x-auto text-[11px] leading-relaxed text-[#E6EDE3]">{CI_WORKFLOW_YAML}</pre>
            </div>

            {/* Right: PR Comment Simulation */}
            <div className="lg:col-span-5 rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-[#FFFFFF] dark:bg-[#111827] p-5 space-y-4 shadow-xs">
              <div className="flex items-center gap-2 pb-3 border-b border-[#E2E8F0] dark:border-[#1F2937]">
                <div className="w-6 h-6 rounded-full bg-[#C8102E] text-white flex items-center justify-center font-bold text-[10px]">
                  G
                </div>
                <div>
                  <div className="text-xs font-bold text-[#002060] dark:text-[#F8FAFC]">guardian-bot [bot]</div>
                  <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                    {isVi ? 'đã nhận xét 2 phút trước' : 'commented 2 minutes ago'}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#FFF1F2] dark:bg-[#311218] border border-[#C8102E]/40 space-y-2">
                <div className="flex items-center justify-between font-mono text-xs font-bold text-[#C8102E]">
                  <span>{isVi ? 'KẾT LUẬN: CHẶN' : 'VERDICT: BLOCK'}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#C8102E] text-white font-bold">
                    {isVi ? '1 NGHIÊM TRỌNG' : '1 CRITICAL'}
                  </span>
                </div>
                <div className="text-xs font-sans text-[#475569] dark:text-[#CBD5E1]">
                  {isVi ? 'Phát hiện AWS Secret Key bị hardcode tại' : 'Found AWS Secret Key hardcoded in'}{' '}
                  <code className="font-mono text-xs font-bold text-[#C8102E]">src/config/aws.ts:14</code>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#0A0F1D] text-[#F0F6FC] font-mono text-[11px] space-y-1.5">
                <div className="text-[#94A3B8] text-[10px]">
                  {isVi ? '# Prompt sửa lỗi sẵn sàng dán vào AI Agent:' : '# Ready-to-paste Prompt-as-a-Fix:'}
                </div>
                <div className="text-[#3FB950]">
                  "Remove hardcoded AWS key from src/config/aws.ts line 14 and read from process.env.AWS_SECRET_ACCESS_KEY instead."
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. EVALUATION & BENCHMARKS */}
        <section id="evaluation-benchmarks" className="space-y-8 scroll-mt-24">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-[#C8102E] uppercase bg-[#C8102E]/10 px-3 py-1 rounded-md border border-[#C8102E]/20">
              <CheckCircle2 size={14} className="text-[#C8102E]" /> {isVi ? 'ĐÁNH GIÁ & BENCHMARK' : 'EVALUATION & BENCHMARKS'}
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#002060] dark:text-[#F8FAFC]">
              {isVi
                ? 'Kiểm chứng trên Bộ dữ liệu An ninh 100 Kịch bản'
                : 'Verified on 100-Case Golden Security Dataset'}
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] max-w-2xl mx-auto">
              {isVi
                ? 'Guardian được đánh giá liên tục trên 100 diff code thực tế gồm các vi phạm an ninh thật và bẫy báo nhầm tinh vi.'
                : 'Guardian is continuously evaluated against 100 real-world code diffs containing true security violations and subtle false-positive traps.'}
            </p>
          </div>

          {/* 4 Key Benchmark Metric Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
            <div className="p-5 rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-[#FFFFFF] dark:bg-[#111827] space-y-1 shadow-xs">
              <div className="text-3xl sm:text-4xl font-extrabold text-[#C8102E] font-mono">96.1%</div>
              <div className="text-xs font-bold text-[#002060] dark:text-[#F8FAFC]">
                {isVi ? 'Độ phủ Recall' : 'Recall Accuracy'}
              </div>
              <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                {isVi ? '49 / 51 Vi phạm được bắt' : '49 / 51 Violations Caught'}
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-[#FFFFFF] dark:bg-[#111827] space-y-1 shadow-xs">
              <div className="text-3xl sm:text-4xl font-extrabold text-[#002060] dark:text-[#60A5FA] font-mono">94.2%</div>
              <div className="text-xs font-bold text-[#002060] dark:text-[#F8FAFC]">
                {isVi ? 'Độ chính xác Precision' : 'Precision Score'}
              </div>
              <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                {isVi ? 'Tối thiểu báo động giả' : 'Minimal False Alarms'}
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-[#FFFFFF] dark:bg-[#111827] space-y-1 shadow-xs">
              <div className="text-3xl sm:text-4xl font-extrabold text-[#3FB950] font-mono">6.1%</div>
              <div className="text-xs font-bold text-[#002060] dark:text-[#F8FAFC]">
                {isVi ? 'Tỷ lệ Báo nhầm FP' : 'False Positive Rate'}
              </div>
              <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                {isVi ? '3 / 49 Bẫy bị kích hoạt' : '3 / 49 Traps Triggered'}
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-[#FFFFFF] dark:bg-[#111827] space-y-1 shadow-xs">
              <div className="text-3xl sm:text-4xl font-extrabold text-[#002060] dark:text-[#F8FAFC] font-mono">100</div>
              <div className="text-xs font-bold text-[#002060] dark:text-[#F8FAFC]">
                {isVi ? 'Tổng số Test Case' : 'Golden Test Cases'}
              </div>
              <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                {isVi ? '51 Vi phạm + 49 Bẫy' : '51 True Pos + 49 Traps'}
              </div>
            </div>
          </div>

          {/* Sample Evaluation Case Table Preview */}
          <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-[#FFFFFF] dark:bg-[#111827] p-6 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] dark:border-[#1F2937] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#002060] dark:text-[#F8FAFC]">
                  {isVi ? 'Báo cáo Đánh giá Benchmark Mẫu' : 'Sample Evaluation Benchmark Results'}
                </h3>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  {isVi ? 'Trích từ' : 'From'}{' '}
                  <code className="font-mono text-[#C8102E] font-bold">eval/results/latest.md</code>{' '}
                  — {isVi ? 'tự động cập nhật mỗi bản phát hành.' : 'updated automatically on each engine release.'}
                </p>
              </div>
              <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-[#3FB950]/10 text-[#27C93F] font-bold border border-[#27C93F]/20">
                {isVi ? 'ĐẠT TIÊU CHUẨN CHẤT LƯỢNG' : 'PASSING QUALITY GATES'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] dark:border-[#1F2937] text-[#002060] dark:text-[#F8FAFC] bg-[#F8FAFC] dark:bg-[#0A0F1D]">
                    <th className="py-2.5 px-3">{isVi ? 'Mã Case' : 'Case ID'}</th>
                    <th className="py-2.5 px-3">{isVi ? 'Phân loại' : 'Category'}</th>
                    <th className="py-2.5 px-3">{isVi ? 'Quy tắc Đánh giá' : 'Policy Evaluated'}</th>
                    <th className="py-2.5 px-3 text-center">{isVi ? 'Trạng thái' : 'Status'}</th>
                    <th className="py-2.5 px-3">{isVi ? 'Chi tiết' : 'Detail'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1F2937] text-[#475569] dark:text-[#94A3B8]">
                  <tr className="hover:bg-[#F8FAFC] dark:hover:bg-[#0A0F1D]/50 transition-colors">
                    <td className="py-2 px-3 text-[#002060] dark:text-[#F8FAFC] font-bold">tp-01-aws-secret</td>
                    <td className="py-2 px-3 text-[#C8102E] font-bold">true-positive</td>
                    <td className="py-2 px-3">security.policy.md</td>
                    <td className="py-2 px-3 text-center text-[#3FB950] font-bold">✅ PASS</td>
                    <td className="py-2 px-3">{isVi ? 'Phát hiện 2 vi phạm' : '2 violations detected'}</td>
                  </tr>
                  <tr className="hover:bg-[#F8FAFC] dark:hover:bg-[#0A0F1D]/50 transition-colors">
                    <td className="py-2 px-3 text-[#002060] dark:text-[#F8FAFC] font-bold">tp-04-sql-injection</td>
                    <td className="py-2 px-3 text-[#C8102E] font-bold">true-positive</td>
                    <td className="py-2 px-3">security.policy.md</td>
                    <td className="py-2 px-3 text-center text-[#3FB950] font-bold">✅ PASS</td>
                    <td className="py-2 px-3">{isVi ? 'Phát hiện 1 vi phạm' : '1 violation detected'}</td>
                  </tr>
                  <tr className="hover:bg-[#F8FAFC] dark:hover:bg-[#0A0F1D]/50 transition-colors">
                    <td className="py-2 px-3 text-[#002060] dark:text-[#F8FAFC] font-bold">fp-01-any-in-vietnamese-comment</td>
                    <td className="py-2 px-3 text-[#60A5FA] font-bold">false-positive-trap</td>
                    <td className="py-2 px-3">coding-convention.policy.md</td>
                    <td className="py-2 px-3 text-center text-[#3FB950] font-bold">✅ PASS</td>
                    <td className="py-2 px-3">{isVi ? '0 vi phạm (Đã vượt qua bẫy)' : '0 violations (Trap avoided)'}</td>
                  </tr>
                  <tr className="hover:bg-[#F8FAFC] dark:hover:bg-[#0A0F1D]/50 transition-colors">
                    <td className="py-2 px-3 text-[#002060] dark:text-[#F8FAFC] font-bold">tp-13-header-based-admin-bypass</td>
                    <td className="py-2 px-3 text-[#C8102E] font-bold">true-positive</td>
                    <td className="py-2 px-3">rbac.policy.md</td>
                    <td className="py-2 px-3 text-center text-[#3FB950] font-bold">✅ PASS</td>
                    <td className="py-2 px-3">{isVi ? 'Phát hiện 1 vi phạm' : '1 violation detected'}</td>
                  </tr>
                  <tr className="hover:bg-[#F8FAFC] dark:hover:bg-[#0A0F1D]/50 transition-colors">
                    <td className="py-2 px-3 text-[#002060] dark:text-[#F8FAFC] font-bold">fp-11-secret-in-test-fixture</td>
                    <td className="py-2 px-3 text-[#60A5FA] font-bold">false-positive-trap</td>
                    <td className="py-2 px-3">security.policy.md</td>
                    <td className="py-2 px-3 text-center text-[#3FB950] font-bold">✅ PASS</td>
                    <td className="py-2 px-3">{isVi ? '0 vi phạm (Đã bỏ qua file test)' : '0 violations (Test fixture ignored)'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 8. WHAT'S IN THE BOX */}
        <section id="whats-in-the-box" className="space-y-8 scroll-mt-24">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-[#C8102E] uppercase bg-[#C8102E]/10 px-3 py-1 rounded-md border border-[#C8102E]/20">
              <Rocket size={14} className="text-[#C8102E]" /> {isVi ? 'HỆ THỐNG BAO GỒM' : "WHAT'S IN THE BOX"}
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#002060] dark:text-[#F8FAFC]">
              {isVi ? 'Bộ giải pháp Quản trị An ninh AI Toàn diện' : 'The Complete AI Security Governance Suite'}
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] max-w-2xl mx-auto">
              {isVi
                ? 'Đầy đủ công cụ cho nhà phát triển cá nhân và các đội ngũ doanh nghiệp lớn.'
                : 'Everything required to run zero-friction governance across individual dev machines & enterprise teams.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-6 rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-[#FFFFFF] dark:bg-[#111827] space-y-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[#C8102E]/10 text-[#C8102E] flex items-center justify-center font-bold border border-[#C8102E]/20">
                <Terminal size={20} />
              </div>
              <h3 className="text-base font-bold text-[#002060] dark:text-[#F8FAFC]">
                {isVi ? 'CLI & Pre-push Hook' : 'CLI & Pre-push Hook'}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                {isVi
                  ? 'Cài đặt bằng 1 lệnh npm. Nhắc nhở TTY tương tác trước khi push. Không tự sửa code trái phép.'
                  : 'Single npm command install. Interactive TTY prompts before push. Zero code auto-patching for safety.'}
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-[#FFFFFF] dark:bg-[#111827] space-y-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[#C8102E]/10 text-[#C8102E] flex items-center justify-center font-bold border border-[#C8102E]/20">
                <Workflow size={20} />
              </div>
              <h3 className="text-base font-bold text-[#002060] dark:text-[#F8FAFC]">
                {isVi ? 'Web Dashboard' : 'Web Dashboard'}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                {isVi
                  ? 'Express API + React UI. Khởi chạy 1 lệnh duy nhất qua guardian dashboard.'
                  : 'Express API + React UI. Single-command launch via guardian dashboard.'}
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-[#FFFFFF] dark:bg-[#111827] space-y-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[#C8102E]/10 text-[#C8102E] flex items-center justify-center font-bold border border-[#C8102E]/20">
                <UserCheck size={20} />
              </div>
              <h3 className="text-base font-bold text-[#002060] dark:text-[#F8FAFC]">
                {isVi ? 'OpenFGA ReBAC & RBAC' : 'OpenFGA ReBAC & RBAC'}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                {isVi
                  ? '5 vai trò (Super Admin, Admin, Tech Lead, Dev, Auditor) quản lý quyền theo mối quan hệ.'
                  : '5 roles (Super Admin, Admin, Tech Lead, Dev, Auditor) backed by relationship-based authorization tuples.'}
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-[#FFFFFF] dark:bg-[#111827] space-y-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[#C8102E]/10 text-[#C8102E] flex items-center justify-center font-bold border border-[#C8102E]/20">
                <FileText size={20} />
              </div>
              <h3 className="text-base font-bold text-[#002060] dark:text-[#F8FAFC]">
                {isVi ? 'Động cơ Policy-as-Code' : 'Policy-as-Code Engine'}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                {isVi
                  ? 'YAML frontmatter + Markdown body trong .guardian/policies/ định tuyến theo phạm vi.'
                  : 'YAML frontmatter + Markdown body under .guardian/policies/ with micromatch scope routing.'}
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-[#FFFFFF] dark:bg-[#111827] space-y-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[#C8102E]/10 text-[#C8102E] flex items-center justify-center font-bold border border-[#C8102E]/20">
                <Zap size={20} />
              </div>
              <h3 className="text-base font-bold text-[#002060] dark:text-[#F8FAFC]">
                {isVi ? 'Bộ nhớ đệm SHA-256 Diff' : 'SHA-256 Diff Caching'}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                {isVi
                  ? 'Bộ nhớ đệm LRU lưu hash diff đã đạt trong .git/guardian_cache.json. Giữ nguyên khi đổi nhánh.'
                  : 'LRU cache of passed diff hashes in .git/guardian_cache.json. Survives branch switches.'}
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-[#FFFFFF] dark:bg-[#111827] space-y-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[#C8102E]/10 text-[#C8102E] flex items-center justify-center font-bold border border-[#C8102E]/20">
                <CheckCircle2 size={20} />
              </div>
              <h3 className="text-base font-bold text-[#002060] dark:text-[#F8FAFC]">
                {isVi ? 'Bộ Test Đánh giá Evaluation' : 'Evaluation Suite'}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                {isVi
                  ? '100 test case mẫu chuẩn (eval/). Đạt 96.1% Recall, 94.2% Precision xác minh trên API thực tế.'
                  : '100-case golden dataset (eval/). 96.1% Recall, 94.2% Precision verified on real API.'}
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* 9. FOOTER / LEARN / PROJECT */}
      <footer className="border-t border-[#E2E8F0] dark:border-[#1F2937] bg-[#F8FAFC] dark:bg-[#0A0F1D] py-12 px-4 sm:px-8 mt-20 font-sans">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2 font-mono text-sm font-bold text-[#002060] dark:text-[#F8FAFC]">
              <QwoangIcon className="w-5 h-5 text-[#C8102E]" color="#C8102E" />
              <span>qwoang·guardian</span>
            </div>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
              {isVi
                ? '4 vòng kiểm tra độc lập mỗi push. Lập luận LLM dựa trên bằng chứng & kiểm định. Cài đặt 1 lệnh npm.'
                : '4 independent checks per push. Evidence-grounded + judge-verified LLM reasoning. One npm install.'}
            </p>
            <div className="text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8]">
              {isVi ? 'Phát triển bởi DoanQuang và cộng đồng.' : 'Made by DoanQuang and contributors.'}
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-2">
            <div className="font-mono text-xs font-bold text-[#002060] dark:text-[#F8FAFC] uppercase">
              {isVi ? 'HỌC TẬP' : 'LEARN'}
            </div>
            <ul className="space-y-1.5 text-xs text-[#64748B] dark:text-[#94A3B8] font-sans">
              <li>
                <button onClick={() => scrollToSection('self-analysis-demo')} className="hover:text-[#C8102E] cursor-pointer border-0 bg-transparent p-0">
                  {isVi ? 'Trình diễn Quick Start' : 'Quick Start Demo'}
                </button>
              </li>
              <li>
                <button onClick={() => scrollToSection('how-it-works')} className="hover:text-[#C8102E] cursor-pointer border-0 bg-transparent p-0">
                  {isVi ? '4 Cổng An ninh' : '4 Security Gates'}
                </button>
              </li>
              <li>
                <button onClick={() => scrollToSection('agent-with-map')} className="hover:text-[#C8102E] cursor-pointer border-0 bg-transparent p-0">
                  {isVi ? 'Bản đồ RAG-lite' : 'RAG-lite Context Map'}
                </button>
              </li>
              <li>
                <button onClick={() => scrollToSection('drift-in-ci')} className="hover:text-[#C8102E] cursor-pointer border-0 bg-transparent p-0">
                  {isVi ? 'Hướng dẫn Cổng CI/CD' : 'CI/CD Gate Guide'}
                </button>
              </li>
            </ul>
          </div>

          {/* Architecture */}
          <div className="space-y-2">
            <div className="font-mono text-xs font-bold text-[#002060] dark:text-[#F8FAFC] uppercase">
              {isVi ? 'DỰ ÁN' : 'PROJECT'}
            </div>
            <ul className="space-y-1.5 text-xs text-[#64748B] dark:text-[#94A3B8] font-sans">
              <li>
                <button onClick={() => navigate('/login')} className="hover:text-[#C8102E] cursor-pointer border-0 bg-transparent p-0">
                  {isVi ? 'Đăng nhập Web Dashboard' : 'Web Dashboard Login'}
                </button>
              </li>
              <li>
                <button onClick={() => scrollToSection('whats-in-the-box')} className="hover:text-[#C8102E] cursor-pointer border-0 bg-transparent p-0">
                  {isVi ? 'Ma trận OpenFGA RBAC' : 'OpenFGA RBAC Matrix'}
                </button>
              </li>
              <li>
                <a
                  href="https://github.com/dquangai/ai-dev-guardian"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#C8102E] flex items-center gap-1"
                >
                  <span>{isVi ? 'Mã nguồn GitHub' : 'GitHub Repository'}</span>
                  <ExternalLink size={11} />
                </a>
              </li>
              <li>
                <a
                  href="https://www.npmjs.com/package/ai-dev-guardian"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#C8102E] flex items-center gap-1"
                >
                  <span>{isVi ? 'Gói npm Package' : 'npm Package'}</span>
                  <ExternalLink size={11} />
                </a>
              </li>
            </ul>
          </div>

          {/* License & Status */}
          <div className="space-y-2">
            <div className="font-mono text-xs font-bold text-[#002060] dark:text-[#F8FAFC] uppercase">
              {isVi ? 'TRẠNG THÁI' : 'STATUS'}
            </div>
            <div className="space-y-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
              <div className="p-3 rounded-lg bg-[#FFFFFF] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1F2937] font-mono text-[11px] space-y-1">
                <div className="text-[#3FB950] font-bold">
                  {isVi ? '● Hệ thống Hoạt động Tốt' : '● System Operational'}
                </div>
                <div>Recall: 96.1% | Precision: 94.2%</div>
                <div>{isVi ? 'Giấy phép: MIT Mở' : 'License: MIT Open Source'}</div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
