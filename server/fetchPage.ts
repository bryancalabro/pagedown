// downloads one html page for the converter, with every guard the function needs:
// http and https only, standard ports, no credentials in the url, a public address on
// every hop (checked on the address the socket actually connects to), at most five
// redirects, a ten second budget for the whole chain, five megabytes after decompression,
// and html only.
import { lookup as dnsLookup } from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import { isIP } from 'node:net'
import type { LookupFunction } from 'node:net'
import { Readable } from 'node:stream'
import zlib from 'node:zlib'
import { isBlockedAddress } from './guard.js'

export type FetchErrorCode = 'bad-url' | 'blocked' | 'dns' | 'timeout' | 'too-large' | 'not-html' | 'upstream' | 'network' | 'redirects'

export class FetchError extends Error {
  readonly code: FetchErrorCode
  readonly status?: number
  constructor(code: FetchErrorCode, message: string, status?: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

export interface Fetched {
  status: number
  finalUrl: string
  contentType: string
  html: string
  elapsedMs: number
}

export interface FetchDeps {
  resolve: (host: string) => Promise<{ address: string; family: number }[]>
  isBlocked: (address: string) => boolean
  ports: number[]
  timeoutMs: number
  maxBytes: number
  maxRedirects: number
  userAgent: string
}

export const defaultDeps: FetchDeps = {
  resolve: (host) => dnsLookup(host, { all: true, verbatim: true }),
  isBlocked: isBlockedAddress,
  ports: [80, 443],
  timeoutMs: 10_000,
  maxBytes: 5 * 1024 * 1024,
  maxRedirects: 5,
  userAgent: 'Mozilla/5.0 (compatible; Pagedown/1.0; +https://pagedown.bryancalabro.com)',
}

const HTML_TYPES = /^(text\/html|application\/xhtml\+xml)\b/i

function checkUrl(raw: string, deps: FetchDeps): URL {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new FetchError('bad-url', 'not a url')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new FetchError('bad-url', 'only http and https')
  if (u.username || u.password) throw new FetchError('bad-url', 'credentials in url')
  const port = u.port ? Number(u.port) : u.protocol === 'https:' ? 443 : 80
  if (!deps.ports.includes(port)) throw new FetchError('blocked', `port ${port}`)
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host) && deps.isBlocked(host)) throw new FetchError('blocked', `address ${host}`)
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(host)) throw new FetchError('blocked', `host ${host}`)
  return u
}

/** a dns lookup for the socket that refuses the whole host if any of its addresses is private */
function guardedLookup(deps: FetchDeps): LookupFunction {
  return (hostname, options, callback) => {
    deps
      .resolve(hostname)
      .then((all) => {
        if (!all.length) throw Object.assign(new Error('no address'), { code: 'ENOTFOUND' })
        const bad = all.find((a) => deps.isBlocked(a.address))
        if (bad) throw Object.assign(new Error(`blocked address ${bad.address}`), { code: 'EBLOCKED' })
        const wanted = options.family === 4 || options.family === 6 ? all.filter((a) => a.family === options.family) : all
        if (!wanted.length) throw Object.assign(new Error('no address of that family'), { code: 'ENOTFOUND' })
        if (options.all) callback(null, wanted)
        else callback(null, wanted[0].address, wanted[0].family)
      })
      .catch((err: NodeJS.ErrnoException) => callback(err, '', 0))
  }
}

