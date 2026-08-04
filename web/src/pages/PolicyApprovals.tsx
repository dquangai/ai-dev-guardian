import { useApi } from '../lib/useApi'
import type { PolicyChangeRequest } from '../lib/types'
import { ChangeRequestsPanel } from '../components/policies/ChangeRequestsPanel'

export function PolicyApprovals() {
  const { data: requests, refetch } = useApi<PolicyChangeRequest[]>('/policies/requests')

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Draft policies proposed by Senior Devs land here — approving one writes it straight to{' '}
        <code className="rounded bg-gray-100 px-1 py-0.5">.guardian/policies/</code>, rejecting it
        discards the draft.
      </p>
      <ChangeRequestsPanel requests={requests ?? []} onResolved={refetch} />
    </div>
  )
}
