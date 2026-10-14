import { readFileSync, writeFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { expect, it } from 'vitest'
import { extract } from '../lib/extract'

// the e2e specs answer /api/fetch with what the real converter makes of the fixture page.
// this test computes that answer and fails when the committed copy drifts from it;
// UPDATE_FIXTURES=1 npm test rewrites it.
const here = (p: string) => new URL(p, import.meta.url)
const URL_ = 'https://example.com/guide/field-notes'

it('article.json is what the converter makes of article.html', () => {
  const html = readFileSync(here('./fixtures/article.html'), 'utf8')
  const article = extract(html, URL_, (h) => new JSDOM(h).window.document)!
  const json = JSON.stringify({ pageUrl: URL_, ...article }, null, 2) + '\n'
  if (process.env.UPDATE_FIXTURES) writeFileSync(here('./fixtures/article.json'), json)
  expect(readFileSync(here('./fixtures/article.json'), 'utf8')).toBe(json)
})
