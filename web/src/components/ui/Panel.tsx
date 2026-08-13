import type { ReactNode } from 'react'

export function Panel({
  title,
  icon,
  action,
  children,
  className = '',
  useGridPattern = false,
}: {
  title: string
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  useGridPattern?: boolean
}) {
  const containerStyle = useGridPattern
    ? 'tech-grid-card relative p-0 select-none overflow-hidden'
    : 'rounded-[12px] border border-[#D6D6D6] bg-white shadow-xs relative p-0 select-none overflow-hidden'

  return (
    <section className={`${containerStyle} ${className}`}>
      {/* Corner Brackets */}
      <div className="absolute top-[6px] left-[6px] w-[8px] h-[8px] border-t border-l border-[#C8102E] pointer-events-none opacity-80" />
      <div className="absolute top-[6px] right-[6px] w-[8px] h-[8px] border-t border-r border-[#C8102E] pointer-events-none opacity-80" />
      <div className="absolute bottom-[6px] left-[6px] w-[8px] h-[8px] border-b border-l border-[#C8102E] pointer-events-none opacity-80" />
      <div className="absolute bottom-[6px] right-[6px] w-[8px] h-[8px] border-b border-r border-[#C8102E] pointer-events-none opacity-80" />

      <header className="flex items-center justify-between border-b border-[#E5E5E5] dark:border-[#27272A] px-5 py-3.5 bg-white/50 dark:bg-transparent">
        <h2 className="flex items-center gap-2.5 text-sm font-semibold text-[#111111] dark:text-[#F4F4F5] font-sans">
          {icon && <span className="text-[#C8102E] shrink-0">{icon}</span>}
          <span>{title}</span>
        </h2>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}
