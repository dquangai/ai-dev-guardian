import { Activity } from 'lucide-react'
import { useApi } from '../lib/useApi'
import type { SystemDiagnostics as SystemDiagnosticsData } from '../lib/types'
import { Panel } from '../components/ui/Panel'
import { StatusPill } from '../components/ui/StatusPill'

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-3 text-sm last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  )
}

export function SystemDiagnostics() {
  const { data } = useApi<SystemDiagnosticsData>('/system/diagnostics')

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Panel title="Runtime" icon={<Activity size={16} className="text-gray-400" />}>
        <Row label="Node.js version" value={data?.nodeVersion ?? '—'} />
        <Row label="Platform" value={data?.platform ?? '—'} />
        <Row label="Git repository" value={data?.isGitRepo ? 'Yes' : 'No'} />
        <Row label="Git branch" value={data?.gitBranch ?? 'unknown'} />
        <Row
          label="Gate Guard"
          value={<StatusPill variant={data?.gateGuardActive ? 'green' : 'red'}>{data?.gateGuardActive ? 'ACTIVE' : 'INACTIVE'}</StatusPill>}
        />
      </Panel>

      <Panel title="Guardian State" icon={<Activity size={16} className="text-gray-400" />}>
        <Row label="Policies loaded" value={data?.policiesLoaded ?? 0} />
        <Row label="Cached PASS hashes" value={data?.cachedPassHashes ?? 0} />
        <Row label="Cache file present" value={data?.cacheFileExists ? 'Yes' : 'No'} />
      </Panel>

      <Panel title="AI Engine" icon={<Activity size={16} className="text-gray-400" />} className="lg:col-span-2">
        <Row
          label="Active provider"
          value={
            data?.llm.provider ? (
              <StatusPill variant="blue">{data.llm.provider}</StatusPill>
            ) : (
              <StatusPill variant="gray">not configured</StatusPill>
            )
          }
        />
        <Row label="Anthropic API key present" value={data?.llm.hasAnthropicKey ? 'Yes' : 'No'} />
        <Row label="OpenAI API key present" value={data?.llm.hasOpenAIKey ? 'Yes' : 'No'} />
        <Row label="Effective LLM model override" value={data?.llm.effectiveLlmModel ?? 'provider default'} />
        <Row label="Effective judge model override" value={data?.llm.effectiveJudgeModel ?? 'provider default'} />
        <Row label="Semgrep ruleset" value={data?.llm.effectiveSemgrepConfig ?? 'p/security-audit'} />
      </Panel>
    </div>
  )
}
