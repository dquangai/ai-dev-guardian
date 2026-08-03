import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { Violation } from '../../lib/types'
import { StatusPill, severityVariant } from './StatusPill'

export function ViolationList({ violations }: { violations: Violation[] }) {
  if (violations.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-400">No violations found.</p>
  }
  return (
    <div className="space-y-2">
      {violations.map((v, i) => (
        <ViolationRow key={i} violation={v} />
      ))}
    </div>
  )
}

function ViolationRow({ violation }: { violation: Violation }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          {open ? (
            <ChevronDown size={14} className="shrink-0 text-gray-400" />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-gray-400" />
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-gray-900">{violation.errorWhat}</div>
            <div className="truncate text-xs text-gray-500">{violation.location}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusPill variant={severityVariant(violation.riskLevel)}>{violation.riskLevel}</StatusPill>
          <span className="hidden text-xs text-gray-400 sm:inline">{violation.source}</span>
        </div>
      </button>
      {open && (
        <div className="space-y-3 border-t border-gray-200 px-4 py-3 text-sm">
          <div>
            <div className="text-xs font-semibold uppercase text-gray-400">Policy violated</div>
            <p className="mt-1 text-gray-700">{violation.policyViolated}</p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-gray-400">Why it matters</div>
            <p className="mt-1 text-gray-700">{violation.why}</p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-gray-400">How to fix</div>
            <p className="mt-1 text-gray-700">{violation.howToFix}</p>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase text-gray-400">Prompt to fix</div>
              <button
                onClick={() => navigator.clipboard.writeText(violation.promptToFix)}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                Copy
              </button>
            </div>
            <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-gray-600">
              {violation.promptToFix}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
