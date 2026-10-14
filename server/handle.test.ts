import { readFileSync } from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import zlib from 'node:zlib'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { defaultDeps, fetchPage } from './fetchPage'
import type { FetchDeps } from './fetchPage'
import { isBlockedAddress } from './guard'
import { handle } from './handle'

const fixture = readFileSync(new URL('../src/test/fixtures/article.html', import.meta.url), 'utf8')

// a local server stands in for the web. "public.test" resolves to it, and only its own
// loopback address is let through the guard, so every other private address stays refused.
let server: http.Server
let port = 0
const hits: string[] = []

beforeAll(async () => {
  server = http.createServer((req, res) => {
    hits.push(req.url ?? '')
    const path = req.url ?? '/'
    if (path === '/article') return res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(fixture)
    if (path === '/gzip') return res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' }).end(zlib.gzipSync(fixture))
    if (path === '/hop') return res.writeHead(301, { location: '/article' }).end()
    if (path === '/to-metadata') return res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' }).end()
    if (path === '/to-private-name') return res.writeHead(302, { location: `http://private.test:${port}/article` }).end()
    if (path === '/loop') return res.writeHead(302, { location: '/loop' }).end()
    if (path === '/pdf') return res.writeHead(200, { 'content-type': 'application/pdf' }).end('%PDF-1.7')
    if (path === '/big') {
      res.writeHead(200, { 'content-type': 'text/html' })
      return res.end('<p>' + 'x'.repeat(4096) + '</p>')
    }
    if (path === '/slow') return void setTimeout(() => res.writeHead(200, { 'content-type': 'text/html' }).end(fixture), 1500)
    if (path === '/missing') return res.writeHead(404, { 'content-type': 'text/html' }).end('nope')
    if (path === '/menu') return res.writeHead(200, { 'content-type': 'text/html' }).end('<nav><a href="/">Home</a></nav>')
    if (path === '/latin1') {
      res.writeHead(200, { 'content-type': 'text/html; charset=iso-8859-1' })
      return res.end(Buffer.from(fixture.replace('Quiet software', 'Café software'), 'latin1'))
    }
    res.writeHead(500).end()
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  port = (server.address() as AddressInfo).port
})
afterAll(() => new Promise<void>((r) => server.close(() => r())))

const deps = (over: Partial<FetchDeps> = {}): FetchDeps => ({
  ...defaultDeps,
  ports: [80, 443, port],
  resolve: async (host) => {
    if (host === 'public.test') return [{ address: '127.0.0.1', family: 4 }]
    if (host === 'private.test') return [{ address: '10.0.0.7', family: 4 }]
    if (host === 'mixed.test') return [{ address: '93.184.215.14', family: 4 }, { address: '127.0.0.2', family: 4 }]
    throw Object.assign(new Error('nx'), { code: 'ENOTFOUND' })
  },
  isBlocked: (ip) => ip !== '127.0.0.1' && isBlockedAddress(ip),
  ...over,
})
const at = (path: string) => `http://public.test:${port}${path}`
const api = (query: string, d = deps()) => handle(new Request(`https://pagedown.bryancalabro.com/api/fetch?${query}`), d, () => new Date('2026-10-14T15:00:00Z'))
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e: { code: string }) => e.code)

