import { useState } from 'react'
import { Play, ShieldAlert, ShieldCheck } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import type { AuditRecord } from '../lib/types'
import { Panel } from '../components/ui/Panel'
import { ViolationList } from '../components/ui/ViolationList'
import { StatusPill, verdictVariant } from '../components/ui/StatusPill'
import { useAuth } from '../context/AuthContext'
import { RequestBypassForm } from '../components/RequestBypassForm'

export function CodeAudit() {
  const { can } = useAuth()
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<AuditRecord | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runAudit() {
    setRunning(true)
    setError(null)
    try {
      const record = await api.post<AuditRecord>('/audit/run')
      setResult(record)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Audit run failed.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <Panel title="Run a Guardian Audit" icon={<ShieldCheck size={16} className="text-gray-400" />}>
        <p className="text-sm text-gray-500">
          Runs the same checks as <code className="rounded bg-gray-100 px-1 py-0.5">guardian check --staged</code>
          {' '}against your currently staged changes: secret scanning, architecture/circular-dependency
          analysis, Semgrep, and Gemini policy reasoning.
        </p>
        <button
          onClick={runAudit}
          disabled={!can('audit:run') || running}
          className="mt-4 flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          <Play size={15} fill="currentColor" />
          {running ? 'Running audit…' : 'Launch Code Audit'}
        </button>
        {!can('audit:run') && (
          <p className="mt-2 text-xs text-amber-600">Your role cannot trigger audit runs.</p>
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </Panel>

      {result && (
        <Panel
          title="Audit Result"
          icon={
            result.verdict === 'BLOCK' ? (
              <ShieldAlert size={16} className="text-red-500" />
            ) : (
              <ShieldCheck size={16} className="text-emerald-500" />
            )
          }
          action={
            <StatusPill variant={verdictVariant(result.verdict)}>
              {result.verdict === 'BLOCK' ? 'MERGE BLOCKED' : 'PASSED'}
            </StatusPill>
          }
        >
          <div className="mb-4 text-xs text-gray-500">
            Changed files: {result.changedFiles.length === 0 ? 'none staged' : result.changedFiles.join(', ')}
          </div>
          <ViolationList violations={result.violations} />

          {result.verdict === 'BLOCK' && can('bypass:request') && (
            <div className="mt-6 border-t border-gray-100 pt-4">
              <RequestBypassForm auditId={result.id} />
            </div>
          )}
        </Panel>
      )}
    </div>
  )
}
