import { expect, test } from './fixtures'

test('the app shell works offline after the first load', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('link', { name: 'Pagedown, home', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Paste HTML', exact: true }).click()
  await page.getByLabel('Page HTML', { exact: true }).fill('<article><h1>Offline</h1><p>' + 'Words that still convert with no network at all. '.repeat(6) + '</p></article>')
  await page.getByRole('button', { name: 'Convert', exact: true }).click()
  await expect(page.locator('pre.markdown')).toContainText('Words that still convert')
  await context.setOffline(false)
})
