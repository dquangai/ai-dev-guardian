import { useState } from 'react'
import { AlertTriangle, ShieldQuestion } from 'lucide-react'
import { useApi } from '../lib/useApi'
import { api, ApiError } from '../lib/api'
import type { AuditRecord, BypassRequest, Violation } from '../lib/types'
import { Panel } from '../components/ui/Panel'
import { ViolationList } from '../components/ui/ViolationList'
import { StatusPill } from '../components/ui/StatusPill'
import { useAuth } from '../context/AuthContext'

export function Findings() {
  const { user, can } = useAuth()
  const { data: history } = useApi<AuditRecord[]>('/audit/history')
  const { data: bypassRequests, refetch } = useApi<BypassRequest[]>('/bypass-requests')
  const [busyId, setBusyId] = useState<string | null>(null)

  // A developer only sees their own audit runs/requests — Admin, Senior Dev, and
  // Auditor keep the full picture, since oversight/approval needs visibility across the team.
  const isDeveloper = user?.role === 'developer'

  const visibleHistory = isDeveloper ? (history ?? []).filter((r) => r.triggeredBy === user?.id) : (history ?? [])
  const allViolations: Violation[] = visibleHistory.flatMap((r) => r.violations)

  const visibleBypassRequests = isDeveloper
    ? (bypassRequests ?? []).filter((r) => r.requestedBy === user?.id)
    : (bypassRequests ?? [])

  async function decide(id: string, decision: 'approve' | 'reject') {
    setBusyId(id)
    try {
      await api.post(`/bypass-requests/${id}/${decision}`)
      refetch()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : `Failed to ${decision} request.`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <Panel
        title={isDeveloper ? 'My Findings' : 'All Findings'}
        icon={<AlertTriangle size={16} className="text-amber-500" />}
        action={<span className="text-xs text-gray-400">{allViolations.length} total</span>}
      >
        <ViolationList violations={allViolations} />
      </Panel>

      <Panel
        title={isDeveloper ? 'My Bypass Requests' : 'Bypass Requests'}
        icon={<ShieldQuestion size={16} className="text-gray-400" />}
        action={<span className="text-xs text-gray-400">{visibleBypassRequests.length} total</span>}
      >
        <div className="space-y-2">
          {visibleBypassRequests.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400">
              {isDeveloper ? "You haven't submitted any bypass requests yet." : 'No bypass requests yet.'}
            </p>
          )}
          {visibleBypassRequests.map((req) => (
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
    </div>
  )
}
