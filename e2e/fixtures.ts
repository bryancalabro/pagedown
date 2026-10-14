import { test as base, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

// vite preview sends none of vercel.json's headers, so every document response here gets them
// added, and the suite fails on a console error or a content security policy violation.
type Header = { key: string; value: string }
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
  headers: { source: string; headers: Header[] }[]
}
const siteHeaders = Object.fromEntries(
  (vercel.headers.find((h) => h.source === '/(.*)')?.headers ?? []).map((h) => [h.key.toLowerCase(), h.value]),
)
// upgrade-insecure-requests would push the local http preview to https
siteHeaders['content-security-policy'] = siteHeaders['content-security-policy'].replace(/;\s*upgrade-insecure-requests/, '')
delete siteHeaders['strict-transport-security']

export const test = base.extend<{ guard: void }>({
  guard: [
    async ({ page }, use) => {
      const problems: string[] = []
      await page.route('**/*', async (route) => {
        if (route.request().resourceType() !== 'document') return route.continue()
        const response = await route.fetch()
        await route.fulfill({ response, headers: { ...response.headers(), ...siteHeaders } })
      })
      page.on('console', (m) => {
        if (m.type() === 'error') problems.push(`console: ${m.text()}`)
      })
      page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (e) => {
          console.error(`csp violation: ${e.violatedDirective} ${e.blockedURI}`)
        })
      })
      await use()
      expect(problems, 'console errors or CSP violations').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
