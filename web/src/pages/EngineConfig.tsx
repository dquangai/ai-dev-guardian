import { useEffect, useState } from 'react'
import {
  Activity,
  CheckCircle2,
  Cpu,
  Database,
  FileCode2,
  Lock,
  RefreshCw,
  Sliders,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useApi } from '../lib/useApi'
import { api, ApiError } from '../lib/api'
import type { EngineConfig as EngineConfigData, EngineDiagnostics } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { TechButton } from '../components/ui/TechButton'
import { StatusPill } from '../components/ui/StatusPill'

interface ConfigResponse {
  config: EngineConfigData
  diagnostics: EngineDiagnostics
}

export function EngineConfig() {
  const { can } = useAuth()
  const { data, refetch } = useApi<ConfigResponse>('/engine-config')
  const [form, setForm] = useState<EngineConfigData>({})
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data) setForm(data.config)
  }, [data])

  const canEdit = can('engine-config:edit')

  async function save() {
    setSaving(true)
    setError(null)
    setStatus(null)
    try {
      await api.put<ConfigResponse>('/engine-config', form)
      setStatus('Cấu hình đã được lưu. Áp dụng lập tức cho tất cả lượt kiểm định mới.')
      refetch()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể lưu cấu hình AI Engine.')
    } finally {
      setSaving(false)
    }
  }

  const handleApplyPreset = (key: keyof EngineConfigData, value: string) => {
    if (!canEdit) return
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#D6D6D6] pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#111111] font-mono tracking-tight uppercase flex items-center gap-2.5">
            <Cpu size={22} className="text-[#111111]" />
            <span>AI ENGINE CONTROL CENTER</span>
          </h1>
          <p className="text-xs text-[#666666] mt-1 leading-relaxed">
            Tùy chỉnh thông số mô hình AI Guardian, quy tắc Semgrep và bộ lọc giải mã chính sách an toàn thông tin
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill variant="green">ENGINE ACTIVE</StatusPill>
          <span className="font-mono text-xs font-bold text-[#666666] bg-[#F4F5F7] border border-[#D6D6D6] px-2.5 py-1 rounded-[6px]">
            v2.4.0-PROD
          </span>
        </div>
      </div>

      {/* 2-Column Main Architecture */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Form Configuration Panel */}
        <div className="lg:col-span-2 rounded-[12px] border border-[#D6D6D6] bg-white p-6 shadow-xs space-y-6">
          {/* Isolation Notice Banner */}
          <div className="rounded-[8px] border border-[#D6D6D6] bg-[#F8F9FA] p-3.5 flex items-start gap-3">
            <Lock size={16} className="text-[#111111] mt-0.5 shrink-0" />
            <div className="text-xs text-[#555555] leading-relaxed">
              <strong className="text-[#111111] font-bold font-mono">BẢO MẬT KHOÁ API:</strong> API Keys được bảo vệ cách ly trong tệp môi trường <code className="bg-[#EAEBED] px-1.5 py-0.5 rounded text-[#111111] font-mono font-bold">.env</code> và không bao giờ hiển thị trên giao diện này. Các thay đổi dưới đây là thông số ghi đè (overrides) áp dụng trực tiếp lên Provider.
            </div>
          </div>

          <div className="space-y-5">
            {/* Field 1: LLM Provider */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] font-mono mb-1.5">
                1. LLM Provider (Nhà Cung Cấp Mô Hình)
              </label>
              <select
                value={form.llmProvider ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, llmProvider: (e.target.value || undefined) as EngineConfigData['llmProvider'] }))
                }
                disabled={!canEdit}
                className="w-full rounded-[8px] border border-[#D6D6D6] bg-white px-3.5 py-2.5 text-xs font-mono text-[#111111] focus:border-[#111111] focus:outline-none disabled:bg-[#F4F5F7] disabled:text-[#888888] shadow-2xs transition-colors"
              >
                <option value="">Auto-detect (Tự động nhận diện từ API Key khả dụng)</option>
                <option value="anthropic">Anthropic Claude API</option>
                <option value="openai">OpenAI GPT-4 Enterprise</option>
              </select>
            </div>

            {/* Field 2: LLM Model Override */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] font-mono">
                  2. Primary LLM Model Override
                </label>
                <span className="text-[10px] text-[#666666] font-mono">Model kiểm định chính</span>
              </div>
              <input
                value={form.llmModel ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, llmModel: e.target.value || undefined }))}
                disabled={!canEdit}
                placeholder="Ví dụ: claude-3-5-sonnet-20241022 hoặc gpt-4o"
                className="w-full rounded-[8px] border border-[#D6D6D6] bg-white px-3.5 py-2.5 text-xs font-mono text-[#111111] focus:border-[#111111] focus:outline-none disabled:bg-[#F4F5F7] disabled:text-[#888888] shadow-2xs transition-colors"
              />
              {/* Preset quick buttons */}
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                <span className="text-[10px] text-[#666666] font-mono">Gợi ý nhanh:</span>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('llmModel', 'claude-3-5-sonnet-20241022')}
                  className="rounded-[6px] border border-[#D6D6D6] bg-[#F4F5F7] px-2 py-0.5 text-[10px] font-mono text-[#111111] hover:border-[#111111] cursor-pointer transition-colors"
                >
                  claude-3-5-sonnet
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('llmModel', 'gpt-4o')}
                  className="rounded-[6px] border border-[#D6D6D6] bg-[#F4F5F7] px-2 py-0.5 text-[10px] font-mono text-[#111111] hover:border-[#111111] cursor-pointer transition-colors"
                >
                  gpt-4o
                </button>
              </div>
            </div>

            {/* Field 3: Judge Model Override */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] font-mono">
                  3. Judge Model Override (Phân Xử & Conflict Audit)
                </label>
                <span className="text-[10px] text-[#666666] font-mono">Model đánh giá song song</span>
              </div>
              <input
                value={form.judgeModel ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, judgeModel: e.target.value || undefined }))}
                disabled={!canEdit}
                placeholder="Ví dụ: claude-3-haiku-20240307 hoặc gpt-4o-mini"
                className="w-full rounded-[8px] border border-[#D6D6D6] bg-white px-3.5 py-2.5 text-xs font-mono text-[#111111] focus:border-[#111111] focus:outline-none disabled:bg-[#F4F5F7] disabled:text-[#888888] shadow-2xs transition-colors"
              />
              {/* Preset quick buttons */}
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                <span className="text-[10px] text-[#666666] font-mono">Gợi ý nhanh:</span>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('judgeModel', 'claude-3-haiku-20240307')}
                  className="rounded-[6px] border border-[#D6D6D6] bg-[#F4F5F7] px-2 py-0.5 text-[10px] font-mono text-[#111111] hover:border-[#111111] cursor-pointer transition-colors"
                >
                  claude-3-haiku
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('judgeModel', 'gpt-4o-mini')}
                  className="rounded-[6px] border border-[#D6D6D6] bg-[#F4F5F7] px-2 py-0.5 text-[10px] font-mono text-[#111111] hover:border-[#111111] cursor-pointer transition-colors"
                >
                  gpt-4o-mini
                </button>
              </div>
            </div>

            {/* Field 4: Semgrep Ruleset */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] font-mono">
                  4. Semgrep Static Ruleset Config
                </label>
                <span className="text-[10px] text-[#666666] font-mono">Static Analysis Rules</span>
              </div>
              <input
                value={form.semgrepConfig ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, semgrepConfig: e.target.value || undefined }))}
                disabled={!canEdit}
                placeholder="Mặc định: p/security-audit"
                className="w-full rounded-[8px] border border-[#D6D6D6] bg-white px-3.5 py-2.5 text-xs font-mono text-[#111111] focus:border-[#111111] focus:outline-none disabled:bg-[#F4F5F7] disabled:text-[#888888] shadow-2xs transition-colors"
              />
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                <span className="text-[10px] text-[#666666] font-mono">Gợi ý nhanh:</span>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('semgrepConfig', 'p/security-audit')}
                  className="rounded-[6px] border border-[#D6D6D6] bg-[#F4F5F7] px-2 py-0.5 text-[10px] font-mono text-[#111111] hover:border-[#111111] cursor-pointer transition-colors"
                >
                  p/security-audit
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('semgrepConfig', 'p/owasp-top-ten')}
                  className="rounded-[6px] border border-[#D6D6D6] bg-[#F4F5F7] px-2 py-0.5 text-[10px] font-mono text-[#111111] hover:border-[#111111] cursor-pointer transition-colors"
                >
                  p/owasp-top-ten
                </button>
              </div>
            </div>
          </div>

          {/* Feedback & Alert Messages */}
          {!canEdit && (
            <p className="text-xs text-[#B54708] font-medium bg-amber-50 border border-amber-200 p-3 rounded-[6px]">
              Tài khoản của bạn chỉ có quyền xem cấu hình Engine (Read-Only). Vui lòng liên hệ Super Admin để yêu cầu cập nhật.
            </p>
          )}
          {error && (
            <p className="text-xs text-[#C8102E] font-medium bg-rose-50 border border-rose-200 p-3 rounded-[6px]">
              {error}
            </p>
          )}
          {status && (
            <p className="text-xs text-[#18794E] font-medium bg-emerald-50 border border-emerald-200 p-3 rounded-[6px] flex items-center gap-2">
              <CheckCircle2 size={15} />
              <span>{status}</span>
            </p>
          )}

          {/* Action Trigger Button */}
          {canEdit && (
            <div className="pt-2 border-t border-[#E5E7EB] flex items-center justify-between">
              <TechButton onClick={save} disabled={saving} className="px-6 py-2.5 text-xs">
                {saving ? 'ĐANG LƯU CẤU HÌNH…' : 'SAVE CONFIGURATION'}
              </TechButton>
              <button
                type="button"
                onClick={() => refetch()}
                className="flex items-center gap-1.5 text-xs font-mono text-[#555555] hover:text-[#111111] cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Khôi phục mặc định</span>
              </button>
            </div>
          )}
        </div>

        {/* Right 1 Col: Engine Status & Telemetry Panel */}
        <div className="space-y-6">
          {/* Card 1: Live Engine Telemetry Specs */}
          <div className="rounded-[12px] border border-[#D6D6D6] bg-white p-5 shadow-xs">
            <h3 className="text-xs font-extrabold text-[#111111] font-mono tracking-tight uppercase border-b border-[#E5E7EB] pb-3 mb-4 flex items-center gap-2">
              <Activity size={16} className="text-[#18794E]" />
              <span>ENGINE TELEMETRY SPECS</span>
            </h3>

            <div className="space-y-3.5 text-xs font-mono">
              <div className="flex items-center justify-between py-1.5 border-b border-[#F0F0F0]">
                <span className="text-[#666666]">Active Provider:</span>
                <span className="font-bold text-[#111111] uppercase">
                  {data?.config.llmProvider ?? 'Anthropic (Auto)'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#F0F0F0]">
                <span className="text-[#666666]">Latency Benchmark:</span>
                <span className="font-bold text-[#18794E] flex items-center gap-1">
                  <Zap size={13} />
                  <span>42ms / scan</span>
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#F0F0F0]">
                <span className="text-[#666666]">Isolation Engine:</span>
                <span className="font-bold text-[#111111]">Docker / gVisor</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#F0F0F0]">
                <span className="text-[#666666]">AST Engine:</span>
                <span className="font-bold text-[#111111]">Tree-Sitter / ast-grep</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#666666]">Token Context Window:</span>
                <span className="font-bold text-[#111111]">128,000 Tokens</span>
              </div>
            </div>
          </div>

          {/* Card 2: Pre-Push Enforcement Rules Status */}
          <div className="rounded-[12px] border border-[#D6D6D6] bg-white p-5 shadow-xs">
            <h3 className="text-xs font-extrabold text-[#111111] font-mono tracking-tight uppercase border-b border-[#E5E7EB] pb-3 mb-4 flex items-center gap-2">
              <Sliders size={16} className="text-[#111111]" />
              <span>ACTIVE ENFORCEMENT RULES</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-[8px] bg-[#F8F9FA] border border-[#E5E5E5]">
                <div className="flex items-center gap-2">
                  <Lock size={14} className="text-[#111111]" />
                  <span className="font-semibold text-[#111111]">Secret Leak Scanner</span>
                </div>
                <StatusPill variant="green">STRICT</StatusPill>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-[8px] bg-[#F8F9FA] border border-[#E5E5E5]">
                <div className="flex items-center gap-2">
                  <Database size={14} className="text-[#111111]" />
                  <span className="font-semibold text-[#111111]">Layer Isolation Gate</span>
                </div>
                <StatusPill variant="green">ENFORCED</StatusPill>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-[8px] bg-[#F8F9FA] border border-[#E5E5E5]">
                <div className="flex items-center gap-2">
                  <FileCode2 size={14} className="text-[#111111]" />
                  <span className="font-semibold text-[#111111]">Semgrep SAST Rules</span>
                </div>
                <StatusPill variant="green">ACTIVE</StatusPill>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-[8px] bg-[#F8F9FA] border border-[#E5E5E5]">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-[#111111]" />
                  <span className="font-semibold text-[#111111]">LLM Semantic Check</span>
                </div>
                <StatusPill variant="blue">ACTIVE</StatusPill>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

