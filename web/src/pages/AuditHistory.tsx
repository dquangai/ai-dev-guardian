import { useState } from 'react'
import { ChevronDown, ChevronRight, History } from 'lucide-react'
import { useApi } from '../lib/useApi'
import type { AuditRecord } from '../lib/types'
import { Panel } from '../components/ui/Panel'
import { StatusPill, verdictVariant } from '../components/ui/StatusPill'
import { ViolationList } from '../components/ui/ViolationList'

export function AuditHistory() {
  const { data: history } = useApi<AuditRecord[]>('/audit/history')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <Panel
      title="Audit History"
      icon={<History size={16} className="text-gray-400" />}
      action={<span className="text-xs text-gray-400">{history?.length ?? 0} runs</span>}
    >
      <div className="space-y-2">
        {history?.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-400">
            No audits logged yet — run one from Code Audit.
          </p>
        )}
        {history?.map((r) => {
          const expanded = expandedId === r.id
          return (
            <div key={r.id} className="rounded-xl border border-gray-100 bg-gray-50">
              <button
                onClick={() => setExpandedId(expanded ? null : r.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-3">
                  {expanded ? (
                    <ChevronDown size={14} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={14} className="text-gray-400" />
                  )}
                  <StatusPill variant={verdictVariant(r.verdict)}>
                    {r.verdict === 'BLOCK' ? 'MERGE BLOCKED' : 'PASSED'}
                  </StatusPill>
                  <span className="text-xs text-gray-400">{new Date(r.timestamp).toLocaleString()}</span>
                  <span className="text-xs text-gray-500">
                    Files: {r.changedFiles[0] ?? '—'}
                    {r.changedFiles.length > 1 ? ` +${r.changedFiles.length - 1} more` : ''}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">{r.violations.length} violations</div>
                  <div className="text-xs text-gray-400">
                    Target: {r.target} · {r.triggeredBy}
                  </div>
                </div>
              </button>
              {expanded && (
                <div className="border-t border-gray-200 p-4">
                  <ViolationList violations={r.violations} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