function charsetOf(contentType: string, head: Buffer): string {
  const fromHeader = /charset=["']?([\w.:-]+)/i.exec(contentType)?.[1]
  if (fromHeader) return fromHeader
  const sniff = head.subarray(0, 4096).toString('latin1')
  return /<meta[^>]+charset=["']?([\w.:-]+)/i.exec(sniff)?.[1] ?? 'utf-8'
}

function decode(body: Buffer, contentType: string): string {
  try {
    return new TextDecoder(charsetOf(contentType, body)).decode(body)
  } catch {
    return new TextDecoder('utf-8').decode(body)
  }
}

function decompress(res: http.IncomingMessage): Readable {
  const enc = String(res.headers['content-encoding'] ?? '').toLowerCase().trim()
  if (enc === 'gzip' || enc === 'x-gzip') return res.pipe(zlib.createGunzip())
  if (enc === 'deflate') return res.pipe(zlib.createInflate())
  if (enc === 'br') return res.pipe(zlib.createBrotliDecompress())
  return res
}

type Hop = { kind: 'redirect'; location: string; status: number } | { kind: 'page'; status: number; contentType: string; body: Buffer }

function request(url: URL, deps: FetchDeps, signal: AbortSignal): Promise<Hop> {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === 'https:' ? https : http
    const req = mod.request(
      url,
      {
        method: 'GET',
        lookup: guardedLookup(deps),
        signal,
        headers: {
          'user-agent': deps.userAgent,
          accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
          'accept-encoding': 'gzip, deflate, br',
          'accept-language': 'en;q=1, *;q=0.5',
        },
      },
      (res) => {
        const status = res.statusCode ?? 0
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume()
          resolve({ kind: 'redirect', location: res.headers.location, status })
          return
        }
        if (status >= 400) {
          res.resume()
          reject(new FetchError('upstream', `upstream ${status}`, status))
          return
        }
        const contentType = String(res.headers['content-type'] ?? '')
        if (!HTML_TYPES.test(contentType)) {
          res.resume()
          reject(new FetchError('not-html', `content type ${contentType || 'missing'}`))
          return
        }
        const declared = Number(res.headers['content-length'])
        if (Number.isFinite(declared) && declared > deps.maxBytes) {
          res.destroy()
          reject(new FetchError('too-large', `declared ${declared} bytes`))
          return
        }
        const chunks: Buffer[] = []
        let size = 0
        const stream = decompress(res)
        stream.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > deps.maxBytes) {
            res.destroy()
            stream.destroy()
            reject(new FetchError('too-large', `over ${deps.maxBytes} bytes`))
            return
          }
          chunks.push(chunk)
        })
        stream.on('end', () => resolve({ kind: 'page', status, contentType, body: Buffer.concat(chunks) }))
        stream.on('error', (err) => reject(err))
      },
    )
    req.on('error', reject)
    req.end()
  })
}

function classify(err: unknown, signal: AbortSignal): FetchError {
  if (err instanceof FetchError) return err
  if (signal.aborted) return new FetchError('timeout', 'took too long')
  const code = (err as NodeJS.ErrnoException)?.code
  if (code === 'EBLOCKED') return new FetchError('blocked', (err as Error).message)
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'ENODATA') return new FetchError('dns', 'no such host')
  if (code === 'ABORT_ERR') return new FetchError('timeout', 'took too long')
  return new FetchError('network', String(code ?? (err as Error)?.message ?? 'network'))
}

/** fetch an html page through every guard; throws FetchError */
export async function fetchPage(rawUrl: string, deps: FetchDeps = defaultDeps): Promise<Fetched> {
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs)
  try {
    let url = checkUrl(rawUrl, deps)
    for (let hop = 0; ; hop++) {
      let res: Hop
      try {
        res = await request(url, deps, controller.signal)
      } catch (err) {
        throw classify(err, controller.signal)
      }
      if (res.kind === 'page') {
        return { status: res.status, finalUrl: url.href, contentType: res.contentType, html: decode(res.body, res.contentType), elapsedMs: Date.now() - started }
      }
      if (hop >= deps.maxRedirects) throw new FetchError('redirects', 'too many redirects')
      let next: string
      try {
        next = new URL(res.location, url).href
      } catch {
        throw new FetchError('upstream', 'bad redirect', res.status)
      }
      url = checkUrl(next, deps)
    }
  } finally {
    clearTimeout(timer)
  }
}
