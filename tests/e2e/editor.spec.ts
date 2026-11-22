import { expect, test } from '@playwright/test';
import {
  amount,
  broughtForward,
  description,
  fillPageByKeyboard,
  openFreshNotebook,
  total,
  editor,
  stepPage,
} from './helpers';

const rowsFor = (page: number): [string, string][] =>
  Array.from({ length: 10 }, (_, i) => [
    `Item ${page}.${i + 1}`,
    i === 3 ? '-50' : `${page * 10 + i}.25`,
  ]);

test('KBD-03 / KBD-10 / SAV-02: fill three pages by keyboard alone; data survives a reload', async ({
  page,
}, testInfo) => {
  test.slow(); // 60 fields by keyboard; WebKit is slow under parallel load
  await openFreshNotebook(page);
  await description(page, 1).focus();

  for (let p = 1; p <= 3; p++) {
    await fillPageByKeyboard(page, testInfo.project.name, rowsFor(p));
    // Enter/Next on line 10 created the next page and focused its line 1.
    await expect(page.getByRole('heading', { name: `Page ${p + 1} of ${p + 1}` })).toBeVisible();
    await expect(description(page, 1)).toBeFocused();
  }

  // Page 4 was created by the last Next; go back to page 3 and check the chain.
  await stepPage(page, 'Previous');
  await expect(page.getByRole('heading', { name: 'Page 3 of 4' })).toBeVisible();
  const page3Bf = await broughtForward(page).textContent();
  const page3Total = await total(page).textContent();
  await stepPage(page, 'Previous');
  await expect(page.getByRole('heading', { name: 'Page 2 of 4' })).toBeVisible();
  // RND-05: page 3's brought forward equals page 2's total, digit for digit.
  await expect(total(page)).toHaveText(page3Bf ?? 'missing');

  // Page 1: 10.25+11.25+12.25−50+14.25+…+19.25 = 102.25 + ... computed by the engine.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Page 2 of 4' })).toBeVisible();
  await expect(description(page, 10)).toHaveValue('Item 2.10');
  await expect(amount(page, 4)).toHaveValue('(50.00)');
  await expect(amount(page, 1)).toHaveValue('20.25');
  await stepPage(page, 'Next');
  await expect(total(page)).toHaveText(page3Total ?? 'missing');
  await expect(description(page, 1)).toHaveValue('Item 3.1');
});

test('CHN-02 / CHN-12 / CHN-13: editing page 1 updates pages 2 and 3 without a reload', async ({
  page,
}) => {
  await openFreshNotebook(page);
  await amount(page, 1).fill('100');
  await editor(page).getByRole('button', { name: 'New page' }).click();
  await expect(page.getByRole('heading', { name: 'Page 2 of 2' })).toBeVisible();
  await amount(page, 1).fill('200');
  await editor(page).getByRole('button', { name: 'New page' }).click();
  await expect(page.getByRole('heading', { name: 'Page 3 of 3' })).toBeVisible();
  await amount(page, 1).fill('300');
  await amount(page, 1).blur();
  await expect(total(page)).toHaveText('600.00');

  await stepPage(page, 'Previous');
  await stepPage(page, 'Previous');
  await expect(page.getByRole('heading', { name: 'Page 1 of 3' })).toBeVisible();
  await amount(page, 1).fill('-100'); // sign flip
  await amount(page, 1).blur();
  await expect(page.getByText('Saved')).toBeVisible();
  await stepPage(page, 'Next');
  await expect(broughtForward(page)).toHaveText('(100.00)');
  await stepPage(page, 'Next');
  await expect(broughtForward(page)).toHaveText('100.00');
  await expect(total(page)).toHaveText('400.00');

  // valid → invalid text counts as 0 from then on (CHN-13)
  await stepPage(page, 'Previous');
  await stepPage(page, 'Previous');
  await amount(page, 1).fill('45o');
  await amount(page, 1).blur();
  await expect(page.getByRole('img', { name: 'Not a number, counted as zero' })).toBeVisible();
  await expect(total(page)).toHaveText('0.00');
  await expect(page.getByText('Saved')).toBeVisible();
  await stepPage(page, 'Next');
  await stepPage(page, 'Next');
  await expect(total(page)).toHaveText('500.00');
});

test('MON-05 / EDT-02 / EDT-03: a rejected amount keeps the last valid value', async ({ page }) => {
  await openFreshNotebook(page);
  await amount(page, 1).fill('450');
  await amount(page, 1).press('Enter');
  await amount(page, 1).fill('450.505');
  await expect(page.getByText('Up to 2 decimal places, for example 450.50')).toBeVisible();
  await expect(total(page)).toHaveText('450.00');
  await amount(page, 1).press('Enter');
  await expect(amount(page, 1)).toBeFocused(); // EDT-02
  await amount(page, 1).blur();
  await expect(amount(page, 1)).toHaveValue('450.00'); // EDT-03: reverted
  await expect(
    page.getByText('Not saved: Up to 2 decimal places, for example 450.50'),
  ).toBeVisible();
});

test('KBD-05: Enter on line 10 of an empty page does not create a page', async ({ page }) => {
  await openFreshNotebook(page);
  await amount(page, 10).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Add a line before starting a new page')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Page 1 of 1' })).toBeVisible();
});

test('NB-09 / NB-10: malformed and missing URLs redirect without crashing', async ({ page }) => {
  await openFreshNotebook(page);
  const url = new URL(page.url());
  const notebookPath = url.pathname.replace(/\/p\/\d+$/, '');
  await page.goto(`${notebookPath}/p/abc`);
  await expect(page.getByRole('heading', { name: 'Page 1 of 1' })).toBeVisible();
  await page.goto(`${notebookPath}/p/0`);
  await expect(page.getByRole('heading', { name: 'Page 1 of 1' })).toBeVisible();
  await page.goto(`${notebookPath}/p/99`);
  await expect(page.getByText('There is no page 99; showing the last page.')).toBeVisible();
  await page.goto('/n/xyz/p/1');
  await expect(page.getByText('That notebook no longer exists.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Notebooks' })).toBeVisible();
});

test('STO-01: a browser without IndexedDB gets a clear message', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });
  });
  await page.goto('/');
  await expect(page.getByText('This browser can’t store notes.')).toBeVisible();
});
