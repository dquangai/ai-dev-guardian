import { ShieldAlert } from 'lucide-react'
import { useApi } from '../lib/useApi'
import type { AuditRecord, Violation } from '../lib/types'
import { Panel } from '../components/ui/Panel'
import { ViolationList } from '../components/ui/ViolationList'
import { useAuth } from '../context/AuthContext'

export function Findings() {
  const { user } = useAuth()
  const { data: history } = useApi<AuditRecord[]>('/audit/history')

  // A developer only sees their own audit runs — Admin and Senior Dev keep the
  // full team picture, since policy/approval decisions need that visibility.
  const isDeveloper = user?.role === 'developer'

  const visibleHistory = isDeveloper ? (history ?? []).filter((r) => r.triggeredBy === user?.id) : (history ?? [])
  const allViolations: Violation[] = visibleHistory.flatMap((r) => r.violations)

  return (
    <Panel
      title={isDeveloper ? 'My Findings' : 'Findings'}
      icon={<ShieldAlert size={18} className="text-[#9E0B10]" />}
      action={<span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">{allViolations.length} total</span>}
    >
      <ViolationList violations={allViolations} />
    </Panel>
  )
}
