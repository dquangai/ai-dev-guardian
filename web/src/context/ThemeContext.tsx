import React, { createContext, useContext, useEffect, useState } from 'react'

type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('app-theme') as ThemeMode
    return saved === 'dark' || saved === 'light' || saved === 'system' ? saved : 'light'
  })

  const [isDark, setIsDark] = useState<boolean>(false)

  useEffect(() => {
    const root = document.documentElement

    const applyTheme = (mode: ThemeMode) => {
      let dark = false
      if (mode === 'dark') {
        dark = true
      } else if (mode === 'light') {
        dark = false
      } else {
        dark = window.matchMedia('(prefers-color-scheme: dark)').matches
      }

      setIsDark(dark)
      if (dark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }

    applyTheme(theme)
    localStorage.setItem('app-theme', theme)

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => applyTheme('system')
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme])

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
