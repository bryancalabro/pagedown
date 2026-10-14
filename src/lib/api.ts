// the one call the app makes: GET /api/fetch?url=, on its own origin.
import type { Cuts } from './cuts'
import type { ErrorCode } from './messages'

export interface Fetched {
  ok: true
  url: string
  finalUrl: string
  status: number
  fetchedAt: string
  elapsedMs: number
  title: string
  byline: string
  siteName: string
  lang: string
  excerpt: string
  html: string
  cuts: Cuts
}

export type FetchFailure = { ok: false; code: ErrorCode; status?: number }

const CODES = new Set<ErrorCode>(['bad-url', 'blocked', 'dns', 'timeout', 'too-large', 'not-html', 'upstream', 'network', 'redirects', 'no-article', 'method'])

export async function fetchArticle(url: string, signal?: AbortSignal): Promise<Fetched | FetchFailure> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, code: 'offline' }
  let res: Response
  try {
    res = await fetch(`/api/fetch?url=${encodeURIComponent(url)}`, { signal, headers: { accept: 'application/json' } })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    return { ok: false, code: navigator.onLine === false ? 'offline' : 'server' }
  }
  let body: unknown
  try {
    body = await res.json()
  } catch {
    return { ok: false, code: 'server' }
  }
  const b = body as Omit<Partial<Fetched>, 'ok'> & { ok?: boolean; code?: ErrorCode; status?: number }
  if (b && b.ok === true && typeof b.html === 'string' && typeof b.title === 'string') return b as unknown as Fetched
  if (b && b.ok === false && b.code && CODES.has(b.code)) return { ok: false, code: b.code, status: typeof b.status === 'number' ? b.status : undefined }
  return { ok: false, code: 'server' }
}
