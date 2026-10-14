import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
import { compose, countWords, estimateTokens, frontMatter, readingMinutes } from './compose'
import { extract } from './extract'
import { toMarkdown } from './markdown'

const fixture = readFileSync(new URL('../test/fixtures/article.html', import.meta.url), 'utf8')
const parse = (html: string) => new JSDOM(html).window.document
const article = extract(fixture, 'https://example.com/guide/field-notes', parse)!
const md = (o: Partial<Parameters<typeof toMarkdown>[1]> = {}) => toMarkdown(article.html, { images: true, referenceLinks: false, stripTracking: true, ...o })

describe('toMarkdown', () => {
  it('writes gfm: atx headings, a fenced block with its language, a table', () => {
    const out = md()
    expect(out).toContain('## What the reader keeps')
    expect(out).toContain('```js\nconst quiet = (tool) => tool.job()\nconsole.log(quiet)\n```')
    expect(out).toMatch(/\| Part \| Kept \|\n\| --- \| --- \|/)
    expect(out).not.toContain('Subscribe today')
  })
  it('keeps absolute links and images', () => {
    const out = md()
    expect(out).toContain('[the next note](https://example.com/guide/next)')
    expect(out).toContain('![A chisel on a bench](https://example.com/img/fig.png)') // the feed's utm_source is stripped from the image too
  })
  it('strips tracking parameters, or leaves them when asked', () => {
    expect(md()).toContain('(https://example.com/out?ref=keep)')
    expect(md({ stripTracking: false })).toContain('utm_source=newsletter')
  })
  it('drops images when asked', () => {
    expect(md({ images: false })).not.toContain('![')
  })
  it('writes reference-style links at the end when asked', () => {
    const out = md({ referenceLinks: true })
    expect(out).not.toMatch(/(^|[^!])\[[^\]]*\]\(https:\/\//m)
    expect(out).toMatch(/\[the next note\]\[\d+\]/)
    expect(out).toMatch(/\n\[\d+\]: https:\/\/example\.com\/guide\/next/)
  })
  it('links the heading of a card link instead of wrapping blocks in brackets', () => {
    const out = toMarkdown('<a href="https://x.test/post"><h2>New post</h2><p>Summary here.</p></a>', { images: true, referenceLinks: false, stripTracking: false })
    expect(out).toBe('## [New post](https://x.test/post)\n\nSummary here.')
  })
  it('fences code that itself holds backticks', () => {
    expect(toMarkdown('<pre><code>a ``` b</code></pre>', { images: true, referenceLinks: false, stripTracking: false })).toBe('````\na ``` b\n````')
  })
})

describe('compose', () => {
  const meta = { title: 'Field notes on "quiet" software', byline: 'Ada Byrne', url: 'https://example.com/a', fetchedAt: '2026-10-14T15:00:00.000Z' }
  it('adds the title line', () => {
    expect(compose('Body.', meta, false)).toBe('# Field notes on "quiet" software\n\nBody.\n')
  })
  it('adds yaml front matter with escaped strings', () => {
    expect(frontMatter(meta)).toBe('---\ntitle: "Field notes on \\"quiet\\" software"\nsource: "https://example.com/a"\nbyline: "Ada Byrne"\nfetched: 2026-10-14\n---')
    expect(compose('Body.', meta, true).startsWith('---\ntitle: ')).toBe(true)
  })
  it('counts words, minutes and tokens', () => {
    expect(countWords('# Hello world\n\nA [link here](https://x.test/a-b-c) and `code`.')).toBe(7)
    expect(readingMinutes(0)).toBe(1)
    expect(readingMinutes(231)).toBe(2)
    expect(estimateTokens('abcde')).toBe(2)
  })
})
