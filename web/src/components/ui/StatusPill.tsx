const VARIANTS = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
  gray: 'bg-gray-100 text-gray-600 border-gray-200',
} as const

export type PillVariant = keyof typeof VARIANTS

export function StatusPill({ children, variant }: { children: React.ReactNode; variant: PillVariant }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${VARIANTS[variant]}`}
    >
      {children}
    </span>
  )
}

export function severityVariant(severity: string): PillVariant {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'red'
    case 'medium':
      return 'amber'
    default:
      return 'gray'
  }
}

export function verdictVariant(verdict: string): PillVariant {
  return verdict === 'BLOCK' ? 'red' : 'green'
}
