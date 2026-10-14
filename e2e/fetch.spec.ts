import { expect, test } from './fixtures'
import { FIXTURE_URL, articleBody, fixtureHtml, stubApi } from './stub'

const field = (page: import('@playwright/test').Page) => page.getByLabel('Page link', { exact: true })
const fetchButton = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Fetch', exact: true })
const raw = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Markdown', exact: true }).locator('pre.markdown')

test('PAG-001: a bare domain gets https and goes to the function once', async ({ page }) => {
  const calls = await stubApi(page)
  await page.goto('/')
  await field(page).fill('example.com/post')
  await field(page).press('Enter')
  await expect(field(page)).toHaveValue('https://example.com/post')
  await expect(page.getByRole('heading', { name: 'Field notes on quiet software', exact: true })).toBeVisible()
  expect(calls).toHaveLength(1)
  expect(new URL(calls[0]).search).toBe('?url=https%3A%2F%2Fexample.com%2Fpost')
})

test('PAG-001: other schemes and an empty field never reach the function', async ({ page }) => {
  const calls = await stubApi(page)
  await page.goto('/')
  const before = await fetchButton(page).boundingBox()
  await field(page).fill('ftp://example.com/file')
  await fetchButton(page).click()
  await expect(page.getByText('Only http and https links can be fetched.', { exact: true })).toBeVisible()
  // the message has its own reserved line: the button did not move
  expect(await fetchButton(page).boundingBox()).toEqual(before)
  await field(page).fill('')
  await fetchButton(page).click()
  await expect(page.getByText('Paste a link to fetch.', { exact: true })).toBeVisible()
  expect(calls).toHaveLength(0)
})

test('PAG-004 and PAG-012: the strip shows status, final url, words, reading time, tokens, time and cuts', async ({ page }) => {
  await stubApi(page, (url) => ({ status: 200, body: { ...articleBody(url), finalUrl: 'https://example.com/guide/field-notes-moved' } }))
  await page.goto('/')
  await field(page).fill(FIXTURE_URL)
  await fetchButton(page).click()
  const md = await raw(page).textContent()
  const strip = page.locator('.strip')
  await expect(strip.locator('.chip-status')).toHaveText('200')
  await expect(strip.getByRole('link', { name: 'example.com/guide/field-notes-moved', exact: true })).toHaveAttribute('href', 'https://example.com/guide/field-notes-moved')
  await expect(strip).toContainText(/\d+ words/)
  await expect(strip).toContainText(/\d+ min read/)
  await expect(strip).toContainText('412 ms')
  const tokens = Math.ceil((md ?? '').length / 4)
  await expect(strip).toContainText(`~${tokens.toLocaleString('en-US')} tokens`)
  const cuts = page.getByRole('list', { name: 'Page chrome cut from the article', exact: true })
  for (const chip of ['nav 1', 'footer 1', 'sidebars 1', 'scripts 3']) await expect(cuts.getByText(chip, { exact: true })).toBeVisible()
})

test('PAG-005: raw and preview, with images as links and no third-party requests', async ({ page }) => {
  await stubApi(page)
  const outside: string[] = []
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost')) outside.push(r.url())
  })
  await page.goto('/')
  await field(page).fill(FIXTURE_URL)
  await fetchButton(page).click()
  await expect(raw(page)).toContainText('# Field notes on quiet software')
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  const preview = page.locator('.preview')
  await expect(preview.locator('h1')).toHaveText('Field notes on quiet software')
  await expect(preview.getByRole('link', { name: 'Image: A chisel on a bench', exact: true })).toHaveAttribute('href', 'https://example.com/img/fig.png')
  await expect(preview.locator('img')).toHaveCount(0)
  await page.getByRole('button', { name: 'Raw', exact: true }).click()
  await expect(raw(page)).toContainText('# Field notes on quiet software')
  expect(outside).toEqual([])
})

