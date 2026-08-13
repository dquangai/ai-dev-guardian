import type { ReactNode } from 'react'

export function StatCard({
  label,
  value,
  icon,
  iconClassName = 'text-[#C8102E]',
  sub,
  subClassName = 'text-[#666666]',
  progress,
  actionLabel,
  onAction,
}: {
  label: string
  value: ReactNode
  icon: ReactNode
  iconClassName?: string
  sub?: ReactNode
  subClassName?: string
  progress?: number
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="tech-grid-card group relative p-4 flex flex-col justify-between select-none h-full">
      {/* Technical Corner Brackets (Corner Marks) */}
      <div className="absolute top-[6px] left-[6px] w-[8px] h-[8px] border-t border-l border-[#C8102E] pointer-events-none opacity-70 group-hover:opacity-100 transition-opacity" />
      <div className="absolute top-[6px] right-[6px] w-[8px] h-[8px] border-t border-r border-[#C8102E] pointer-events-none opacity-70 group-hover:opacity-100 transition-opacity" />
      <div className="absolute bottom-[6px] left-[6px] w-[8px] h-[8px] border-b border-l border-[#C8102E] pointer-events-none opacity-70 group-hover:opacity-100 transition-opacity" />
      <div className="absolute bottom-[6px] right-[6px] w-[8px] h-[8px] border-b border-r border-[#C8102E] pointer-events-none opacity-70 group-hover:opacity-100 transition-opacity" />

      {/* Header: Small Icon + Monospace Label */}
      <div>
        <div className="flex items-center justify-between gap-1.5">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#666666] dark:text-[#A1A1AA] truncate">
            {label}
          </span>
          <span className={`shrink-0 ${iconClassName}`}>{icon}</span>
        </div>

        {/* Value */}
        <div className="mt-2 text-xl font-bold font-mono tracking-tight text-[#111111] dark:text-[#F4F4F5]">
          {value}
        </div>

        {/* Subtext */}
        {sub && <div className={`mt-1 text-[11px] font-sans ${subClassName}`}>{sub}</div>}

        {/* Progress bar */}
        {progress !== undefined && (
          <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-[#E5E5E5] dark:bg-[#27272A]">
            <div
              className="h-full bg-[#C8102E] transition-all"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
      </div>

      {/* Action link */}
      {actionLabel && (
        <div className="mt-3 pt-2 flex items-center justify-between border-t border-[#E5E5E5]/60 dark:border-[#27272A]">
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#111111] dark:text-[#F4F4F5] hover:text-[#C8102E] dark:hover:text-rose-400 uppercase tracking-wider group-hover:translate-x-0.5 transition-all bg-transparent border-0 cursor-pointer p-0"
          >
            <span>{actionLabel}</span>
            <span>→</span>
          </button>
        </div>
      )}
    </div>
  )
}
