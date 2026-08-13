import { useState } from 'react'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useApi } from '../lib/useApi'
import type { AuditRecord, SystemDiagnostics } from '../lib/types'
import { Panel } from '../components/ui/Panel'
import { ViolationList } from '../components/ui/ViolationList'
import { StatusPill, verdictVariant } from '../components/ui/StatusPill'
import { useAuth } from '../context/AuthContext'
import { RequestBypassForm } from '../components/RequestBypassForm'
import { engineShortName } from '../lib/engineLabel'
import { TechButton } from '../components/ui/TechButton'

export function CodeAudit() {
  const { can } = useAuth()
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<AuditRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { data: diagnostics } = useApi<SystemDiagnostics>('/system/diagnostics')

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
      <Panel title="Run a Guardian Audit" icon={<ShieldCheck size={16} className="text-[#111111]" />}>
        <p className="text-xs text-[#555555] leading-relaxed">
          Runs the same checks as <code className="rounded bg-[#F4F5F7] border border-[#D6D6D6] px-1.5 py-0.5 font-mono text-[11px] text-[#111111]">guardian check --staged</code>
          {' '}against your currently staged changes: secret scanning, architecture/circular-dependency
          analysis, Semgrep, and {engineShortName(diagnostics?.llm)} policy reasoning.
        </p>
        <div className="mt-4">
          <TechButton
            onClick={runAudit}
            disabled={!can('audit:run') || running}
            className="px-5 py-2.5 text-xs"
          >
            {running ? 'RUNNING AUDIT…' : 'LAUNCH CODE AUDIT'}
          </TechButton>
        </div>
        {!can('audit:run') && (
          <p className="mt-2.5 text-xs text-[#B54708] font-medium bg-amber-50 border border-amber-200 p-2.5 rounded-[6px]">Your role cannot trigger audit runs.</p>
        )}
        {error && <p className="mt-2.5 text-xs text-[#C8102E] font-medium bg-rose-50 border border-rose-200 p-2.5 rounded-[6px]">{error}</p>}
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
