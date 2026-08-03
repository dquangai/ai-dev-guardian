import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useApi } from '../lib/useApi'
import type { Policy, PolicyChangeRequest } from '../lib/types'
import { StatusPill, severityVariant } from '../components/ui/StatusPill'
import { PolicyEditor } from '../components/policies/PolicyEditor'
import { ChangeRequestsPanel } from '../components/policies/ChangeRequestsPanel'
import { useRole } from '../context/RoleContext'

export function Policies() {
  const { can } = useRole()
  const { data: policies, refetch: refetchPolicies } = useApi<Policy[]>('/policies')
  const { data: requests, refetch: refetchRequests } = useApi<PolicyChangeRequest[]>('/policies/requests')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)

  const selected = policies?.find((p) => p.id === selectedId) ?? null

  function refreshAll() {
    refetchPolicies()
    refetchRequests()
    setCreatingNew(false)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              Policies ({policies?.length ?? 0})
            </h2>
            {(can('policy:edit-direct') || can('policy:propose')) && (
              <button
                onClick={() => {
                  setCreatingNew(true)
                  setSelectedId(null)
                }}
                className="flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Plus size={13} /> New Policy
              </button>
            )}
          </div>
          <div className="space-y-2">
            {policies?.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedId(p.id)
                  setCreatingNew(false)
                }}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                  selectedId === p.id ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{p.id}</span>
                  <StatusPill variant={severityVariant(p.severity)}>{p.severity}</StatusPill>
                </div>
                <p className="mt-1 text-xs text-gray-500">{p.category}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.tags.map((tag) => (
                    <span key={tag} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                      {tag}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3">
          <PolicyEditor
            policy={selected}
            isNew={creatingNew}
            onSaved={refreshAll}
            onDeleted={() => {
              setSelectedId(null)
              refreshAll()
            }}
            onCancelNew={() => setCreatingNew(false)}
          />
        </div>
      </div>

      <ChangeRequestsPanel requests={requests ?? []} onResolved={refreshAll} />
    </div>
  )
}
