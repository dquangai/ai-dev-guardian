import type { ReactNode } from 'react'

export function StatCard({
  label,
  value,
  icon,
  iconClassName = 'text-gray-400',
  sub,
  subClassName = 'text-gray-500',
  progress,
}: {
  label: string
  value: ReactNode
  icon: ReactNode
  iconClassName?: string
  sub?: ReactNode
  subClassName?: string
  progress?: number
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(158,11,16,0.08)] hover:border-red-200">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <span className={`p-2.5 rounded-xl bg-red-50 border border-red-100 shadow-2xs ${iconClassName}`}>{icon}</span>
      </div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{value}</div>
      {sub && <div className={`mt-1 text-xs font-semibold ${subClassName}`}>{sub}</div>}
      {progress !== undefined && (
        <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200/60">
          <div
            className="h-full rounded-full red-gradient shadow-xs"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  )
}
