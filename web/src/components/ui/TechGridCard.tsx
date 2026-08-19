import type { ReactNode } from 'react'

export interface TechGridCardProps {
  category?: string
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  actionLabel?: string
  onAction?: () => void
  actionHref?: string
  className?: string
  value?: ReactNode
  sub?: ReactNode
  statusPill?: ReactNode
}

export function TechGridCard({
  category,
  title,
  description,
  icon,
  actionLabel = 'VIEW DETAILS',
  onAction,
  actionHref,
  className = '',
  value,
  sub,
  statusPill,
}: TechGridCardProps) {
  return (
    <div className={`tech-grid-card group relative p-5 flex flex-col justify-between select-none ${className}`}>
      {/* Technical Corner Brackets (Corner Marks) */}
      <div className="absolute top-[7px] left-[7px] w-[9px] h-[9px] border-t border-l border-[#C8102E] dark:border-[#FF6B6B] pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity" />
      <div className="absolute top-[7px] right-[7px] w-[9px] h-[9px] border-t border-r border-[#C8102E] dark:border-[#FF6B6B] pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity" />
      <div className="absolute bottom-[7px] left-[7px] w-[9px] h-[9px] border-b border-l border-[#C8102E] dark:border-[#FF6B6B] pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity" />
      <div className="absolute bottom-[7px] right-[7px] w-[9px] h-[9px] border-b border-r border-[#C8102E] dark:border-[#FF6B6B] pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity" />

      {/* Card Header: Category + Icon & Optional Status Pill */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-wider uppercase text-[#C8102E] dark:text-[#FF6B6B]">
            {icon && <span className="text-[#C8102E] dark:text-[#FF6B6B] shrink-0 text-base">{icon}</span>}
            {category && <span>{category}</span>}
          </div>
          {statusPill && <div>{statusPill}</div>}
        </div>

        {/* Card Title or Main Value */}
        <div className="mt-3">
          <h3 className="text-sm font-semibold text-[#111111] dark:text-[#F4F4F5] font-mono tracking-tight leading-snug">
            {title}
          </h3>
          {value !== undefined && (
            <div className="mt-1 text-2xl font-bold font-mono tracking-tight text-[#111111] dark:text-[#F4F4F5]">
              {value}
            </div>
          )}
        </div>

        {/* Description or Subtext */}
        {(description || sub) && (
          <p className="mt-2 text-xs text-[#666666] dark:text-[#A1A1AA] leading-relaxed line-clamp-2 font-sans">
            {description || sub}
          </p>
        )}
      </div>

      {/* Text Link Action with Arrow */}
      {(actionLabel || onAction || actionHref) && (
        <div className="mt-4 pt-3 flex items-center justify-between border-t border-[#E5E5E5]/70 dark:border-[#27272A]">
          {actionHref ? (
            <a
              href={actionHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-[#111111] dark:text-[#F4F4F5] hover:text-[#C8102E] dark:hover:text-rose-400 uppercase tracking-wider group-hover:translate-x-0.5 transition-all"
            >
              <span>{actionLabel}</span>
              <span>→</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-[#111111] dark:text-[#F4F4F5] hover:text-[#C8102E] dark:hover:text-rose-400 uppercase tracking-wider group-hover:translate-x-0.5 transition-all bg-transparent border-0 cursor-pointer p-0"
            >
              <span>{actionLabel}</span>
              <span>→</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
