'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      title="Cambiar tema"
      aria-label="Cambiar entre modo claro y oscuro"
    >
      <span className="only-light">
        <Moon />
      </span>
      <span className="only-dark">
        <Sun />
      </span>
    </button>
  )
}
