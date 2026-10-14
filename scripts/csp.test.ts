import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// the one inline script in index.html (the no-flash theme) is allowed by its hash, not unsafe-inline
describe('content security policy', () => {
  it('allows the inline theme script by its current sha256', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
    expect(inline).toHaveLength(1)
    const hash = `'sha256-${createHash('sha256').update(inline[0]).digest('base64')}'`
    const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')
    expect(vercel).toContain(hash)
    expect(vercel).not.toContain('unsafe-inline')
  })
})