describe('fetchPage', () => {
  it('fetches html, follows a redirect and reports the final url', async () => {
    const page = await fetchPage(at('/hop'), deps())
    expect(page.status).toBe(200)
    expect(page.finalUrl).toBe(at('/article'))
    expect(page.html).toContain('Field notes on quiet software')
  })
  it('decompresses gzip and decodes the declared charset', async () => {
    expect((await fetchPage(at('/gzip'), deps())).html).toContain('quiet software')
    expect((await fetchPage(at('/latin1'), deps())).html).toContain('Café software')
  })
  it('refuses a redirect to the metadata address without connecting to it', async () => {
    const spy = vi.spyOn(http, 'request')
    expect(await code(fetchPage(at('/to-metadata'), deps()))).toBe('blocked')
    // one request for the first hop, none for the refused one
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
  it('refuses a redirect to a name that resolves to a private address', async () => {
    expect(await code(fetchPage(at('/to-private-name'), deps()))).toBe('blocked')
  })
  it('refuses a host when any of its addresses is private', async () => {
    expect(await code(fetchPage('http://mixed.test/', deps()))).toBe('blocked')
  })
  it('refuses private literals, localhost names, odd ports and credentials', async () => {
    const real = { ...defaultDeps, resolve: deps().resolve }
    expect(await code(fetchPage('http://127.0.0.1/', real))).toBe('blocked')
    expect(await code(fetchPage('http://[::1]/', real))).toBe('blocked')
    expect(await code(fetchPage('http://169.254.169.254/latest/meta-data/', real))).toBe('blocked')
    expect(await code(fetchPage('http://localhost/', real))).toBe('blocked')
    expect(await code(fetchPage('http://example.com:22/', real))).toBe('blocked')
    expect(await code(fetchPage('http://user:pass@example.com/', real))).toBe('bad-url')
  })
  it('stops past five megabytes, ten seconds, or five redirects, and on anything but html', async () => {
    expect(await code(fetchPage(at('/big'), deps({ maxBytes: 1024 })))).toBe('too-large')
    expect(await code(fetchPage(at('/slow'), deps({ timeoutMs: 200 })))).toBe('timeout')
    expect(await code(fetchPage(at('/loop'), deps()))).toBe('redirects')
    expect(await code(fetchPage(at('/pdf'), deps()))).toBe('not-html')
    expect(defaultDeps.maxBytes).toBe(5 * 1024 * 1024)
    expect(defaultDeps.timeoutMs).toBe(10_000)
  })
  it('names an upstream failure and an unknown host', async () => {
    await expect(fetchPage(at('/missing'), deps())).rejects.toMatchObject({ code: 'upstream', status: 404 })
    expect(await code(fetchPage('http://nowhere.test/', deps()))).toBe('dns')
  })
})

describe('handle', () => {
  it('answers the article as trimmed json with edge caching', async () => {
    const res = await api(`url=${encodeURIComponent(at('/article'))}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toMatch(/s-maxage=\d+/)
    expect(res.headers.get('cache-control')).toMatch(/stale-while-revalidate=\d+/)
    expect(res.headers.get('cache-control')).toMatch(/stale-if-error=\d+/)
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, status: 200, title: 'Field notes on quiet software', byline: 'Ada Byrne', fetchedAt: '2026-10-14T15:00:00.000Z' })
    expect(body.cuts.nav).toBe(1)
    expect(body.html).not.toContain('Cookie settings')
  })
  it('allows only one url parameter', async () => {
    for (const q of ['', 'u=x', `url=${encodeURIComponent(at('/article'))}&x=1`, 'url=a&url=b', 'url=ftp%3A%2F%2Fexample.com', `url=${'a'.repeat(3000)}`]) {
      const res = await api(q)
      expect(res.status, q).toBe(400)
      expect(await res.json()).toEqual({ ok: false, code: 'bad-url' })
    }
  })
  it('refuses other methods', async () => {
    const res = await handle(new Request('https://x.test/api/fetch?url=example.com', { method: 'POST' }))
    expect(res.status).toBe(405)
  })
  it('never caches a failure', async () => {
    const res = await api(`url=${encodeURIComponent(at('/missing'))}`)
    expect(res.status).toBe(502)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual({ ok: false, code: 'upstream', status: 404 })
    const menu = await api(`url=${encodeURIComponent(at('/menu'))}`)
    expect(await menu.json()).toEqual({ ok: false, code: 'no-article' })
    const blocked = await api(`url=${encodeURIComponent(at('/to-metadata'))}`)
    expect(blocked.status).toBe(403)
    expect(blocked.headers.get('cache-control')).toBe('no-store')
  })
})
