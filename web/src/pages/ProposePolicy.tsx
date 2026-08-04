import { useState } from 'react'
import { FilePlus2 } from 'lucide-react'
import { useApi } from '../lib/useApi'
import { useAuth } from '../context/AuthContext'
import type { PolicyChangeRequest } from '../lib/types'
import { Panel } from '../components/ui/Panel'
import { StatusPill } from '../components/ui/StatusPill'
import { PolicyEditor } from '../components/policies/PolicyEditor'

export function ProposePolicy() {
  const { user } = useAuth()
  const { data: requests, refetch } = useApi<PolicyChangeRequest[]>('/policies/requests')
  // Remounts the editor with a clean template after a successful submit — same policy/isNew
  // props otherwise wouldn't trigger PolicyEditor's own reset effect.
  const [formKey, setFormKey] = useState(0)

  const myRequests = (requests ?? []).filter((r) => r.submittedBy === user?.id)

  function handleSaved() {
    refetch()
    setFormKey((k) => k + 1)
  }

  return (
    <div className="space-y-6">
      <Panel title="Propose New Policy" icon={<FilePlus2 size={16} className="text-gray-400" />}>
        <p className="mb-4 text-sm text-gray-500">
          Draft a brand-new policy and submit it for a Team Lead/Admin to review — it only lands in{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5">.guardian/policies/</code> once approved.
        </p>
        <PolicyEditor
          key={formKey}
          policy={null}
          isNew
          onSaved={handleSaved}
          onDeleted={() => {}}
          onCancelNew={() => setFormKey((k) => k + 1)}
        />
      </Panel>

      <Panel
        title="Your Submitted Drafts"
        icon={<FilePlus2 size={16} className="text-gray-400" />}
        action={<span className="text-xs text-gray-400">{myRequests.length} total</span>}
      >
        <div className="space-y-2">
          {myRequests.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400">
              You haven't proposed any policies yet.
            </p>
          )}
          {myRequests.map((req) => (
            <div key={req.id} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {req.action.toUpperCase()} · {req.policyId}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Submitted {new Date(req.submittedAt).toLocaleString()}
                  </p>
                  {req.reviewedBy && (
                    <p className="mt-1 text-xs text-gray-400">
                      Reviewed by {req.reviewedBy}
                      {req.reviewNote ? ` — ${req.reviewNote}` : ''}
                    </p>
                  )}
                </div>
                <StatusPill
                  variant={req.status === 'approved' ? 'green' : req.status === 'rejected' ? 'red' : 'amber'}
                >
                  {req.status === 'pending' ? 'Pending Approval' : req.status === 'approved' ? 'Active' : 'Rejected'}
                </StatusPill>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
