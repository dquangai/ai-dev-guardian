import { Shield, Sparkles, Terminal } from 'lucide-react'

const ACTIVE_LOGS = [
  { time: '10:06:50', action: 'policy.check: secret-scan', status: 'PASSED', color: 'text-emerald-300' },
  { time: '10:07:12', action: 'policy.check: dependency-rules', status: 'PASSED', color: 'text-emerald-300' },
  { time: '10:08:03', action: 'policy.check: architecture-rules', status: 'PASSED', color: 'text-emerald-300' },
  { time: '10:09:16', action: 'policy.check: llm-policy-check', status: 'BLOCKED', color: 'text-white font-semibold animate-pulse' },
]

export function LoginHero() {
  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#80070B] via-[#9E0B10] to-[#590407] px-12 py-16 text-white lg:flex lg:w-1/2 lg:flex-col lg:justify-between border-r border-[#80070B]/35">
      {/* Decorative White Ambient Light */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-b from-white/10 to-transparent rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[350px] h-[350px] bg-gradient-to-tr from-white/5 to-transparent rounded-full blur-[80px] pointer-events-none" />

      {/* Header (Vingroup Style corporate branding) */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <span className="block text-xs font-bold tracking-[0.2em] text-white">VINSMART FUTURE</span>
            <span className="block text-[8px] font-medium tracking-[0.1em] text-white/70 uppercase">AI Security Division</span>
          </div>
        </div>
      </div>

      {/* Middle Content */}
      <div className="relative z-10 my-auto flex flex-col gap-10">
        <div className="space-y-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/25 px-3 py-1 text-[10px] font-semibold tracking-wider text-white uppercase">
            <Sparkles size={10} />
            Enterprise Edition
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight leading-tight">
            AI DEV GUARDIAN
          </h1>
          <p className="text-sm text-white/80 max-w-md leading-relaxed">
            Hệ thống giám sát tuân thủ mã nguồn và chính sách an toàn thông tin tự động, bảo vệ toàn diện chu kỳ phát triển phần mềm của VinSmart.
          </p>
        </div>

        {/* Real-time Monitor Console (Corporate styling) */}
        <div className="rounded-xl border border-white/15 bg-[#590407]/60 backdrop-blur-md p-6 shadow-2xl">
          <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-white" />
              <span className="font-mono text-xs font-semibold text-white/90">guardian-agent --staged</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] font-bold text-white/70 uppercase tracking-widest">Active Guard</span>
            </div>
          </div>

          <div className="space-y-2.5 font-mono text-[11px]">
            {ACTIVE_LOGS.map((log, i) => (
              <div key={i} className="flex items-center justify-between text-white/75">
                <div className="flex items-center gap-2">
                  <span className="text-white/45">[{log.time}]</span>
                  <span>{log.action}</span>
                </div>
                <span className={log.color}>{log.status}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-lg bg-white/10 border border-white/15 p-3 flex items-start gap-3">
            <Shield size={16} className="text-white mt-0.5 shrink-0" />
            <div className="text-[11px] text-white/95 leading-relaxed">
              <strong className="text-white">Cảnh báo đẩy:</strong> Phát hiện vi phạm quy tắc kiến trúc trong file <code className="bg-white/15 px-1 py-0.5 rounded text-white font-mono">rbac.ts</code>. Đã chặn commit thành công.
            </div>
          </div>
        </div>

        {/* Bottom stats / features */}
        <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
          <div>
            <div className="text-xl font-bold text-white">100%</div>
            <div className="text-[10px] text-white/70 uppercase tracking-wider mt-0.5">Pre-push Verification</div>
          </div>
          <div>
            <div className="text-xl font-bold text-white">Secured</div>
            <div className="text-[10px] text-white/70 uppercase tracking-wider mt-0.5">Secrets & Keys</div>
          </div>
          <div>
            <div className="text-xl font-bold text-white">Active</div>
            <div className="text-[10px] text-white/70 uppercase tracking-wider mt-0.5">LLM Policy Check</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 flex items-center gap-2 text-[10px] text-white/50">
        <span>© 2026 Vingroup AI Safety Division. All rights reserved.</span>
      </div>
    </div>
  )
}
