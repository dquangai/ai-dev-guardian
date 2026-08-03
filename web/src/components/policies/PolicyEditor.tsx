import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import type { Policy } from '../../lib/types'
import { useRole } from '../../context/RoleContext'

const NEW_POLICY_TEMPLATE = `---
category: Uncategorized
scope: ["**/*.ts"]
severity: medium
tags: []
---

# New Policy

- Describe the rule here.
`

interface Props {
  policy: Policy | null
  isNew: boolean
  onSaved: () => void
  onDeleted: () => void
  onCancelNew: () => void
}

export function PolicyEditor({ policy, isNew, onSaved, onDeleted, onCancelNew }: Props) {
  const { can } = useRole()
  const [id, setId] = useState('')
  const [raw, setRaw] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setError(null)
    setStatus(null)
    if (isNew) {
      setId('new-policy.policy.md')
      setRaw(NEW_POLICY_TEMPLATE)
    } else if (policy) {
      setId(policy.id)
      setRaw(policy.raw)
    }
  }, [policy, isNew])

  if (!policy && !isNew) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-gray-200 text-sm text-gray-400">
        Select a policy to view or edit it.
      </div>
    )
  }

  const canEditDirect = can('policy:edit-direct')
  const canPropose = can('policy:propose')
  const readOnly = !canEditDirect && !canPropose

  async function save() {
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      const result = isNew
        ? await api.post<{ status: string }>('/policies', { id, content: raw })
        : await api.put<{ status: string }>(`/policies/${id}`, { content: raw })
      setStatus(
        result.status === 'applied'
          ? 'Saved directly to .guardian/policies.'
          : 'Submitted for approval — a Team Lead/Admin must review it.'
      )
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save policy.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!policy) return
    if (!confirm(`Delete ${policy.id}? This cannot be undone once approved.`)) return
    setBusy(true)
    setError(null)
    try {
      const result = await api.delete<{ status: string }>(`/policies/${policy.id}`)
      setStatus(
        result.status === 'applied' ? 'Deleted.' : 'Delete submitted for approval.'
      )
      onDeleted()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete policy.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        {isNew ? (
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="my-policy.policy.md"
            className="w-64 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium focus:border-blue-400 focus:outline-none"
          />
        ) : (
          <h3 className="text-sm font-semibold text-gray-900">{id}</h3>
        )}
        {!isNew && policy && (canEditDirect || canPropose) && (
          <button
            onClick={remove}
            disabled={busy}
            className="flex items-center gap-1 rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 size={13} /> Delete
          </button>
        )}
      </div>

      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        readOnly={readOnly}
        spellCheck={false}
        className="min-h-[360px] flex-1 rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-xs leading-relaxed text-gray-800 focus:border-blue-400 focus:outline-none"
      />

      {readOnly && (
        <p className="mt-2 text-xs text-amber-600">Your role has read-only access to policies.</p>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {status && <p className="mt-2 text-xs text-emerald-600">{status}</p>}

      <div className="mt-3 flex items-center gap-2">
        {!readOnly && (
          <button
            onClick={save}
            disabled={busy || !raw.trim() || (isNew && !id.trim())}
            className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {busy ? 'Saving…' : canEditDirect ? 'Save Policy' : 'Submit for Approval'}
          </button>
        )}
        {isNew && (
          <button
            onClick={onCancelNew}
            className="rounded-full border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
