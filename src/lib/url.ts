// what the url field accepts, and the cleanup applied to links in the output

export type Normalized = { ok: true; url: string } | { ok: false; reason: 'empty' | 'scheme' | 'invalid' }

const SCHEME = /^([a-z][a-z0-9+.-]*):/i

/** a bare domain gets https; anything that is not http or https is refused before any request */
export function normalizeUrl(input: string): Normalized {
  const raw = input.trim()
  if (!raw) return { ok: false, reason: 'empty' }
  const scheme = SCHEME.exec(raw)?.[1]?.toLowerCase()
  // "example.com:8080/x" reads as a scheme to the regex; a dot before the colon means it is a host
  const isHostPort = !!scheme && /^[^/]*\.[^/]*:\d/.test(raw)
  let candidate = raw
  if (!scheme || isHostPort) candidate = `https://${raw.replace(/^\/\//, '')}`
  else if (scheme !== 'http' && scheme !== 'https') return { ok: false, reason: 'scheme' }
  try {
    const u = new URL(candidate)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, reason: 'scheme' }
    // a host needs a dot or to be an ip literal; "hello" alone is a typo, not a site
    if (!u.hostname.includes('.') && !u.hostname.includes(':') && !/^\[/.test(u.hostname)) return { ok: false, reason: 'invalid' }
    return { ok: true, url: u.href }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}

// parameters that only exist to track a click; anything else on a link is kept
const TRACKING = [/^utm_/i, /^(fbclid|gclid|dclid|gbraid|wbraid|msclkid|yclid|twclid|igshid|mc_cid|mc_eid|_hsenc|_hsmi|mkt_tok|vero_id|oly_anon_id|oly_enc_id|rb_clickid|s_cid|ttclid)$/i]

export function stripTracking(href: string): string {
  let u: URL
  try {
    u = new URL(href)
  } catch {
    return href
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return href
  const keys = Array.from(u.searchParams.keys())
  const drop = keys.filter((k) => TRACKING.some((re) => re.test(k)))
  if (!drop.length) return href
  for (const k of drop) u.searchParams.delete(k)
  return u.href
}

/** a file name from a title: lowercase words joined by hyphens, at most 80 characters */
export function slugify(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
  return slug || 'page'
}
