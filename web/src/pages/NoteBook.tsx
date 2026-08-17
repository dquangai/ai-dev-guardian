import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  FileText,
  GitPullRequest,
  Key,
  ListChecks,
  Lock,
  Rocket,
  Shield,
  ShieldCheck,
  Terminal,
  UserCheck,
  Workflow,
} from 'lucide-react'
import { QwoangIcon } from '../components/ui/QwoangLogo'
import { TechGridCard } from '../components/ui/TechGridCard'

type TabType = 'overview' | 'setup' | 'policy' | 'ci' | 'bypass' | 'rbac' | 'demo' | 'rollout'

// Cho project RIÊNG của team (cài Guardian qua bản đã publish trên npm) — khác với
// .github/workflows/guardian.yml của chính repo ai-dev-guardian (repo đó build từ
// source `npm ci && npm run build`, không áp dụng cho team dùng bản publish).
const CI_WORKFLOW_YAML = `name: Guardian

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
          fetch-depth: 0   # cần full history để diff origin/<base>...HEAD

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

// Cùng 5 lệnh với 5 ô copy-paste bên dưới — chỉ để chạy animation demo, không map lại từ
// cùng 1 mảng để tránh phải sửa cấu trúc 5 ô đang hoạt động đúng (mỗi ô có id/label riêng).
const SETUP_DEMO_STEPS: { comment: string; cmd: string }[] = [
  { comment: '# 1. Cài CLI', cmd: 'npm install -g ai-dev-guardian' },
  { comment: '# 2. Khai báo API key vào .env', cmd: 'echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env' },
  { comment: '# 3. Cài git pre-push hook', cmd: 'guardian install-hook' },
  { comment: '# 4. Kiểm tra staged changes', cmd: 'guardian check --staged' },
  { comment: '# 5. Mở Dashboard quản lý', cmd: 'guardian dashboard' },
]

const TYPE_SPEED_MS = 32
const HOLD_AFTER_TYPE_MS = 1400
const GAP_BEFORE_NEXT_MS = 450

/** Terminal giả lập tự gõ tuần tự qua SETUP_DEMO_STEPS, lặp vô hạn — thuần CSS/state, không cần video/file ngoài. */
function SetupTerminalDemo() {
  const [stepIndex, setStepIndex] = useState(0)
  const [typedLength, setTypedLength] = useState(0)
  const [showCursor, setShowCursor] = useState(true)

  const step = SETUP_DEMO_STEPS[stepIndex]

  useEffect(() => {
    if (typedLength >= step.cmd.length) {
      const holdTimer = setTimeout(() => {
        setTypedLength(0)
        setStepIndex((i) => (i + 1) % SETUP_DEMO_STEPS.length)
      }, HOLD_AFTER_TYPE_MS + GAP_BEFORE_NEXT_MS)
      return () => clearTimeout(holdTimer)
    }
    const typeTimer = setTimeout(() => setTypedLength((n) => n + 1), TYPE_SPEED_MS)
    return () => clearTimeout(typeTimer)
  }, [typedLength, step.cmd.length])

  useEffect(() => {
    const blink = setInterval(() => setShowCursor((v) => !v), 500)
    return () => clearInterval(blink)
  }, [])

  const isDone = typedLength >= step.cmd.length

  return (
    <div className="rounded-lg bg-[#0D1117] border border-[#30363D] overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#30363D] bg-[#161B22]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
        <span className="ml-2 text-[10px] font-mono text-[#8B949E]">team-project — zsh</span>
      </div>
      <div className="p-4 font-mono text-xs sm:text-sm min-h-[76px]">
        <div className="text-[#8B949E]">{step.comment}</div>
        <div className="text-[#F0F6FC]">
          <span className="text-[#3FB950]">$</span>{' '}
          <span>{step.cmd.slice(0, typedLength)}</span>
          <span className={`inline-block w-[7px] h-[14px] -mb-[2px] ml-0.5 bg-[#F0F6FC] ${showCursor ? 'opacity-100' : 'opacity-0'}`} />
        </div>
        {isDone && (
          <div className="text-[#3FB950] mt-1">✓ ok</div>
        )}
      </div>
      <div className="flex items-center gap-1.5 px-3 pb-3 font-mono text-[10px] text-[#8B949E]">
        {SETUP_DEMO_STEPS.map((_, i) => (
          <span
            key={i}
            className={`h-1 rounded-full transition-all ${i === stepIndex ? 'w-4 bg-[#C8102E]' : 'w-1 bg-[#30363D]'}`}
          />
        ))}
      </div>
    </div>
  )
}

