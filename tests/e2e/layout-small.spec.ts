import { expect, type Page, test } from '@playwright/test';
import { amount, createNotebookViaUi, description, total } from './helpers';

test.beforeEach(({ browserName: _b }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'chromium only (test-plan §7.1)');
});

const fits = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((els) =>
    els.map((el) => {
      const e = el as HTMLElement;
      const slip = e.closest('.slip')?.getBoundingClientRect();
      const r = e.getBoundingClientRect();
      return e.scrollWidth <= e.clientWidth + 1 && (!slip || r.right <= slip.right + 0.5);
    }),
  );

test('FMT-08: the widest amounts fit at 320 px in the widest font', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/settings');
  await page.getByRole('radio', { name: /^Verdana-style/ }).check();
  await createNotebookViaUi(page, 'Widest');
  await amount(page, 1).fill('-99,99,99,999.99');
  await amount(page, 2).fill('99,99,99,999.99');
  await amount(page, 3).fill('-99,99,99,999.99');
  await amount(page, 3).blur();
  await expect(amount(page, 1)).toHaveValue('(99,99,99,999.99)');
  await expect(total(page)).toHaveText('(99,99,99,999.99)');
  expect(await fits(page, 'input.amount')).not.toContain(false);
  expect(await fits(page, '.total-row .amount')).toEqual([true]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('LOOK-05: very large text reflows without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 900 });
  await createNotebookViaUi(page, 'Large text');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await amount(page, 1).fill('1,00,000.00');
  await amount(page, 1).blur();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(412);
});

test('LOOK-04: dark mode keeps paper-coloured slips and light form controls', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await createNotebookViaUi(page, 'Dark');
  await expect(page.locator('.editor-slip')).toHaveCSS('background-color', 'rgb(255, 244, 163)');
  await expect(amount(page, 1)).toHaveCSS('color-scheme', 'light');
});

test('TXT-01 / TXT-02: other scripts and emoji are removed from descriptions, titles and names, with a message', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add a new book' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Trip 🚕');
  await expect(page.getByText('Only English text is supported for now')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Trip ');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: 'Page 1 of 1' })).toBeVisible();

  // Typed character by character (keyboard) and pasted (fill).
  await description(page, 1).focus();
  await page.keyboard.type('Tea चाय');
  await expect(description(page, 1)).toHaveValue('Tea ');
  await expect(page.getByText('Only English text is supported for now')).toBeVisible();
  await description(page, 2).fill('Café ₹50 — Łódź');
  await description(page, 3).fill('قهوة');
  await expect(description(page, 3)).toHaveValue('');
  await page.getByRole('textbox', { name: 'Title' }).fill('Airport 🛫 run');
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Airport  run');
  await description(page, 4).focus();
  await expect(page.getByText('Saved')).toBeVisible();

  await page.reload();
  await expect(description(page, 1)).toHaveValue('Tea '); // descriptions are not trimmed (EDT-07)
  await expect(description(page, 2)).toHaveValue('Café ₹50 — Łódź');
  await expect(description(page, 3)).toHaveValue('');
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Airport run');
  await expect(page.getByRole('link', { name: '‹ Trip' })).toBeVisible();
});
