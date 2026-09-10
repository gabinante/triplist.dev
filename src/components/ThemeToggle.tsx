import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? 'dark')
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try { localStorage.setItem('triplist-theme', next) } catch { /* This session still switches. */ }
    setTheme(next)
  }
  const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`
  return (
    <button type="button" onClick={toggle} aria-label={label} title={label}
      className="mx-1 flex min-h-11 shrink-0 items-center justify-center gap-3 rounded-xl px-3 text-sm text-bark-300 hover:bg-white/10 md:mx-3 md:mb-2 md:justify-start">
      {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      <span className="hidden md:inline">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
    </button>
  )
}
