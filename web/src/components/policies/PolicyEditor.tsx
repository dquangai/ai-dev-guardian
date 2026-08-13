import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import type { Policy } from '../../lib/types'
import { useAuth } from '../../context/AuthContext'

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
  const { can } = useAuth()
  const [id, setId] = useState('')
  const [raw, setRaw] = useState('')
  const [changeSummary, setChangeSummary] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Keyed on policy?.id (not the policy object itself) so a post-save refetch — which hands
  // down a new object for the *same* policy — doesn't wipe the just-set success status/summary
  // before the user can read it. Only an actual switch to a different policy (or isNew toggle)
  // should reset the form.
  useEffect(() => {
    setError(null)
    setStatus(null)
    setChangeSummary('')
    if (isNew) {
      setId('new-policy.policy.md')
      setRaw(NEW_POLICY_TEMPLATE)
    } else if (policy) {
      setId(policy.id)
      setRaw(policy.raw)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policy?.id, isNew])

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
        ? await api.post<{ status: string; gitHint?: string }>('/policies', { id, content: raw, changeSummary })
        : await api.put<{ status: string; gitHint?: string }>(`/policies/${id}`, { content: raw, changeSummary })
      setStatus(
        result.status === 'applied'
          ? `Saved directly to .guardian/policies — now Active. ${result.gitHint ?? ''}`
          : 'Submitted for Lead approval — status: Pending Approval.'
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
      const result = await api.delete<{ status: string; gitHint?: string }>(`/policies/${policy.id}`)
      setStatus(
        result.status === 'applied' ? `Deleted. ${result.gitHint ?? ''}` : 'Delete submitted for approval.'
      )
      onDeleted()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete policy.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col rounded-[8px] border border-[#E5E7EB] bg-white p-5 space-y-4 font-sans">
      <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] pb-3">
        {isNew ? (
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs font-semibold text-[#64748B]">Filename:</span>
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="my-policy.policy.md"
              className="w-72 rounded-[6px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-mono text-[#111827] focus:border-[#B40000] focus:outline-none"
            />
          </div>
        ) : (
          <h3 className="text-sm font-bold text-[#111827] font-mono">{id}</h3>
        )}
        {!isNew && policy && (canEditDirect || canPropose) && (
          <button
            onClick={remove}
            disabled={busy}
            className="flex items-center gap-1 rounded-[6px] border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-[#B91C1C] hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Trash2 size={13} /> Delete Policy
          </button>
        )}
      </div>

      {!isNew && policy?.version !== undefined && (
        <p className="text-xs text-[#64748B] font-mono">
          v{policy.version}
          {policy.updatedBy ? ` · updated by ${policy.updatedBy}` : ''}
          {policy.lastUpdated ? ` · ${new Date(policy.lastUpdated).toLocaleString()}` : ''}
          {policy.changeSummary ? ` · "${policy.changeSummary}"` : ''}
        </p>
      )}

      {!readOnly && (
        <div>
          <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Change Summary / Commit Message</label>
          <input
            value={changeSummary}
            onChange={(e) => setChangeSummary(e.target.value)}
            placeholder="What changed? (shown to everyone on the notification bell)"
            className="w-full rounded-[6px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs text-[#111827] focus:border-[#B40000] focus:outline-none"
          />
        </div>
      )}

      <div className="flex-1">
        <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Policy Markdown Source</label>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          readOnly={readOnly}
          spellCheck={false}
          className="w-full min-h-[380px] rounded-[6px] border border-[#E5E7EB] bg-[#FAFAFA] p-4 font-mono text-xs leading-relaxed text-[#111827] focus:border-[#B40000] focus:bg-white focus:outline-none transition-all"
        />
      </div>

      {readOnly && (
        <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">Your role has read-only access to policies.</p>
      )}
      {error && <p className="text-xs text-red-700 bg-red-50 p-2 rounded border border-red-200">{error}</p>}
      {status && <p className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">{status}</p>}

      <div className="flex items-center gap-2 pt-2 border-t border-[#E5E7EB]">
        {!readOnly && (
          <button
            onClick={save}
            disabled={busy || !raw.trim() || (isNew && !id.trim())}
            className="rounded-[6px] bg-[#B40000] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#C8102E] transition-colors disabled:cursor-not-allowed disabled:bg-gray-300 cursor-pointer"
          >
            {busy ? 'Saving…' : canEditDirect ? 'Save Policy' : 'Submit for Approval'}
          </button>
        )}
        {isNew && (
          <button
            onClick={onCancelNew}
            className="rounded-[6px] border border-[#E5E7EB] bg-white px-4 py-1.5 text-xs font-semibold text-[#64748B] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

