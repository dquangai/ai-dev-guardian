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
    <section className={`rounded-2xl border border-gray-200 bg-white ${className}`}>
      <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-gray-900">
          {icon}
          {title}
        </h2>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}