export function NoteBook() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null)

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCmd(label)
    setTimeout(() => setCopiedCmd(null), 2500)
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#09090B] text-[#111111] dark:text-[#F4F4F5] font-sans selection:bg-[#9E0B10] selection:text-white transition-colors">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 border-b border-[#D6D6D6] dark:border-[#27272A] bg-[#FFFFFF]/90 dark:bg-[#09090B]/90 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2 rounded border border-[#D6D6D6] dark:border-[#27272A] bg-[#F4F5F7] dark:bg-[#18181B] px-3 py-1.5 text-xs font-semibold text-[#111111] dark:text-[#F4F4F5] hover:bg-[#E5E7EB] dark:hover:bg-[#27272A] cursor-pointer transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Đăng nhập</span>
          </button>

          <div className="h-4 w-px bg-[#D6D6D6] dark:bg-[#27272A]" />

          <div className="flex items-center gap-2.5">
            <QwoangIcon className="w-6 h-6" color="#C8102E" />
            <div>
              <span className="font-bold text-sm tracking-wider text-[#111111] dark:text-[#F4F4F5] flex items-center gap-2 font-mono">
                GUARDIAN NOTEBOOK
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FFF1F2] dark:bg-rose-950/60 border border-[#C8102E]/30 text-[#C8102E] dark:text-rose-400">
                  DOCS v1.0
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[#666666] dark:text-[#A1A1AA]">
          <BookOpen size={15} className="text-[#C8102E]" />
          <span className="hidden sm:inline">HƯỚNG DẪN SỬ DỤNG HỆ THỐNG</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Banner Hero */}
        <div className="tech-grid-card relative p-6 border-l-4 border-l-[#C8102E] space-y-3">
          <div className="absolute top-[6px] left-[6px] w-[8px] h-[8px] border-t border-l border-[#C8102E] pointer-events-none opacity-80" />
          <div className="absolute top-[6px] right-[6px] w-[8px] h-[8px] border-t border-r border-[#C8102E] pointer-events-none opacity-80" />
          <div className="absolute bottom-[6px] left-[6px] w-[8px] h-[8px] border-b border-l border-[#C8102E] pointer-events-none opacity-80" />
          <div className="absolute bottom-[6px] right-[6px] w-[8px] h-[8px] border-b border-r border-[#C8102E] pointer-events-none opacity-80" />

          <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-wider text-[#C8102E] uppercase">
            <Terminal size={15} />
            <span>QWOANG SECURITY NOTEBOOK & KNOWLEDGE BASE</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight font-sans text-[#111111] dark:text-[#F4F4F5]">
            Sổ tay Hướng dẫn Sử dụng AI Dev Guardian
          </h1>
          <p className="text-xs text-[#555555] dark:text-[#A1A1AA] max-w-3xl leading-relaxed">
            Hệ thống Pre-push Code Governance tự động phát hiện vi phạm bảo mật, bí mật rò rỉ (Secrets), lỗi kiến trúc và quản lý chính sách cho toàn bộ lập trình viên.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#D6D6D6] dark:border-[#27272A] pb-3 text-xs font-mono font-semibold">
          {[
            { id: 'overview', label: '1. Tổng quan & Kiến trúc', icon: <Workflow size={14} /> },
            { id: 'setup', label: '2. Cài đặt cho Developer', icon: <Terminal size={14} /> },
            { id: 'policy', label: '3. Viết Policy riêng cho Team', icon: <FileText size={14} /> },
            { id: 'ci', label: '4. Tích hợp CI/CD', icon: <GitPullRequest size={14} /> },
            { id: 'bypass', label: '5. Quy trình Bypass', icon: <ShieldCheck size={14} /> },
            { id: 'rbac', label: '6. Phân quyền RBAC', icon: <UserCheck size={14} /> },
            { id: 'demo', label: '7. Tài khoản Demo', icon: <Key size={14} /> },
            { id: 'rollout', label: '8. Đưa vào Vận hành Team', icon: <ListChecks size={14} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded transition-all cursor-pointer border ${
                activeTab === tab.id
                  ? 'bg-[#111111] text-white border-[#111111] dark:bg-[#F4F4F5] dark:text-[#09090B] dark:border-[#F4F4F5] shadow-xs'
                  : 'bg-[#FFFFFF] text-[#555555] border-[#D6D6D6] hover:bg-[#F4F5F7] dark:bg-[#18181B] dark:text-[#A1A1AA] dark:border-[#27272A] dark:hover:bg-[#27272A]'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TechGridCard
                category="CHỨC NĂNG CHÍNH"
                title="Pre-push Governance Gate"
                description="Chặn các commit chứa lỗi bảo mật, SQL Injection, Hard-coded Secrets trước khi code được đẩy lên Git repository."
                icon={<Shield size={16} />}
              />
              <TechGridCard
                category="CÔNG NGHỆ CORE"
                title="LLM Policy Engine"
                description="Sử dụng LLM kết hợp với AST-Grep static analysis để quét chính xác ngữ cảnh vi phạm với tỉ lệ Precision > 85%."
                icon={<Code2 size={16} />}
              />
              <TechGridCard
                category="QUẢN TRỊ NÂNG CAO"
                title="Multi-Team RBAC & OpenFGA"
                description="Phân quyền bảo mật 5 cấp độ (Super Admin, Admin, Senior Dev, Developer, Auditor) kết hợp ReBAC qua OpenFGA."
                icon={<Rocket size={16} />}
              />
            </div>

            <div className="tech-grid-card p-6 space-y-4">
              <h3 className="text-base font-bold font-sans flex items-center gap-2">
                <Workflow size={16} className="text-[#C8102E]" />
                4 vòng kiểm tra độc lập chạy mỗi lần push
              </h3>
              <p className="text-xs text-[#555555] dark:text-[#A1A1AA] leading-relaxed font-sans">
                <code className="font-mono bg-[#F4F5F7] dark:bg-[#27272A] px-1 py-0.5 rounded">guardian check</code> chạy
                cả 4 vòng trên diff hiện tại rồi gộp kết quả thành 1 verdict PASS/BLOCK — không phải pipeline nhiều
                giai đoạn tách rời, cả 4 chạy trong cùng 1 lệnh.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
                {[
                  { tag: 'DETERMINISTIC', title: 'Secret Scan', desc: 'Regex quét AWS key, API key, private key... — không qua LLM, luôn chạy được kể cả thiếu API key.' },
                  { tag: 'DETERMINISTIC', title: 'Architecture Check', desc: 'madge phát hiện circular dependency + rule from/forbid tự định nghĩa trong policy kiến trúc.' },
                  { tag: 'OPTIONAL', title: 'Semgrep', desc: 'Static analysis theo bộ rule p/security-audit — chỉ chạy nếu máy có cài semgrep (pip install semgrep).' },
                  { tag: 'LLM + JUDGE', title: 'LLM Policy Check', desc: 'Đối chiếu diff với từng .policy.md, mọi claim vi phạm phải bằng chứng thật trong diff + qua judge lượt 2 mới được báo.' },
                ].map((item) => (
                  <div key={item.title} className="p-3.5 rounded bg-[#F4F5F7] dark:bg-[#09090B] border border-[#D6D6D6] dark:border-[#27272A] space-y-1">
                    <div className="text-[#C8102E] font-bold text-[10px] tracking-wider">{item.tag}</div>
                    <div className="font-semibold font-sans text-sm text-[#111111] dark:text-[#F4F4F5]">{item.title}</div>
                    <div className="text-[11px] text-[#666666] dark:text-[#A1A1AA] font-sans">{item.desc}</div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-[#666666] dark:text-[#A1A1AA] font-sans italic">
                Thiếu <code className="font-mono">ANTHROPIC_API_KEY</code>/<code className="font-mono">OPENAI_API_KEY</code>?
                3 vòng deterministic/optional vẫn chạy bình thường, chỉ riêng LLM Policy Check tự bỏ qua (fail-open) —
                không làm hỏng cả lệnh.
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Setup cho Developer */}
        {activeTab === 'setup' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="tech-grid-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E5E5] dark:border-[#27272A] pb-3">
                <h3 className="text-base font-bold font-sans flex items-center gap-2">
                  <Terminal size={16} className="text-[#C8102E]" />
                  5 bước cài đặt cho từng Developer trong Team — áp dụng vào project riêng của team
                </h3>
                <span className="font-mono text-xs text-[#666666] dark:text-[#A1A1AA]">CLI GATEKEEPER</span>
              </div>

              <p className="text-[11px] text-[#555555] dark:text-[#A1A1AA] font-sans leading-relaxed">
                5 bước dưới đây làm trên chính <strong>project của team bạn</strong> (repo code các bạn đang làm việc
                hằng ngày) — Guardian được cài như 1 CLI tool đứng ngoài, không cần sửa gì trong source code của
                project.
              </p>

              <SetupTerminalDemo />

              <div className="space-y-4 font-mono text-xs">
                {/* Cmd 1 */}
                <div className="p-4 rounded bg-[#0D1117] text-[#F0F6FC] border border-[#30363D] space-y-2">
                  <div className="flex items-center justify-between text-[#8B949E]">
                    <span>1. Cài CLI (chạy 1 lần, dùng chung cho mọi project trên máy)</span>
                    <button
                      onClick={() => handleCopy('npm install -g ai-dev-guardian', 'cmd1')}
                      className="inline-flex items-center gap-1.5 text-[11px] text-[#58A6FF] hover:underline cursor-pointer border-0 bg-transparent"
                    >
                      {copiedCmd === 'cmd1' ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedCmd === 'cmd1' ? 'Đã chép' : 'Sao chép'}</span>
                    </button>
                  </div>
                  <code className="block text-[#3FB950] font-bold text-sm">
                    npm install -g ai-dev-guardian
                  </code>
                </div>

                {/* Cmd 2 */}
                <div className="p-4 rounded bg-[#0D1117] text-[#F0F6FC] border border-[#30363D] space-y-2">
                  <div className="flex items-center justify-between text-[#8B949E]">
                    <span>2. Vào thư mục gốc project của bạn, khai báo API key LLM vào .env (nhớ thêm .env vào .gitignore nếu chưa có)</span>
                    <button
                      onClick={() => handleCopy('echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env', 'cmd2')}
                      className="inline-flex items-center gap-1.5 text-[11px] text-[#58A6FF] hover:underline cursor-pointer border-0 bg-transparent"
                    >
                      {copiedCmd === 'cmd2' ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedCmd === 'cmd2' ? 'Đã chép' : 'Sao chép'}</span>
                    </button>
                  </div>
                  <code className="block text-[#3FB950] font-bold text-sm">
                    echo "ANTHROPIC_API_KEY=sk-ant-..." &gt;&gt; .env
                  </code>
                </div>

                {/* Cmd 3 */}
                <div className="p-4 rounded bg-[#0D1117] text-[#F0F6FC] border border-[#30363D] space-y-2">
                  <div className="flex items-center justify-between text-[#8B949E]">
                    <span>3. Cài git pre-push hook — mỗi lần `git push` tự hỏi và chạy check</span>
                    <button
                      onClick={() => handleCopy('guardian install-hook', 'cmd3')}
                      className="inline-flex items-center gap-1.5 text-[11px] text-[#58A6FF] hover:underline cursor-pointer border-0 bg-transparent"
                    >
                      {copiedCmd === 'cmd3' ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedCmd === 'cmd3' ? 'Đã chép' : 'Sao chép'}</span>
                    </button>
                  </div>
                  <code className="block text-[#3FB950] font-bold text-sm">
                    guardian install-hook
                  </code>
                </div>

                {/* Cmd 4 */}
                <div className="p-4 rounded bg-[#0D1117] text-[#F0F6FC] border border-[#30363D] space-y-2">
                  <div className="flex items-center justify-between text-[#8B949E]">
                    <span>4. Kiểm tra tay staged changes trước khi commit (không cần chờ push)</span>
                    <button
                      onClick={() => handleCopy('guardian check --staged', 'cmd4')}
                      className="inline-flex items-center gap-1.5 text-[11px] text-[#58A6FF] hover:underline cursor-pointer border-0 bg-transparent"
                    >
                      {copiedCmd === 'cmd4' ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedCmd === 'cmd4' ? 'Đã chép' : 'Sao chép'}</span>
                    </button>
                  </div>
                  <code className="block text-[#3FB950] font-bold text-sm">
                    guardian check --staged
                  </code>
                </div>

                {/* Cmd 5 */}
                <div className="p-4 rounded bg-[#0D1117] text-[#F0F6FC] border border-[#30363D] space-y-2">
                  <div className="flex items-center justify-between text-[#8B949E]">
                    <span>5. Tuỳ chọn: mở Dashboard quản lý policy/audit trên máy local</span>
                    <button
                      onClick={() => handleCopy('guardian dashboard', 'cmd5')}
                      className="inline-flex items-center gap-1.5 text-[11px] text-[#58A6FF] hover:underline cursor-pointer border-0 bg-transparent"
                    >
                      {copiedCmd === 'cmd5' ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedCmd === 'cmd5' ? 'Đã chép' : 'Sao chép'}</span>
                    </button>
                  </div>
                  <code className="block text-[#3FB950] font-bold text-sm">
                    guardian dashboard
                  </code>
                </div>
              </div>
              <p className="text-[11px] text-[#666666] dark:text-[#A1A1AA] font-sans italic pt-1">
                Không set API key vẫn dùng được — Secret Scan/Architecture Check/Semgrep chạy bình thường, chỉ LLM
                Policy Check tự bỏ qua và in cảnh báo.
              </p>
            </div>
          </div>
        )}

        {/* Tab 3: Viết Policy riêng cho Team */}
        {activeTab === 'policy' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="tech-grid-card p-6 space-y-4">
              <h3 className="text-base font-bold font-sans flex items-center gap-2">
                <FileText size={16} className="text-[#C8102E]" />
                Policy riêng của Team nằm ở đâu, viết thế nào
              </h3>
              <p className="text-xs text-[#555555] dark:text-[#A1A1AA] leading-relaxed font-sans">
                Tạo thư mục <code className="font-mono bg-[#F4F5F7] dark:bg-[#27272A] px-1 py-0.5 rounded">.guardian/policies/</code> ở
                gốc project của bạn, mỗi file <code className="font-mono bg-[#F4F5F7] dark:bg-[#27272A] px-1 py-0.5 rounded">*.policy.md</code> trong
                đó là 1 policy độc lập — LLM Policy Check đọc toàn bộ các file này (trừ file bắt đầu bằng <code className="font-mono">_</code>)
                và chỉ đối chiếu policy nào có <code className="font-mono">scope</code> khớp file trong diff đang kiểm tra.
                Repo <code className="font-mono">ai-dev-guardian</code> có sẵn 11 policy mẫu bạn có thể copy về chỉnh lại
                cho phù hợp thay vì viết từ đầu:
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 font-mono text-[11px]">
                {[
                  'security', 'coding-convention', 'dead-code', 'dependency',
                  'disabled-security-control', 'import-rules', 'logging',
                  'naming-convention', 'performance', 'rbac', 'architecture',
                ].map((name) => (
                  <div key={name} className="px-2.5 py-1.5 rounded bg-[#F4F5F7] dark:bg-[#09090B] border border-[#D6D6D6] dark:border-[#27272A] text-center">
                    {name}.policy.md
                  </div>
                ))}
              </div>

              <div className="pt-2 space-y-2">
                <div className="text-xs font-bold font-sans">Frontmatter bắt buộc ở đầu mỗi file .policy.md</div>
                <div className="p-4 rounded bg-[#0D1117] text-[#F0F6FC] border border-[#30363D] font-mono text-[11px] leading-relaxed overflow-x-auto">
                  <pre className="whitespace-pre">{`---
category: "Session Management"          # tên hiển thị trên dashboard
scope: ["**/*.ts", "**/*.tsx"]          # glob — [] rỗng = áp dụng MỌI file
severity: high                          # low | medium | high | critical
tags: [enterprise-standard]             # tự do, chỉ để lọc/tìm kiếm
---`}</pre>
                </div>
                <p className="text-[11px] text-[#666666] dark:text-[#A1A1AA] font-sans">
                  <code className="font-mono">severity: low</code> chỉ cảnh báo, không chặn push — <code className="font-mono">medium</code> trở
                  lên mới BLOCK. Copy từ <code className="font-mono">_template.policy.md</code> (bị loader bỏ qua có
                  chủ đích vì tên bắt đầu bằng <code className="font-mono">_</code>) rồi đổi tên bỏ dấu gạch dưới.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: CI/CD Integration */}
        {activeTab === 'ci' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="tech-grid-card p-6 space-y-4">
              <h3 className="text-base font-bold font-sans flex items-center gap-2">
                <GitPullRequest size={16} className="text-[#C8102E]" />
                Bắt buộc kiểm tra ngay trên mọi Pull Request
              </h3>
              <p className="text-xs text-[#555555] dark:text-[#A1A1AA] leading-relaxed font-sans">
                Repo project của bạn chưa có sẵn workflow này — Team Lead tạo file
                {' '}<code className="font-mono bg-[#F4F5F7] dark:bg-[#27272A] px-1 py-0.5 rounded">.github/workflows/guardian.yml</code> mới
                trong repo với nội dung dưới đây, commit lên, rồi set 2 secret ở GitHub repo (Settings → Secrets and
                variables → Actions) là chạy được — không cần cài Node/npm packages nào thêm, workflow tự lo.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-4 rounded bg-[#F4F5F7] dark:bg-[#09090B] border border-[#D6D6D6] dark:border-[#27272A] space-y-2">
                  <span className="text-[#C8102E] font-bold">SECRET</span>
                  <div className="font-bold text-[#111111] dark:text-[#F4F4F5] font-sans">ANTHROPIC_API_KEY hoặc OPENAI_API_KEY</div>
                  <div className="text-[11px] text-[#666666] dark:text-[#A1A1AA] font-sans">Chỉ cần 1 trong 2. Thiếu cả hai: workflow vẫn chạy, LLM Policy Check tự bỏ qua.</div>
                </div>
                <div className="p-4 rounded bg-[#F4F5F7] dark:bg-[#09090B] border border-[#D6D6D6] dark:border-[#27272A] space-y-2">
                  <span className="text-[#C8102E] font-bold">BUILT-IN</span>
                  <div className="font-bold text-[#111111] dark:text-[#F4F4F5] font-sans">GITHUB_TOKEN</div>
                  <div className="text-[11px] text-[#666666] dark:text-[#A1A1AA] font-sans">GitHub Actions tự cấp — dùng để post/update comment kết quả trực tiếp trên PR.</div>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold font-sans">Copy nguyên file này vào .github/workflows/guardian.yml</div>
                  <button
                    onClick={() => handleCopy(CI_WORKFLOW_YAML, 'ci-yaml')}
                    className="inline-flex items-center gap-1.5 text-[11px] text-[#58A6FF] hover:underline cursor-pointer border-0 bg-transparent"
                  >
                    {copiedCmd === 'ci-yaml' ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedCmd === 'ci-yaml' ? 'Đã chép' : 'Sao chép'}</span>
                  </button>
                </div>
                <div className="p-4 rounded bg-[#0D1117] text-[#F0F6FC] border border-[#30363D] font-mono text-[11px] leading-relaxed overflow-x-auto">
                  <pre className="whitespace-pre">{CI_WORKFLOW_YAML}</pre>
                </div>
                <p className="text-[11px] text-[#666666] dark:text-[#A1A1AA] font-sans">
                  Diff PR (<code className="font-mono">origin/&lt;base&gt;...HEAD</code>), post comment kết quả lên PR, exit
                  code 1 nếu verdict = BLOCK → job đỏ. Muốn job đỏ thật sự chặn merge: vào Settings → Branches →
                  Branch protection rule, thêm job <code className="font-mono">guardian-check</code> vào required
                  status checks.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Bypass Workflow */}
        {activeTab === 'bypass' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="tech-grid-card p-6 space-y-4">
              <h3 className="text-base font-bold font-sans flex items-center gap-2">
                <ShieldCheck size={16} className="text-[#C8102E]" />
                Quy trình Xin cấp quyền Ngoại lệ (Bypass Request)
              </h3>
              <p className="text-xs text-[#555555] dark:text-[#A1A1AA] leading-relaxed font-sans">
                Trong trường hợp mã nguồn bị vi phạm nhưng thuộc tình huống đặc biệt (vd: hotfix cấp bách hoặc bẫy thử nghiệm), lập trình viên có thể gửi đơn Bypass để Tech Lead hoặc Admin phê duyệt.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-4 rounded bg-[#F4F5F7] dark:bg-[#09090B] border border-[#D6D6D6] dark:border-[#27272A] space-y-2">
                  <span className="text-[#C8102E] font-bold">BƯỚC 1</span>
                  <div className="font-bold text-[#111111] dark:text-[#F4F4F5] font-sans">Commit bị block</div>
                  <div className="text-[11px] text-[#666666] dark:text-[#A1A1AA] font-sans">CLI hiển thị cảnh báo lỗi vi phạm policy.</div>
                </div>

                <div className="p-4 rounded bg-[#F4F5F7] dark:bg-[#09090B] border border-[#D6D6D6] dark:border-[#27272A] space-y-2">
                  <span className="text-[#C8102E] font-bold">BƯỚC 2</span>
                  <div className="font-bold text-[#111111] dark:text-[#F4F4F5] font-sans">Form hiện ngay tại chỗ</div>
                  <div className="text-[11px] text-[#666666] dark:text-[#A1A1AA] font-sans">Trên trang Findings, ngay dưới kết quả BLOCK — không cần điều hướng đi đâu khác.</div>
                </div>

                <div className="p-4 rounded bg-[#F4F5F7] dark:bg-[#09090B] border border-[#D6D6D6] dark:border-[#27272A] space-y-2">
                  <span className="text-[#C8102E] font-bold">BƯỚC 3</span>
                  <div className="font-bold text-[#111111] dark:text-[#F4F4F5] font-sans">Điền lý do & Submit</div>
                  <div className="text-[11px] text-[#666666] dark:text-[#A1A1AA] font-sans">Nhập giải trình ngoại lệ, bấm "Submit Bypass Request" — trạng thái "pending" chờ duyệt.</div>
                </div>

                <div className="p-4 rounded bg-[#F4F5F7] dark:bg-[#09090B] border border-[#D6D6D6] dark:border-[#27272A] space-y-2">
                  <span className="text-[#C8102E] font-bold">BƯỚC 4</span>
                  <div className="font-bold text-[#111111] dark:text-[#F4F4F5] font-sans">Senior Dev/Admin duyệt</div>
                  <div className="text-[11px] text-[#666666] dark:text-[#A1A1AA] font-sans">Tại "Bypass Approvals Hub" — approve/reject kèm ghi chú, chỉ role có quyền bypass:approve mới thấy trang này.</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: RBAC */}
        {activeTab === 'rbac' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="tech-grid-card p-6 space-y-4">
              <h3 className="text-base font-bold font-sans flex items-center gap-2">
                <UserCheck size={16} className="text-[#C8102E]" />
                Ma trận Phân quyền Vai trò (RBAC Permissions Matrix)
              </h3>

              <div className="overflow-x-auto rounded border border-[#D6D6D6] dark:border-[#27272A]">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-[#F4F5F7] dark:bg-[#18181B] text-[#111111] dark:text-[#F4F4F5] font-mono border-b border-[#D6D6D6] dark:border-[#27272A]">
                    <tr>
                      <th className="p-3">Vai trò (Role)</th>
                      <th className="p-3">Tên hiển thị</th>
                      <th className="p-3">Quyền hạn chính</th>
                      <th className="p-3">Phạm vi truy cập</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E5] dark:divide-[#27272A]">
                    <tr>
                      <td className="p-3 font-mono font-bold text-[#C8102E]">super-admin</td>
                      <td className="p-3 font-semibold">Super Admin</td>
                      <td className="p-3">Quản trị toàn bộ hệ thống, quản lý team & phân quyền OpenFGA</td>
                      <td className="p-3 font-mono text-[11px]">Toàn quyền hệ thống</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-bold text-[#111111] dark:text-[#F4F4F5]">admin</td>
                      <td className="p-3 font-semibold">Security Admin</td>
                      <td className="p-3">Cấu hình Engine, duyệt chính sách & quản lý vi phạm của Team</td>
                      <td className="p-3 font-mono text-[11px]">Phạm vi Team</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-bold text-[#111111] dark:text-[#F4F4F5]">senior-dev</td>
                      <td className="p-3 font-semibold">Tech Lead</td>
                      <td className="p-3">Duyệt đơn Bypass, đề xuất chính sách mới (Propose Policy)</td>
                      <td className="p-3 font-mono text-[11px]">Phạm vi Team</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-bold text-[#111111] dark:text-[#F4F4F5]">developer</td>
                      <td className="p-3 font-semibold">Developer</td>
                      <td className="p-3">Xem danh sách commit bị chặn, gửi đơn Bypass & Copy AI Fix Prompt</td>
                      <td className="p-3 font-mono text-[11px]">Phạm vi Cá nhân</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-bold text-[#111111] dark:text-[#F4F4F5]">auditor</td>
                      <td className="p-3 font-semibold">Auditor</td>
                      <td className="p-3">Xem báo cáo Audit Trail, lịch sử tuân thủ (Chế độ Read-only)</td>
                      <td className="p-3 font-mono text-[11px]">Read-only</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Demo Accounts */}
        {activeTab === 'demo' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="tech-grid-card p-6 space-y-4">
              <h3 className="text-base font-bold font-sans flex items-center gap-2">
                <Lock size={16} className="text-[#C8102E]" />
                Danh sách Tài khoản Demo dùng thử
              </h3>
              <p className="text-xs text-[#555555] dark:text-[#A1A1AA] font-sans">
                Bạn có thể sử dụng các tài khoản mẫu dưới đây (hoặc click chọn nút Demo Role ở trang Login) với mật khẩu chung. Mật khẩu này đọc từ biến môi trường <code className="font-mono bg-[#F4F5F7] dark:bg-[#27272A] px-1.5 py-0.5 rounded border border-[#D6D6D6] dark:border-[#3F3F46] font-bold">GUARDIAN_DEMO_PASSWORD</code> trong <code className="font-mono">.env</code> của server đang chạy — giá trị dưới đây là mặc định của môi trường này, có thể khác nếu Team Lead đổi cấu hình.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 font-mono text-xs">
                {[
                  { role: 'Super Admin', email: 'super.admin@guardian.dev', pass: 'demo1234' },
                  { role: 'Security Admin', email: 'admin@guardian.dev', pass: 'demo1234' },
                  { role: 'Tech Lead', email: 'senior.dev@guardian.dev', pass: 'demo1234' },
                  { role: 'Developer', email: 'dev@guardian.dev', pass: 'demo1234' },
                  { role: 'Auditor', email: 'auditor@guardian.dev', pass: 'demo1234' },
                ].map((item) => (
                  <div key={item.email} className="p-4 rounded bg-[#FFFFFF] dark:bg-[#09090B] border border-[#D6D6D6] dark:border-[#27272A] space-y-2">
                    <div className="flex items-center justify-between text-[#C8102E] font-bold font-sans">
                      <span>{item.role}</span>
                      <CheckCircle2 size={14} />
                    </div>
                    <div className="space-y-1 text-[11px]">
                      <div className="text-[#666666] dark:text-[#A1A1AA]">Email: <span className="text-[#111111] dark:text-[#F4F4F5] font-semibold">{item.email}</span></div>
                      <div className="text-[#666666] dark:text-[#A1A1AA]">Mật khẩu: <span className="text-[#111111] dark:text-[#F4F4F5] font-semibold">{item.pass}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: Rollout Checklist */}
        {activeTab === 'rollout' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="tech-grid-card p-6 space-y-4">
              <h3 className="text-base font-bold font-sans flex items-center gap-2">
                <ListChecks size={16} className="text-[#C8102E]" />
                Checklist đưa Guardian vào vận hành thật cho 1 Team/Dự án
              </h3>
              <p className="text-xs text-[#555555] dark:text-[#A1A1AA] leading-relaxed font-sans">
                Dành cho Tech Lead/Admin lần đầu roll-out Guardian cho 1 team đang có sẵn codebase —
                khác với các mục kỹ thuật ở trên (cài 1 máy, viết 1 policy, bật 1 workflow), đây là
                thứ tự và những điều cần cân nhắc khi đưa cả team vào vận hành thật, không phải máy demo.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-4 rounded bg-[#F4F5F7] dark:bg-[#09090B] border border-[#D6D6D6] dark:border-[#27272A] space-y-2">
                  <span className="text-[#C8102E] font-bold">BƯỚC 1 — Cài đặt hàng loạt</span>
                  <div className="font-bold text-[#111111] dark:text-[#F4F4F5] font-sans">100% máy trong team cài hook trước khi bật gate bắt buộc</div>
                  <div className="text-[11px] text-[#666666] dark:text-[#A1A1AA] font-sans">
                    Mỗi dev tự cài theo mục "2. Cài đặt cho Developer" ở trên. Nếu chỉ 1–2 người cài,
                    phần còn lại vẫn push được vi phạm mà không ai biết — gate CI (bước 3) không thay
                    thế được, nó chỉ chặn ở PR, không chặn lúc <code>git push</code> lên nhánh cá nhân.
                  </div>
                </div>

                <div className="p-4 rounded bg-[#F4F5F7] dark:bg-[#09090B] border border-[#D6D6D6] dark:border-[#27272A] space-y-2">
                  <span className="text-[#C8102E] font-bold">BƯỚC 2 — Policy khớp thực tế</span>
                  <div className="font-bold text-[#111111] dark:text-[#F4F4F5] font-sans">Viết từ lỗi thật đã từng gặp, không viết tưởng tượng</div>
                  <div className="text-[11px] text-[#666666] dark:text-[#A1A1AA] font-sans">
                    Copy 1 file mẫu (mục "3. Viết Policy riêng cho Team"), sửa theo đúng loại lỗi
                    project đã từng dính, cho ít nhất 1 Senior Dev review trước khi merge. Policy quá
                    chặt/sai ngữ cảnh sẽ làm cả team spam Bypass Request ngay tuần đầu.
                  </div>
                </div>

                <div className="p-4 rounded bg-[#F4F5F7] dark:bg-[#09090B] border border-[#D6D6D6] dark:border-[#27272A] space-y-2">
                  <span className="text-[#C8102E] font-bold">BƯỚC 3 — Gate cảnh báo trước, bắt buộc sau</span>
                  <div className="font-bold text-[#111111] dark:text-[#F4F4F5] font-sans">Đừng bật Required status check ngay ngày 1</div>
                  <div className="text-[11px] text-[#666666] dark:text-[#A1A1AA] font-sans">
                    Thêm workflow (mục "4. Tích hợp CI/CD") nhưng để job chạy song song vài ngày trước
                    — quan sát tỉ lệ false positive thật trên PR thật, chỉ thêm vào Required status
                    checks (Settings → Branches) sau khi team đã quen và policy đã ổn định.
                  </div>
                </div>

                <div className="p-4 rounded bg-[#F4F5F7] dark:bg-[#09090B] border border-[#D6D6D6] dark:border-[#27272A] space-y-2">
                  <span className="text-[#C8102E] font-bold">BƯỚC 4 — Gán đúng vai trò, không phát hết admin</span>
                  <div className="font-bold text-[#111111] dark:text-[#F4F4F5] font-sans">Chỉ 1–2 người thật có quyền duyệt</div>
                  <div className="text-[11px] text-[#666666] dark:text-[#A1A1AA] font-sans">
                    Theo ma trận ở mục "6. Phân quyền RBAC": chỉ Admin/Senior Dev thật mới duyệt Policy
                    Change/Bypass Request, còn lại để <code>developer</code>. Nhiều team dùng chung 1
                    Dashboard → cân nhắc bật OpenFGA multi-team (xem <code>authz/README.md</code>) để
                    team này không thấy/sửa được policy của team khác.
                  </div>
                </div>

                <div className="p-4 rounded bg-[#F4F5F7] dark:bg-[#09090B] border border-[#D6D6D6] dark:border-[#27272A] space-y-2 md:col-span-2">
                  <span className="text-[#C8102E] font-bold">BƯỚC 5 — Review định kỳ, không "bật rồi bỏ quên"</span>
                  <div className="font-bold text-[#111111] dark:text-[#F4F4F5] font-sans">Ít nhất theo tuần trong tháng đầu vận hành</div>
                  <div className="text-[11px] text-[#666666] dark:text-[#A1A1AA] font-sans">
                    Đọc lại Audit History và các Bypass Request đã duyệt — dấu hiệu policy đang quá lỏng
                    (vi phạm thật lọt qua) hoặc quá chặt (bypass liên tục vì 1 lý do lặp lại) đều nằm ở
                    đây. Cập nhật lại file <code>.guardian/policies/*.md</code> theo đúng luồng duyệt ở
                    mục "3", không sửa tay ngoài Dashboard rồi quên đồng bộ Git cho cả team.
                  </div>
                </div>
              </div>

              <div className="p-4 rounded bg-[#FFF7ED] dark:bg-[#1C1410] border border-[#FDBA74] dark:border-[#7C4A1E] text-[11px] font-sans text-[#7C4A1E] dark:text-[#FDBA74] leading-relaxed">
                <strong className="font-bold">Coi là "live" khi cả 5 bước trên đều xong</strong> — không
                chỉ khi CI workflow chạy được lần đầu. Một team chỉ mới bật CI Gate nhưng chưa đồng bộ
                cài đặt cho toàn bộ máy (bước 1) hoặc chưa gán đúng người duyệt (bước 4) vẫn còn lỗ hổng
                để vi phạm lọt qua mà không ai nhận trách nhiệm xử lý.
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
