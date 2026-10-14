import { expect, test } from './fixtures'

test('the page loads with the record title, the wordmark and the house footer', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Pagedown | Turn any web page into clean Markdown')
  await expect(page.getByRole('link', { name: 'Pagedown, home', exact: true })).toBeVisible()
  const year = new Date().getFullYear()
  const footer = page.getByRole('link', { name: new RegExp(`^© ${year} Bryan J\\. Calabro - v\\d+\\.\\d+\\.\\d+$`) })
  await expect(footer).toHaveAttribute('href', 'https://bryancalabro.com')
})

test('the theme button cycles device, light and dark and remembers the choice', async ({ page }) => {
  await page.goto('/')
  const button = page.getByRole('button', { name: /^Theme follows your device/ })
  await button.click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: /^Light theme/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: /^Dark theme/ }).click()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
})

test('the about button sits left of the theme button and explains the app', async ({ page }) => {
  await page.goto('/')
  const about = page.getByRole('button', { name: 'About Pagedown', exact: true })
  const theme = page.getByRole('button', { name: /^Theme follows your device/ })
  const [a, t] = [await about.boundingBox(), await theme.boundingBox()]
  expect(a!.x + a!.width).toBeLessThanOrEqual(t!.x)
  expect(Math.abs(a!.y - t!.y)).toBeLessThan(2)
  await about.click()
  const dialog = page.getByRole('dialog', { name: 'About Pagedown', exact: true })
  await expect(dialog).toContainText('writes the page\'s article out as GitHub-flavored Markdown')
  await expect(dialog).toContainText('the HTML is never sent anywhere')
})
