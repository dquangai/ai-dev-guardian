import { useState } from 'react'
import { ShieldQuestion } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import type { BypassRequest } from '../../lib/types'
import { Panel } from '../ui/Panel'
import { StatusPill } from '../ui/StatusPill'
import { useAuth } from '../../context/AuthContext'

export function BypassRequestsPanel({
  requests,
  onResolved,
}: {
  requests: BypassRequest[]
  onResolved: () => void
}) {
  const { can } = useAuth()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function decide(id: string, decision: 'approve' | 'reject') {
    setBusyId(id)
    try {
      await api.post(`/bypass-requests/${id}/${decision}`)
      onResolved()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : `Failed to ${decision} request.`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Panel
      title="Bypass Requests"
      icon={<ShieldQuestion size={16} className="text-gray-400" />}
      action={<span className="text-xs text-gray-400">{requests.length} total</span>}
    >
      <div className="space-y-2">
        {requests.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-400">No bypass requests yet.</p>
        )}
        {requests.map((req) => (
          <div key={req.id} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-gray-800">{req.reason}</p>
                <p className="mt-1 text-xs text-gray-400">
                  Requested by {req.requestedBy} · {new Date(req.requestedAt).toLocaleString()}
                  {req.auditId ? ` · audit ${req.auditId}` : ''}
                </p>
                {req.reviewedBy && (
                  <p className="mt-1 text-xs text-gray-400">
                    Reviewed by {req.reviewedBy} · {req.reviewNote}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusPill
                  variant={req.status === 'approved' ? 'green' : req.status === 'rejected' ? 'red' : 'amber'}
                >
                  {req.status}
                </StatusPill>
                {req.status === 'pending' && can('bypass:approve') && (
                  <>
                    <button
                      onClick={() => decide(req.id, 'approve')}
                      disabled={busyId === req.id}
                      className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => decide(req.id, 'reject')}
                      disabled={busyId === req.id}
                      className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}
