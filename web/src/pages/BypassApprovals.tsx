import { useApi } from '../lib/useApi'
import type { BypassRequest } from '../lib/types'
import { BypassRequestsPanel } from '../components/bypass/BypassRequestsPanel'

export function BypassApprovals() {
  const { data: requests, refetch } = useApi<BypassRequest[]>('/bypass-requests')

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Emergency bypass requests submitted by Devs when a Code Audit blocks their push. Approving
        one is a record for accountability — it doesn't itself unblock the git hook.
      </p>
      <BypassRequestsPanel requests={requests ?? []} onResolved={refetch} />
    </div>
  )
}
