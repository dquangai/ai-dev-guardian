const VARIANTS = {
  green: 'bg-emerald-50 text-emerald-800 border-emerald-200/80 font-bold',
  red: 'bg-red-50 text-[#9E0B10] border-red-200/80 font-extrabold shadow-2xs',
  amber: 'bg-amber-50 text-amber-800 border-amber-200/80 font-bold',
  blue: 'bg-blue-50 text-blue-800 border-blue-200/80 font-bold',
  violet: 'bg-purple-50 text-purple-800 border-purple-200/80 font-bold',
  gray: 'bg-slate-100 text-slate-700 border-slate-200/80 font-semibold',
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
