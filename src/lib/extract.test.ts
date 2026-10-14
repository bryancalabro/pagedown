import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
import { absolute, extract } from './extract'

const fixture = readFileSync(new URL('../test/fixtures/article.html', import.meta.url), 'utf8')
const parse = (html: string) => new JSDOM(html).window.document
const PAGE = 'https://example.com/guide/field-notes'

describe('extract', () => {
  const article = extract(fixture, PAGE, parse)!

  it('finds the article and its metadata', () => {
    expect(article.title).toBe('Field notes on quiet software')
    expect(article.byline).toBe('Ada Byrne')
    expect(article.siteName).toBe('Example Journal')
    expect(article.lang).toBe('en')
  })

  it('cuts the chrome and counts it', () => {
    expect(article.html).not.toContain('Subscribe today')
    expect(article.html).not.toContain('Cookie settings')
    expect(article.html).not.toContain('Ten loud apps')
    expect(article.cuts).toMatchObject({ nav: 1, header: 1, footer: 1, aside: 1, scripts: 3 })
    expect(article.cuts.ads).toBe(1)
  })

  it('makes links and images absolute and keeps the code language', () => {
    expect(article.html).toContain('href="https://example.com/guide/next"')
    expect(article.html).toContain('src="https://example.com/img/fig.png?utm_source=feed"')
    expect(article.html).toContain('data-lang="js"')
  })

  it('returns null when there is nothing to read', () => {
    expect(extract('<html><body><nav><a href="/">Home</a></nav></body></html>', PAGE, parse)).toBeNull()
  })
})

describe('absolute', () => {
  it('resolves relative links and drops script urls', () => {
    expect(absolute('../a', 'https://x.test/b/c')).toBe('https://x.test/a')
    expect(absolute('javascript:alert(1)', 'https://x.test/')).toBeNull()
    expect(absolute('data:text/html,hi', 'https://x.test/')).toBeNull()
    expect(absolute('mailto:a@x.test', 'https://x.test/')).toBe('mailto:a@x.test')
    expect(absolute('#top', 'https://x.test/')).toBe('#top')
  })
})
