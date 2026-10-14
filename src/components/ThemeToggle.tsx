import { useState } from 'react'
import { load, save } from '../lib/store'
import { applyTheme, nextTheme } from '../lib/theme'
import type { ThemeChoice } from '../lib/store'

const LABEL: Record<ThemeChoice, string> = {
  system: 'Theme follows your device. Switch to light',
  light: 'Light theme. Switch to dark',
  dark: 'Dark theme. Switch to follow your device',
}

function Icon({ theme }: { theme: ThemeChoice }) {
  // a page with a folded corner: blank paper for light, inked for dark, half inked for the device
  const page = 'M6 3h8l4 4v14H6Z'
  if (theme === 'light') return <path d={page} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  if (theme === 'dark') return <path d={page} fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  return (
    <>
      <path d={page} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6 12h12v9H6Z" fill="currentColor" />
    </>
  )
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeChoice>(() => load().theme)
  const cycle = () => {
    const next = nextTheme(theme)
    setTheme(next)
    applyTheme(next)
    save({ ...load(), theme: next })
  }
  return (
    <button type="button" className="theme-button" onClick={cycle} aria-label={LABEL[theme]} title={LABEL[theme]}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <Icon theme={theme} />
      </svg>
    </button>
  )
}
