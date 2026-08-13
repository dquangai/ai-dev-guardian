export function QwoangIcon({
  className = 'w-7 h-7',
  color = '#111111',
}: {
  className?: string
  color?: string
}) {
  return (
    <svg 
      className={`shrink-0 overflow-visible ${className}`} 
      viewBox="0 0 200 200" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Wave Hover Animated Ripple Rings */}
      <circle
        cx="100"
        cy="100"
        r="10"
        stroke={color}
        strokeOpacity="0"
        className="logo-wave-ring-1 transition-all"
      />
      <circle
        cx="100"
        cy="100"
        r="10"
        stroke={color}
        strokeOpacity="0"
        className="logo-wave-ring-2 transition-all"
      />

      {/* Outer Corner Reticle Brackets (┌ ┐ └ ┘) */}
      <g className="logo-wave-brackets transition-transform duration-300">
        {/* Top-Left ┌ */}
        <path d="M 28 42 H 42 M 28 42 V 56" stroke={color} strokeWidth="5" strokeLinecap="square" />
        {/* Top-Right ┐ */}
        <path d="M 172 42 H 158 M 172 42 V 56" stroke={color} strokeWidth="5" strokeLinecap="square" />
        {/* Bottom-Left └ */}
        <path d="M 28 158 H 42 M 28 158 V 144" stroke={color} strokeWidth="5" strokeLinecap="square" />
        {/* Bottom-Right ┘ */}
        <path d="M 172 158 H 158 M 172 158 V 144" stroke={color} strokeWidth="5" strokeLinecap="square" />
      </g>

      {/* Main Star Emblem & Diamond Core */}
      <g className="logo-wave-star transition-transform duration-300">
        {/* Main 4-Point Compass Star Blades */}
        <path
          d="
            M 100 12 L 116 76 L 188 100 L 116 124 
            L 100 188 L 84 124 L 12 100 L 84 76 Z
          "
          fill={color}
        />

        {/* 4 Diagonal Star Tips */}
        <path
          d="
            M 100 100 L 146 54 L 124 100 L 146 146 
            L 100 124 L 54 146 L 76 100 L 54 54 Z
          "
          fill={color}
          fillOpacity="0.85"
        />

        {/* Central Rotated Diamond Frame */}
        <path
          d="M 100 60 L 140 100 L 100 140 L 60 100 Z"
          fill={color}
        />

        {/* Inner Hollow Square Cutout */}
        <path
          d="M 100 78 L 122 100 L 100 122 L 78 100 Z"
          fill="#FFFFFF"
          className="dark:fill-[#18181B]"
        />

        {/* Inner Solid Center Core */}
        <path
          d="M 100 88 L 112 100 L 100 112 L 88 100 Z"
          fill={color}
        />
      </g>
    </svg>
  )
}

export function QwoangLogo({
  className = '',
  size = 'md',
  showSub = true,
  subText = 'AI GUARDIAN',
  textColor = 'text-[#111111] dark:text-[#F4F4F5]',
  iconColor = '#111111',
}: {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showSub?: boolean
  subText?: string
  textColor?: string
  iconColor?: string
}) {
  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-7 h-7',
    lg: 'w-9 h-9',
  }

  const titleSizes = {
    sm: 'text-sm tracking-[0.22em]',
    md: 'text-base tracking-[0.26em]',
    lg: 'text-xl tracking-[0.3em]',
  }

  const dividerHeights = {
    sm: 'h-5',
    md: 'h-6',
    lg: 'h-8',
  }

  return (
    <div className={`logo-wave-group flex items-center gap-3 select-none cursor-pointer transition-all ${className}`}>
      <QwoangIcon className={iconSizes[size]} color={iconColor} />

      {/* Vertical Divider Line | */}
      <div className={`w-px bg-[#D6D6D6] dark:bg-[#3F3F46] ${dividerHeights[size]}`} />

      {/* Brand Name & Subtitle */}
      <div className="flex flex-col">
        <span className={`font-extrabold font-sans ${titleSizes[size]} ${textColor} uppercase leading-none`}>
          QWOANG
        </span>
        {showSub && (
          <span className="text-[9px] font-mono tracking-[0.32em] text-[#777777] dark:text-[#A1A1AA] uppercase mt-1">
            {subText}
          </span>
        )}
      </div>
    </div>
  )
}
