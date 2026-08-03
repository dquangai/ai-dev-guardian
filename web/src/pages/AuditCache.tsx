import { Database, Trash2 } from 'lucide-react'
import { useApi } from '../lib/useApi'
import { api, ApiError } from '../lib/api'
import { Panel } from '../components/ui/Panel'
import { useAuth } from '../context/AuthContext'

export function AuditCache() {
  const { can } = useAuth()
  const { data, refetch, loading } = useApi<{ passedDiffHashes: string[] }>('/audit/cache')

  async function clear() {
    if (!confirm('Clear the audit cache? The next audit for every diff will re-run in full.')) return
    try {
      await api.delete('/audit/cache')
      refetch()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to clear cache.')
    }
  }

  return (
    <Panel
      title="Audit Cache"
      icon={<Database size={16} className="text-gray-400" />}
      action={
        can('cache:manage') && (
          <button
            onClick={clear}
            className="flex items-center gap-1 rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 size={13} /> Clear Cache
          </button>
        )
      }
    >
      <p className="mb-4 text-sm text-gray-500">
        Cached diff hashes of clean (PASS) audit runs. When a staged diff matches a hash below, the
        Gemini policy check is skipped since nothing has changed since it last passed —
        deterministic checks (secret scan, architecture, Semgrep) always still run.
      </p>
      {!loading && data?.passedDiffHashes.length === 0 && (
        <p className="py-6 text-center text-sm text-gray-400">Cache is empty.</p>
      )}
      <div className="space-y-1">
        {data?.passedDiffHashes.map((hash) => (
          <div key={hash} className="truncate rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs text-gray-600">
            {hash}
          </div>
        ))}
      </div>
    </Panel>
  )
}
