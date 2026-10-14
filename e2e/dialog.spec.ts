// dialog.spec.ts: the browser check that goes with the house Dialog primitive (Dialog.tsx or
// dialog.js). Copy it to e2e/dialog.spec.ts, set the first DIALOGS row to one real opener and the
// title of the dialog it opens, and add a row for each other dialog in the app. It catches
// each way a modal has shipped broken in the fleet: Tab walking out (meeple), focus lost on
// unmount (snip, stocks-ladder), and focus lost after Escape then Tab (yamlet).
// When the opener sits behind another view (a stage, a wizard step, a saved script), put the steps
// that reach it in beforeEach. The Escape check presses Tab after focus returns, so the opener must
// not be the last tabbable control on the page: a Tab off the end lands on the browser's own chrome
// and reads as focus lost.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

const DIALOGS: { opener: string; title: string }[] = [
  // the opener's accessible name and the dialog's title, both matched exactly
  { opener: 'About Pagedown', title: 'About Pagedown' },
];

/** true when document.activeElement sits inside the open modal dialog */
const focusInsideDialog = (page: Page) =>
  page.evaluate(() => {
    const active = document.activeElement;
    return !!active && active !== document.body && !!active.closest('dialog[open], [role="dialog"], [role="alertdialog"]');
  });

/** how many tabbable elements the dialog holds, so the walk goes one past the end */
const tabbableCount = (dialog: Locator) =>
  dialog.evaluate((root) =>
    Array.from(
      root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [contenteditable]:not([contenteditable="false"]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0).length,
  );

/** focuses the opener from the keyboard and presses Enter, the way a keyboard user opens it */
async function openFromKeyboard(page: Page, openerName: string, title: string) {
  const opener = page.getByRole('button', { name: openerName, exact: true });
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: title, exact: true });
  await expect(dialog).toBeVisible();
  return { opener, dialog };
}

for (const { opener: openerName, title } of DIALOGS) {
  test.describe(`${title} dialog`, () => {
    let errors: string[];
    test.beforeEach(async ({ page }) => {
      errors = [];
      page.on('pageerror', (err) => errors.push(err.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      await page.goto('/');
    });
    test.afterEach(() => {
      expect(errors, 'console errors').toEqual([]);
    });

    test('opens with focus inside and is modal', async ({ page }) => {
      const { dialog } = await openFromKeyboard(page, openerName, title);
      expect(await focusInsideDialog(page)).toBe(true);
      await expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    test('Tab and Shift+Tab never leave it', async ({ page }) => {
      const { dialog } = await openFromKeyboard(page, openerName, title);
      const count = await tabbableCount(dialog);
      expect(count, 'a dialog needs at least one control, its close button').toBeGreaterThan(0);
      for (let i = 0; i < count + 2; i++) {
        await page.keyboard.press('Tab');
        expect(await focusInsideDialog(page), `Tab ${i + 1} of ${count + 2}`).toBe(true);
      }
      for (let i = 0; i < count + 2; i++) {
        await page.keyboard.press('Shift+Tab');
        expect(await focusInsideDialog(page), `Shift+Tab ${i + 1} of ${count + 2}`).toBe(true);
      }
    });

    test('Escape closes it and focus returns to the opener', async ({ page }) => {
      const { opener, dialog } = await openFromKeyboard(page, openerName, title);
      await page.keyboard.press('Tab');
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(opener).toBeFocused();
      // the next Tab moves on from the opener, not from the top of the page
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
    });

    test('the close button closes it and focus returns to the opener', async ({ page }) => {
      const { opener, dialog } = await openFromKeyboard(page, openerName, title);
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(opener).toBeFocused();
    });

    test('it opens and closes twice in a row', async ({ page }) => {
      for (let round = 0; round < 2; round++) {
        const { opener, dialog } = await openFromKeyboard(page, openerName, title);
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(opener).toBeFocused();
      }
    });
  });
}
