import type { ButtonHTMLAttributes, ReactNode } from 'react'

export interface TechButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode
  label?: string
  showArrow?: boolean
  fullWidth?: boolean
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
}

export function TechButton({
  children,
  label,
  showArrow = true,
  fullWidth = false,
  size = 'md',
  icon,
  className = '',
  ...props
}: TechButtonProps) {
  const paddingSizes = {
    sm: 'px-3 py-1.5 text-[11px]',
    md: 'px-4 py-2.5 text-[12px]',
    lg: 'px-5 py-3 text-[13px]',
  }

  const content = label || children

  return (
    <button
      type="button"
      className={`tech-button group inline-flex items-center justify-between gap-4 ${
        paddingSizes[size]
      } ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      <span className="inline-flex items-center gap-2 text-left truncate">
        {icon && <span className="shrink-0">{icon}</span>}
        <span className="truncate">{content}</span>
      </span>
      {showArrow && (
        <span className="shrink-0 font-mono text-sm leading-none transition-transform duration-200 ease-in-out group-hover:translate-x-[4px]">
          →
        </span>
      )}
    </button>
  )
}