test('PAG-006: copy, download and front matter', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await stubApi(page)
  await page.goto('/')
  await field(page).fill(FIXTURE_URL)
  await fetchButton(page).click()
  await page.getByRole('button', { name: 'Copy', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Copied', exact: true })).toBeVisible()
  const md = await raw(page).textContent()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(md)

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download', exact: true }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('field-notes-on-quiet-software.md')
  const { readFileSync } = await import('node:fs')
  expect(readFileSync((await file.path())!, 'utf8')).toBe(md)

  await page.getByRole('switch', { name: /^Front matter/ }).check()
  await expect(raw(page)).toContainText(/^---\ntitle: "Field notes on quiet software"\nsource: "https:\/\/example\.com\/guide\/field-notes"\nbyline: "Ada Byrne"\nfetched: 2026-10-14\n---/)
  await page.getByRole('switch', { name: /^Front matter/ }).uncheck()
  await expect(raw(page)).toContainText(/^# Field notes/)
})

test('PAG-007: pasted html converts in the browser without the function', async ({ page }) => {
  const calls = await stubApi(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Paste HTML', exact: true }).click()
  await page.getByLabel('Page HTML', { exact: true }).fill(fixtureHtml)
  await page.getByLabel(/^Page address/).fill('https://example.com/guide/')
  await page.getByRole('button', { name: 'Convert', exact: true }).click()
  await expect(raw(page)).toContainText('## What the reader keeps')
  await expect(raw(page)).toContainText('[the next note](https://example.com/guide/next)')
  expect(calls).toHaveLength(0)
})

const ERRORS: [string, number | undefined, string][] = [
  ['blocked', undefined, 'That address is private or local'],
  ['timeout', undefined, 'more than 10 seconds'],
  ['not-html', undefined, 'points to a file, not a web page'],
  ['too-large', undefined, 'over 5 MB'],
  ['upstream', 404, 'has no page at that address (404)'],
  ['no-article', undefined, 'no article was found on it'],
  ['bad-url', undefined, 'does not look like a web address'],
  ['dns', undefined, 'No site answers at that address'],
]

test.describe('failures', () => {
// the browser logs every 4xx or 5xx answer and every request made offline; those are the point here
test.use({ allowConsole: [/^Failed to load resource: (the server responded with a status of \d+|net::ERR_INTERNET_DISCONNECTED)/] })

test('PAG-008: every failure has its own message', async ({ page }) => {
  let next: [string, number | undefined] = ['blocked', undefined]
  await stubApi(page, () => ({ status: 400, body: { ok: false, code: next[0], ...(next[1] ? { status: next[1] } : {}) } }))
  await page.goto('/')
  for (const [code, status, text] of ERRORS) {
    next = [code, status]
    await field(page).fill(`example.com/${code}`)
    await fetchButton(page).click()
    await expect(page.locator(`.state-error[data-code="${code}"]`)).toContainText(text)
  }
})

test('PAG-008: offline says so and suggests pasting', async ({ page, context }) => {
  await stubApi(page)
  await page.goto('/')
  await context.setOffline(true)
  await field(page).fill(FIXTURE_URL)
  await fetchButton(page).click()
  await expect(page.locator('.state-error')).toHaveText('You are offline. Paste the page’s HTML instead, or try again when you are back online.')
  await context.setOffline(false)
})

})

test('PAG-009: recent fetches survive a reload and never store the article', async ({ page }) => {
  const calls = await stubApi(page)
  await page.goto('/')
  await field(page).fill(FIXTURE_URL)
  await fetchButton(page).click()
  await expect(page.getByRole('heading', { name: 'Field notes on quiet software', exact: true })).toBeVisible()
  await page.goto('/')
  const recent = page.getByRole('region', { name: 'Recent', exact: true })
  const item = recent.getByRole('button', { name: /^Field notes on quiet software/ })
  await expect(item).toContainText('example.com')
  const stored = await page.evaluate(() => localStorage.getItem('bc:pagedown.bryancalabro.com') ?? '')
  expect(stored).toContain(FIXTURE_URL)
  expect(stored).not.toContain('Quiet software does one job')
  await item.click()
  await expect(page.getByRole('heading', { name: 'Field notes on quiet software', exact: true })).toBeVisible()
  expect(calls).toHaveLength(2)
  await recent.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(recent.getByText(/^Links you fetch show up here/)).toBeVisible()
})

test('PAG-010: images, reference links and tracking parameters', async ({ page }) => {
  await stubApi(page)
  await page.goto('/')
  await field(page).fill(FIXTURE_URL)
  await fetchButton(page).click()
  await expect(raw(page)).toContainText('(https://example.com/out?ref=keep)')
  await expect(raw(page)).toContainText('![')
  await page.getByRole('switch', { name: /^Images/ }).uncheck()
  await expect(raw(page)).not.toContainText('![')
  await page.getByRole('switch', { name: /^Reference links/ }).check()
  await expect(raw(page)).toContainText(/\n\[\d+\]: https:\/\/example\.com\/guide\/next/)
  await page.getByRole('switch', { name: /^Strip tracking/ }).uncheck()
  await expect(raw(page)).toContainText('utm_source=newsletter')
})

test('PAG-011: a ?url= link fetches on load and share link copies it', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const calls = await stubApi(page)
  await page.goto('/?url=https%3A%2F%2Fexample.com%2Fguide%2F')
  await expect(field(page)).toHaveValue('https://example.com/guide/')
  await expect(page.getByRole('heading', { name: 'Field notes on quiet software', exact: true })).toBeVisible()
  expect(calls).toHaveLength(1)
  await expect(page).toHaveURL(/\?url=https%3A%2F%2Fexample\.com%2Fguide%2F$/)
  await page.getByRole('button', { name: 'Share link', exact: true }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/\?url=https%3A%2F%2Fexample\.com%2Fguide%2F$/)
})
