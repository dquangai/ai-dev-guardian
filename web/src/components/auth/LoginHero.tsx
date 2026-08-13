import { useState, useEffect } from 'react'
import { CheckCircle2, Key, Shield } from 'lucide-react'
import { QwoangIcon } from '../ui/QwoangLogo'

const INITIAL_LOGS = [
  { timeOffset: 16, action: 'policy.check: secret-scan', status: 'PASSED', isBlocked: false },
  { timeOffset: 12, action: 'policy.check: dependency-rules', status: 'PASSED', isBlocked: false },
  { timeOffset: 6, action: 'policy.check: architecture-rules', status: 'PASSED', isBlocked: false },
  { timeOffset: 0, action: 'policy.check: llm-policy-check', status: 'BLOCKED', isBlocked: true },
]

function formatTime(date: Date, offsetSeconds: number) {
  const d = new Date(date.getTime() - offsetSeconds * 1000)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export function LoginHero() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
    }, 2000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="relative hidden overflow-hidden bg-[#F8F9FA] px-12 py-14 text-[#111111] lg:flex lg:w-1/2 lg:flex-col lg:justify-between border-r border-[#D6D6D6]">
      {/* Background Engineering Grid */}
      <div 
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(229, 229, 229, 0.8) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(229, 229, 229, 0.8) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      />

      {/* Red Corner Bracket Accents */}
      <div className="pointer-events-none absolute top-4 left-4 h-3 w-3 border-t-2 border-l-2 border-[#C8102E]" />
      <div className="pointer-events-none absolute top-4 right-4 h-3 w-3 border-t-2 border-r-2 border-[#C8102E]" />
      <div className="pointer-events-none absolute bottom-4 left-4 h-3 w-3 border-b-2 border-l-2 border-[#C8102E]" />
      <div className="pointer-events-none absolute bottom-4 right-4 h-3 w-3 border-b-2 border-r-2 border-[#C8102E]" />

      {/* Header (QWOANG corporate branding) */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <QwoangIcon className="w-7 h-7" color="#111111" />
          <div>
            <span className="block text-sm font-bold tracking-[0.25em] text-[#111111]">QWOANG</span>
            <span className="block text-[9px] font-medium tracking-[0.12em] text-[#666666] uppercase">
              AI Security Division
            </span>
          </div>
        </div>
      </div>

      {/* Middle Content */}
      <div className="relative z-10 my-auto flex flex-col gap-8 py-6">
        <div className="space-y-2.5">
          <span className="font-mono text-xs font-semibold tracking-wider text-[#C8102E] block">
            {'</>'} ENTERPRISE EDITION
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#111111] font-sans">
            QWOANG AI GUARDIAN
          </h1>
          <p className="text-sm text-[#555555] max-w-md leading-relaxed">
            Hệ thống giám sát tuân thủ mã nguồn và chính sách an toàn thông tin tự động, bảo vệ toàn diện chu kỳ phát triển phần mềm của QWOANG.
          </p>
        </div>

        {/* Real-time Monitor Console (macOS Dark Code Terminal Style + Tech Scanline) */}
        <div className="relative overflow-hidden rounded-[10px] border border-[#30363D] bg-[#0D1117] p-5 shadow-xl transition-all duration-200 hover:border-[#58A6FF]/40">
          {/* Continuous Terminal Laser Scanline Beam */}
          <div className="terminal-scanline" />

          {/* macOS Terminal Window Titlebar */}
          <div className="mb-4 flex items-center justify-between border-b border-[#30363D] pb-3">
            {/* macOS 3 Window Control Dots */}
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#FF5F56] transition-opacity hover:opacity-80 inline-block" />
              <span className="h-3 w-3 rounded-full bg-[#FFBD2E] transition-opacity hover:opacity-80 inline-block" />
              <span className="h-3 w-3 rounded-full bg-[#27C93F] transition-opacity hover:opacity-80 inline-block" />
              <span className="ml-2 font-mono text-xs font-semibold text-[#8B949E]">
                zsh — <span className="text-[#F0F6FC]">guardian check --staged</span> <span className="animate-pulse font-extrabold text-[#FF7B72]">_</span>
              </span>
            </div>

            {/* Pulsing Active Guard Radar Ping Dot */}
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3FB950] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3FB950]" />
              </span>
              <span className="font-mono text-[10px] font-bold text-[#3FB950] uppercase tracking-wider">
                ACTIVE GUARD
              </span>
            </div>
          </div>

          {/* Terminal Console Logs */}
          <div className="space-y-3 font-mono text-[11px]">
            {INITIAL_LOGS.map((log, i) => (
              <div key={i} className="flex items-center justify-between text-[#F0F6FC] transition-colors hover:bg-[#161B22] px-1.5 py-0.5 rounded">
                <div className="flex items-center gap-3">
                  <span className="text-[#8B949E]">[{formatTime(now, log.timeOffset)}]</span>
                  <span className="text-[#E6EDE3]">{log.action}</span>
                </div>
                {log.isBlocked ? (
                  <span className="font-bold text-[#FF7B72] tracking-wider uppercase animate-pulse">{log.status}</span>
                ) : (
                  <span className="font-bold text-[#3FB950] tracking-wider uppercase">{log.status}</span>
                )}
              </div>
            ))}
          </div>

          {/* Warning Callout Card (macOS Terminal Dark) */}
          <div className="mt-4 rounded-[6px] border border-[#FF7B72]/30 bg-[#161B22] p-3.5 flex items-start gap-3 transition-colors hover:border-[#FF7B72]/60">
            <Shield size={16} className="text-[#FF7B72] mt-0.5 shrink-0 animate-pulse" />
            <div className="text-xs text-[#C9D1D9] leading-relaxed font-sans">
              <strong className="text-[#F0F6FC] font-semibold">Cảnh báo đẩy:</strong> Phát hiện vi phạm quy tắc kiến trúc trong file <code className="bg-[#21262D] px-1.5 py-0.5 rounded text-[#FF7B72] font-mono text-[11px] border border-[#30363D]">rbac.ts</code>. Đã chặn commit thành công.
            </div>
          </div>
        </div>

        {/* Bottom Stats Grid */}
        <div className="grid grid-cols-3 gap-4 border-t border-[#E5E5E5] pt-5">
          <div className="flex items-start gap-2.5">
            <Shield size={20} className="text-[#111111] mt-0.5 shrink-0" />
            <div>
              <div className="text-lg font-extrabold text-[#111111] leading-none">100%</div>
              <div className="text-[9px] font-mono text-[#666666] uppercase tracking-wider mt-1.5">
                PRE-PUSH VERIFICATION
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 border-l border-[#E5E5E5] pl-4">
            <Key size={20} className="text-[#111111] mt-0.5 shrink-0" />
            <div>
              <div className="text-lg font-extrabold text-[#111111] leading-none">SECURED</div>
              <div className="text-[9px] font-mono text-[#666666] uppercase tracking-wider mt-1.5">
                SECRETS & KEYS
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 border-l border-[#E5E5E5] pl-4">
            <CheckCircle2 size={20} className="text-[#111111] mt-0.5 shrink-0" />
            <div>
              <div className="text-lg font-extrabold text-[#111111] leading-none">ACTIVE</div>
              <div className="text-[9px] font-mono text-[#666666] uppercase tracking-wider mt-1.5">
                LLM POLICY CHECK
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 flex items-center text-xs text-[#777777] font-mono">
        <span>© 2026 QWOANG AI Safety Division. All rights reserved.</span>
      </div>
    </div>
  )
}
