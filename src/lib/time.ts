const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "just now", "5 minutes ago", "yesterday", "3 weeks ago" */
export function ago(then: number, now: number): string {
  const s = Math.round((then - now) / 1000)
  const abs = Math.abs(s)
  if (abs < 45) return 'just now'
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour')
  if (abs < 86400 * 7) return rtf.format(Math.round(s / 86400), 'day')
  if (abs < 86400 * 30) return rtf.format(Math.round(s / (86400 * 7)), 'week')
  return rtf.format(Math.round(s / (86400 * 30)), 'month')
}
