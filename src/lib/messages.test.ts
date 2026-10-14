import { describe, expect, it } from 'vitest'
import { errorMessage } from './messages'
import type { ErrorCode } from './messages'

describe('errorMessage', () => {
  it('gives every failure its own message', () => {
    const codes: ErrorCode[] = ['bad-url', 'blocked', 'dns', 'timeout', 'too-large', 'not-html', 'upstream', 'network', 'redirects', 'no-article', 'offline', 'server']
    const all = codes.map((c) => errorMessage(c, c === 'upstream' ? 404 : undefined))
    expect(new Set(all).size).toBe(codes.length)
    for (const m of all) expect(m).not.toMatch(/oops|something went wrong/i)
  })
  it('names the upstream status', () => {
    expect(errorMessage('upstream', 404)).toBe('The site has no page at that address (404). Check the link, or try again later.')
    expect(errorMessage('upstream', 403)).toContain('paste its HTML')
    expect(errorMessage('upstream', 418)).toBe('The site answered with an error (418). Check the link, or try again later.')
  })
})
