import type { ReactNode } from 'react'

export function Panel({
  title,
  icon,
  action,
  children,
  className = '',
}: {
  title: string
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] ${className}`}>
      <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <h2 className="flex items-center gap-3 text-[15px] font-extrabold text-slate-900">
          {icon && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-50/80 border border-red-100/60 text-[#9E0B10] shadow-2xs">{icon}</span>}
          {title}
        </h2>
        {action}
      </header>
      <div className="p-6">{children}</div>
    </section>
  )
}
