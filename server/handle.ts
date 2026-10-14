// the /api/fetch function: one allow-listed parameter, a guarded fetch, readability on the
// server, and a trimmed json answer the client turns into markdown. successes cache at the
// edge; failures never do.
import { parseHTML } from 'linkedom'
import { extract } from '../src/lib/extract.js'
import type { Cuts } from '../src/lib/extract.js'
import { normalizeUrl } from '../src/lib/url.js'
import { FetchError, defaultDeps, fetchPage } from './fetchPage.js'
import type { FetchDeps } from './fetchPage.js'

export type ErrorCode = FetchError['code'] | 'no-article' | 'method'

export interface FetchOk {
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

export interface FetchFail {
  ok: false
  code: ErrorCode
  status?: number
}

export type FetchResult = FetchOk | FetchFail

const MAX_URL = 2048
// the article html the client receives; past this the page is cut, not the request failed
const MAX_ARTICLE = 1_500_000

const STATUS: Record<ErrorCode, number> = {
  'bad-url': 400,
  method: 405,
  blocked: 403,
  dns: 502,
  timeout: 504,
  'too-large': 413,
  'not-html': 415,
  upstream: 502,
  network: 502,
  redirects: 508,
  'no-article': 422,
}

const json = (body: FetchResult, status: number, cache: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache, 'x-content-type-options': 'nosniff' },
  })

const fail = (code: ErrorCode, status?: number) => json(status ? { ok: false, code, status } : { ok: false, code }, STATUS[code], 'no-store')

const parse = (html: string) => parseHTML(html).document as unknown as Document

export async function handle(request: Request, deps: FetchDeps = defaultDeps, now: () => Date = () => new Date()): Promise<Response> {
  if (request.method !== 'GET') return fail('method')
  const params = new URL(request.url).searchParams
  const keys = Array.from(params.keys())
  // one parameter, once: anything else is refused rather than ignored
  if (keys.length !== 1 || keys[0] !== 'url') return fail('bad-url')
  const raw = params.get('url') ?? ''
  if (raw.length > MAX_URL) return fail('bad-url')
  const normalized = normalizeUrl(raw)
  if (!normalized.ok) return fail('bad-url')

  let page
  try {
    page = await fetchPage(normalized.url, deps)
  } catch (err) {
    if (err instanceof FetchError) return fail(err.code, err.code === 'upstream' ? err.status : undefined)
    return fail('network')
  }

  const article = extract(page.html, page.finalUrl, parse)
  if (!article) return fail('no-article')

  const body: FetchOk = {
    ok: true,
    url: normalized.url,
    finalUrl: page.finalUrl,
    status: page.status,
    fetchedAt: now().toISOString(),
    elapsedMs: page.elapsedMs,
    title: article.title.slice(0, 300),
    byline: article.byline.slice(0, 200),
    siteName: article.siteName.slice(0, 200),
    lang: article.lang.slice(0, 35),
    excerpt: article.excerpt.slice(0, 500),
    html: article.html.slice(0, MAX_ARTICLE),
    cuts: article.cuts,
  }
  return json(body, 200, 'public, max-age=0, s-maxage=900, stale-while-revalidate=3600, stale-if-error=86400')
}
