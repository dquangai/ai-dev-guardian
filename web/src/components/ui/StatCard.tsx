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
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
        <span className={iconClassName}>{icon}</span>
      </div>
      <div className="mt-2 text-3xl font-semibold text-gray-900">{value}</div>
      {sub && <div className={`mt-1 text-sm ${subClassName}`}>{sub}</div>}
      {progress !== undefined && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  )
}
