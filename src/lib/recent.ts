import { RECENT_LIMIT } from './store'
import type { Recent } from './store'

/** newest first, one entry per url, capped */
export function remember(list: Recent[], entry: Recent): Recent[] {
  return [entry, ...list.filter((r) => r.url !== entry.url)].slice(0, RECENT_LIMIT)
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
