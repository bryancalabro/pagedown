import type { ThemeChoice } from './store'

/** the order the one theme button cycles through */
export const THEME_ORDER: ThemeChoice[] = ['system', 'light', 'dark']

export const nextTheme = (t: ThemeChoice): ThemeChoice => THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length]

/** write the choice onto <html>; system removes the attribute so prefers-color-scheme decides */
export function applyTheme(t: ThemeChoice, root: HTMLElement = document.documentElement) {
  if (t === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', t)
}
