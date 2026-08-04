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
    <div className="rounded-xl border border-slate-200/80 bg-white hover:border-red-200/90 shadow-2xs">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {open ? (
            <ChevronDown size={14} className="shrink-0 text-slate-500" />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-slate-500" />
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold text-slate-900">{violation.errorWhat}</div>
            <div className="truncate text-xs font-mono font-semibold text-slate-500">{violation.location}</div>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <StatusPill variant={severityVariant(violation.riskLevel)}>{violation.riskLevel}</StatusPill>
          <span className="hidden text-xs text-slate-500 lg:inline font-mono font-medium">{violation.source}</span>
          <button
            onClick={() => copyPrompt(buildCompactFixPrompt(violation))}
            title="Copy AI Fix Prompt"
            className="flex items-center gap-1.5 rounded-xl border border-red-100 bg-red-50/80 px-3 py-1.5 text-xs font-extrabold text-[#9E0B10] hover:bg-[#9E0B10] hover:text-white shadow-2xs"
          >
            <Clipboard size={12} />
            <span className="hidden sm:inline">Copy AI Fix Prompt</span>
          </button>
        </div>
      </div>
      {open && (
        <div className="space-y-3.5 border-t border-slate-100 px-4 py-4 text-sm bg-slate-50/40">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Policy violated</div>
            <p className="mt-1 text-slate-900 font-semibold">{violation.policyViolated}</p>
          </div>
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Why it matters</div>
            <p className="mt-1 text-slate-700 font-medium">{violation.why}</p>
          </div>
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500">How to fix</div>
            <p className="mt-1 text-emerald-700 font-bold">{violation.howToFix}</p>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Full prompt to fix</div>
              <button
                onClick={() => copyPrompt(violation.promptToFix)}
                className="text-xs font-extrabold text-[#9E0B10] hover:underline"
              >
                Copy
              </button>
            </div>
            <pre className="mt-1.5 whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-900 p-3.5 font-mono text-xs text-slate-100 shadow-inner">
              {violation.promptToFix}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
