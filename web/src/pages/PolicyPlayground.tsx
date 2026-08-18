import { useState } from 'react'
import { FlaskConical, PlayCircle, ShieldCheck, Sparkles } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useApi } from '../lib/useApi'
import type { SystemDiagnostics, Violation } from '../lib/types'
import { Panel } from '../components/ui/Panel'
import { ViolationList } from '../components/ui/ViolationList'
import { StatusPill, verdictVariant } from '../components/ui/StatusPill'
import { TechButton } from '../components/ui/TechButton'
import { PLAYGROUND_SCENARIOS as SCENARIOS, type ScenarioId } from '../lib/playgroundScenarios'

interface PlaygroundResult {
  verdict: 'PASS' | 'BLOCK'
  violations: Violation[]
  changedFiles: string[]
}

export function PolicyPlayground() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('jwt')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<PlaygroundResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { data: diagnostics } = useApi<SystemDiagnostics>('/system/diagnostics')

  const scenario = SCENARIOS[scenarioId]
  const llmConfigured = Boolean(diagnostics?.llm?.provider)

  function selectScenario(id: ScenarioId) {
    setScenarioId(id)
    setResult(null)
    setError(null)
  }

  async function runCheck() {
    setRunning(true)
    setError(null)
    try {
      const data = await api.post<PlaygroundResult>('/playground/run', { scenario: scenarioId })
      setResult(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Playground run failed.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#111111]">Policy Playground</h1>
          <p className="mt-1.5 text-xs text-[#555555] max-w-xl">
            Thử policy trước khi ban hành cho cả team, và trình diễn trực quan các kịch bản lỗ hổng
            đặc thù V-ID cho Dev mới.
          </p>
        </div>
        <span className="shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-700">
          Sandbox — không ghi vào Audit History
        </span>
      </div>

      {!llmConfigured && (
        <p className="rounded-[6px] border border-amber-200 bg-amber-50 p-2.5 text-xs font-medium text-[#B54708]">
          Chưa cấu hình ANTHROPIC_API_KEY/OPENAI_API_KEY trên server — cả 2 kịch bản demo chỉ vi
          phạm qua LLM policy check, thiếu key sẽ luôn trả về PASS sai. Cấu hình key trước khi dùng
          Playground.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Kịch bản" icon={<FlaskConical size={16} className="text-[#111111]" />} useGridPattern>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => (
              <button
                key={id}
                onClick={() => selectScenario(id)}
                className={`rounded-lg border px-4 py-2 text-xs font-semibold cursor-pointer transition-colors ${
                  id === scenarioId
                    ? 'border-[#9E0B10] bg-[#9E0B10] text-white'
                    : 'border-[#D6D6D6] bg-white text-slate-700 hover:border-[#9E0B10]'
                }`}
              >
                {SCENARIOS[id].label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-indigo-700">
              <ShieldCheck size={11} /> V-ID Exclusive Rule
            </span>
            <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Kỳ vọng: {scenario.expectedVerdict}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[#555555]">{scenario.ruleNote}</p>

          <div className="mt-3 overflow-hidden rounded-lg border border-[#D6D6D6]">
            <div className="flex items-center justify-between border-b border-[#D6D6D6] bg-white/70 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold text-[#111111]">{scenario.file}</span>
                <span className="rounded border border-[#D6D6D6] px-1.5 py-0.5 font-mono text-[9px] text-[#777777]">
                  {scenario.lang}
                </span>
              </div>
              <TechButton onClick={runCheck} disabled={running || !llmConfigured} icon={<PlayCircle size={13} />} className="px-4 py-2 text-[11px]">
                {running ? 'ĐANG PHÂN TÍCH…' : 'RUN CHECK'}
              </TechButton>
            </div>
            <div className="overflow-x-auto bg-[#0D1117] py-3.5">
              {scenario.lines.map((line, i) => (
                <div key={i} className={`flex px-0 ${i + 1 === scenario.highlightLine ? 'bg-red-500/10' : ''}`}>
                  <span className="w-10 shrink-0 select-none pr-3.5 text-right font-mono text-[11px] text-[#484F58]">
                    {i + 1}
                  </span>
                  <span
                    className={`whitespace-pre font-mono text-[11px] ${
                      i + 1 === scenario.highlightLine ? 'text-[#FF7B72]' : 'text-[#C9D1D9]'
                    }`}
                  >
                    {line}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p className="mt-2.5 rounded-[6px] border border-rose-200 bg-rose-50 p-2.5 text-xs font-medium text-[#C8102E]">
              {error}
            </p>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel
            title="Guardian Verdict"
            icon={<FlaskConical size={16} className="text-[#111111]" />}
            useGridPattern
            action={result ? <StatusPill variant={verdictVariant(result.verdict)}>{result.verdict}</StatusPill> : undefined}
          >
            {!result && (
              <p className="py-10 text-center text-xs text-slate-400">
                Chọn 1 kịch bản rồi bấm Run Check để xem Guardian phản ứng thật ngay.
              </p>
            )}
            {result && (
              <div className="space-y-4">
                <ViolationList violations={result.violations} />
                {result.violations.length > 0 && (
                  <p className="border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                    Mọi vi phạm hiển thị đã qua Evidence Grounding + AI-as-a-Judge trước khi tới đây —
                    xem README mục "LLM reasoning: 5 layers against hallucination".
                  </p>
                )}
              </div>
            )}
          </Panel>

          <Panel title="So sánh với AI thường" icon={<Sparkles size={16} className="text-[#111111]" />} useGridPattern>
            <div className="space-y-4">
              {/* Terminal-style frame — real recorded output, not a live/simulated call */}
              <div className="overflow-hidden rounded-[10px] border border-[#30363D] bg-[#0D1117] shadow-sm">
                <div className="flex items-center justify-between border-b border-[#21262D] bg-[#161B22] px-4 py-2.5 select-none">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#FF5F56] inline-block" />
                    <span className="h-3 w-3 rounded-full bg-[#FFBD2E] inline-block" />
                    <span className="h-3 w-3 rounded-full bg-[#27C93F] inline-block" />
                    <span className="ml-2 font-mono text-[11px] font-semibold text-[#8B949E] tracking-wide">
                      generic-ai-review — kết quả đã ghi nhận, không phải gọi live
                    </span>
                  </div>
                  <span className="whitespace-nowrap rounded border border-[#30363D] bg-[#21262D] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#D29922]">
                    {scenario.expectedVerdict === 'BLOCK' ? '🔴 Bỏ sót' : '✅ Đúng'}
                  </span>
                </div>

                <div className="space-y-3 p-4">
                  <div className="flex items-center gap-2 font-mono text-[13px]">
                    <span className="font-bold text-[#D29922]">➜</span>
                    <span className="font-bold text-[#58A6FF]">review</span>
                    <span className="text-[#8B949E]">$</span>
                    <span className="text-[#F0F6FC]">cat {scenario.file} | ask-ai "review đoạn code này"</span>
                  </div>

                  <div className="rounded-lg border border-[#21262D] bg-[#161B22] p-3.5">
                    <div className="mb-2 flex flex-wrap items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[#8B949E]">
                      <span className="inline-block h-2 w-2 rounded-full bg-[#58A6FF]" />
                      Test ngày {scenario.genericAiComparison.testedAt}
                    </div>
                    <p className="text-[13px] leading-relaxed text-[#E6EDF3]">{scenario.genericAiComparison.response}</p>
                  </div>

                  <p className="font-mono text-[11px] leading-relaxed text-[#8B949E]">{scenario.genericAiComparison.model}</p>
                </div>
              </div>

              {/* Honest gap takeaway, ties back to Guardian's real verdict */}
              <div className="rounded-[10px] border border-[#9E0B10]/30 bg-[#FFF5F5] p-3.5">
                <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-[#9E0B10]">
                  <ShieldCheck size={13} /> Guardian Verdict Kỳ Vọng: {scenario.expectedVerdict}
                </div>
                <p className="text-[13px] leading-relaxed text-[#111111]">{scenario.genericAiComparison.gapNote}</p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
