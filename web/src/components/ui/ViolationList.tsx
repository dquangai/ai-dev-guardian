import { useState } from 'react'
import { ChevronDown, ChevronRight, Clipboard } from 'lucide-react'
import type { Violation } from '../../lib/types'
import { StatusPill, severityVariant } from './StatusPill'
import { useToast } from '../../context/ToastContext'

/** Short, copy-paste-ready prompt for an AI coding assistant — distinct from the fuller
 * `violation.promptToFix` (which the LLM itself generated) shown in the expanded detail. */
function buildCompactFixPrompt(violation: Violation): string {
  return `Fix violation of "${violation.policyViolated}" (${violation.riskLevel}) in \`${violation.location}\`: - Issue: ${violation.errorWhat} - Fix: ${violation.howToFix}`
}

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
  const { showToast } = useToast()

  function copyPrompt(text: string) {
    navigator.clipboard.writeText(text)
    showToast('Prompt copied to clipboard!')
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {open ? (
            <ChevronDown size={14} className="shrink-0 text-gray-400" />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-gray-400" />
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-gray-900">{violation.errorWhat}</div>
            <div className="truncate text-xs text-gray-500">{violation.location}</div>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <StatusPill variant={severityVariant(violation.riskLevel)}>{violation.riskLevel}</StatusPill>
          <span className="hidden text-xs text-gray-400 lg:inline">{violation.source}</span>
          <button
            onClick={() => copyPrompt(buildCompactFixPrompt(violation))}
            title="Copy AI Fix Prompt"
            className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            <Clipboard size={12} />
            <span className="hidden sm:inline">Copy AI Fix Prompt</span>
          </button>
        </div>
      </div>
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
              <div className="text-xs font-semibold uppercase text-gray-400">Full prompt to fix</div>
              <button
                onClick={() => copyPrompt(violation.promptToFix)}
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
