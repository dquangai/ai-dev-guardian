import { useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { BypassRequest } from '../lib/types'

export function RequestBypassForm({ auditId }: { auditId?: string }) {
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState<BypassRequest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const request = await api.post<BypassRequest>('/bypass-requests', { auditId, reason })
      setSubmitted(request)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit bypass request.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        Bypass request submitted — awaiting Admin/Auditor approval.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase text-gray-400">Request a merge bypass</label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why does this blocked audit need to be bypassed?"
        rows={2}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={submit}
        disabled={!reason.trim() || submitting}
        className="rounded-full bg-[#9E0B10] px-4 py-2 text-xs font-semibold text-white hover:bg-[#80070B] disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {submitting ? 'Submitting…' : 'Submit Bypass Request'}
      </button>
    </div>
  )
}
