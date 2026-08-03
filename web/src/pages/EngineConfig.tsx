import { useEffect, useState } from 'react'
import { Settings } from 'lucide-react'
import { useApi } from '../lib/useApi'
import { api, ApiError } from '../lib/api'
import type { EngineConfig as EngineConfigData, EngineDiagnostics } from '../lib/types'
import { Panel } from '../components/ui/Panel'
import { useAuth } from '../context/AuthContext'

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
      setStatus('Saved. Overrides apply immediately to new audit runs.')
      refetch()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save engine config.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <Panel title="AI Engine Configuration" icon={<Settings size={16} className="text-gray-400" />}>
        <p className="mb-4 text-sm text-gray-500">
          API keys stay in <code className="rounded bg-gray-100 px-1 py-0.5">.env</code> and are
          never shown here — these are non-secret overrides applied on top of whichever provider
          key is configured.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase text-gray-400">LLM Provider</label>
            <select
              value={form.llmProvider ?? ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, llmProvider: (e.target.value || undefined) as EngineConfigData['llmProvider'] }))
              }
              disabled={!canEdit}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none disabled:bg-gray-50"
            >
              <option value="">Auto-detect from available API key</option>
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-gray-400">LLM Model Override</label>
            <input
              value={form.llmModel ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, llmModel: e.target.value || undefined }))}
              disabled={!canEdit}
              placeholder="Provider default"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none disabled:bg-gray-50"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-gray-400">Judge Model Override</label>
            <input
              value={form.judgeModel ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, judgeModel: e.target.value || undefined }))}
              disabled={!canEdit}
              placeholder="Provider default"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none disabled:bg-gray-50"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-gray-400">Semgrep Ruleset</label>
            <input
              value={form.semgrepConfig ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, semgrepConfig: e.target.value || undefined }))}
              disabled={!canEdit}
              placeholder="p/security-audit"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none disabled:bg-gray-50"
            />
          </div>
        </div>

        {!canEdit && <p className="mt-3 text-xs text-amber-600">Your role has read-only access to engine config.</p>}
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        {status && <p className="mt-3 text-xs text-emerald-600">{status}</p>}

        {canEdit && (
          <button
            onClick={save}
            disabled={saving}
            className="mt-4 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300"
          >
            {saving ? 'Saving…' : 'Save Configuration'}
          </button>
        )}
      </Panel>
    </div>
  )
}
