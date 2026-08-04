import { useState } from 'react'
import { ChevronDown, Code2, Crown, Shield, Star, type LucideIcon } from 'lucide-react'
import type { Role } from '../../lib/rbac'

type Tone = 'red' | 'gray'

const TONE_CLASSES: Record<Tone, { icon: string; iconBg: string }> = {
  red: { icon: 'text-[#9E0B10]', iconBg: 'bg-[#9E0B10]/5' },
  gray: { icon: 'text-gray-600', iconBg: 'bg-gray-100' },
}

interface DemoRoleOption {
  role: Role
  label: string
  description: string
  icon: LucideIcon
  tone: Tone
}

const DEMO_ROLES: DemoRoleOption[] = [
  { role: 'admin', label: 'Administrator', description: 'Highest level of access', icon: Crown, tone: 'red' },
  {
    role: 'senior-dev',
    label: 'Senior Dev Lead',
    description: 'Reviews and approves code changes',
    icon: Star,
    tone: 'red',
  },
  {
    role: 'developer',
    label: 'Developer',
    description: 'Runs AI Dev Guardian checks on their own code',
    icon: Code2,
    tone: 'gray',
  },
  {
    role: 'auditor',
    label: 'Auditor',
    description: 'Read-only audit oversight',
    icon: Shield,
    tone: 'gray',
  },
]

interface DemoModeSelectorProps {
  /** Called immediately on click — no password step, this *is* the login action. */
  onSelectRole: (role: Role) => void
  disabled?: boolean
}

/** Collapsible "quick login" card for the Login page — the only way in while the dashboard has
 * no real SSO, so every role must stay one click away (see AuthContext.loginAsDemo). */
export function DemoModeSelector({ onSelectRole, disabled }: DemoModeSelectorProps) {
  const [expanded, setExpanded] = useState(true)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)

  function handleSelect(role: Role) {
    if (disabled) return
    setSelectedRole(role)
    onSelectRole(role)
  }

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-3.5 shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-lg text-left"
        aria-expanded={expanded}
      >
        <div>
          <p className="text-sm font-semibold text-gray-900">Explore Demo Mode</p>
          <p className="mt-0.5 text-[11px] text-gray-500">Trải nghiệm AI Dev Guardian với các vai trò demo</p>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-gray-400 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {DEMO_ROLES.map(({ role, label, description, icon: Icon, tone }) => {
            const isSelected = selectedRole === role
            const { icon: iconClass, iconBg } = TONE_CLASSES[tone]
            return (
              <button
                key={role}
                type="button"
                title={description}
                disabled={disabled}
                onClick={() => handleSelect(role)}
                className={`group relative flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-center disabled:cursor-not-allowed disabled:opacity-60 ${
                  isSelected
                    ? 'border-[#9E0B10] bg-[#9E0B10]/5 shadow-sm'
                    : 'border-[#E5E7EB] bg-white hover:border-[#9E0B10] hover:bg-[#9E0B10]/5 hover:shadow-sm'
                }`}
              >
                {isSelected && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#9E0B10]" />}
                <span className={`flex h-7 w-7 items-center justify-center rounded-full ${iconBg}`}>
                  <Icon size={15} className={iconClass} />
                </span>
                <span className="w-full break-words text-[11px] font-medium leading-tight text-gray-900">
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
