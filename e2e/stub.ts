import type { Page, Route } from '@playwright/test'
import { readFileSync } from 'node:fs'

// vite preview runs no vercel function, so the specs answer /api/fetch themselves, with what
// the real converter makes of the fixture page (article.json, kept honest by
// src/test/fixture-json.test.ts). the function's own behavior is unit tested.
export const fixtureHtml = readFileSync(new URL('../src/test/fixtures/article.html', import.meta.url), 'utf8')
export const FIXTURE_URL = 'https://example.com/guide/field-notes'

export function articleBody(url = FIXTURE_URL) {
  const { pageUrl: _pageUrl, ...article } = JSON.parse(readFileSync(new URL('../src/test/fixtures/article.json', import.meta.url), 'utf8'))
  void _pageUrl
  return { ok: true, url, finalUrl: url, status: 200, fetchedAt: '2026-10-14T15:00:00.000Z', elapsedMs: 412, ...article }
}

export async function stubApi(page: Page, answer: (url: string) => { status: number; body: unknown } = (url) => ({ status: 200, body: articleBody(url) })) {
  const calls: string[] = []
  await page.route('**/api/fetch**', async (route: Route) => {
    const target = new URL(route.request().url()).searchParams.get('url') ?? ''
    calls.push(route.request().url())
    const { status, body } = answer(target)
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  return calls
}
