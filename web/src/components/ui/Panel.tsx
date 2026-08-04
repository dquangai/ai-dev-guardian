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
        <h2 className="flex items-center gap-2.5 text-[15px] font-extrabold text-slate-900">
          {icon && <span className="p-1.5 rounded-lg bg-slate-100 text-slate-600">{icon}</span>}
          {title}
        </h2>
        {action}
      </header>
      <div className="p-6">{children}</div>
    </section>
  )
}
