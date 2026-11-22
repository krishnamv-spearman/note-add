import { join } from 'node:path';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import {
  amount,
  createNotebookViaUi,
  description,
  markFinal,
  newPageFromNav,
  todayDisplay,
  total,
} from './helpers';

test.beforeEach(({ browserName: _b }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'chromium only (test-plan §7.1)');
});

const FIXTURES = join(import.meta.dirname, '../fixtures/backups');

async function noShare(target: Page | BrowserContext) {
  await target.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  });
}

async function restoreFile(page: Page, path: string) {
  await page.goto('/settings');
  await page.getByLabel('Restore from a backup file').setInputFiles(path);
}

test('exit criterion: create data → backup (download) → clear site data → restore → everything back; then undo', async ({
  page,
  browser,
}) => {
  await noShare(page);
  // Data with a colour, a Final page, a negative, a title and a non-default font.
  await page.goto('/settings');
  await page.getByRole('radio', { name: /^Cambria-style/ }).check();
  await createNotebookViaUi(page, 'Pune trip claims', 'Mint green');
  await page.getByRole('textbox', { name: 'Title' }).fill('Airport run');
  await description(page, 1).fill('Taxi to airport');
  await amount(page, 1).fill('1280.75');
  await amount(page, 2).fill('-300');
  await amount(page, 2).blur();
  await markFinal(page);
  await newPageFromNav(page, 2);
  await amount(page, 1).fill('50');
  await amount(page, 1).blur();
  await expect(total(page)).toHaveText('1,030.75');

  await page.goto('/settings');
  await expect(page.getByTestId('last-backup')).toHaveText('Never');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Back up', exact: true }).click(),
  ]);
  const today = await todayDisplay(page);
  expect(download.suggestedFilename()).toBe(`note-add-backup-${today.replaceAll('/', '-')}.json`);
  const file = await download.path();
  await expect(page.getByTestId('last-backup')).toHaveText(today);

  // "Clear site data": a brand-new browser profile has empty storage.
  const fresh = await browser.newContext({ timezoneId: 'Asia/Kolkata', locale: 'en-IN' });
  const p2 = await fresh.newPage();
  await p2.goto('/');
  await expect(
    p2.getByText('Create your first notebook to start adding up expenses.'),
  ).toBeVisible();

  await restoreFile(p2, file);
  await expect(p2.getByTestId('restore-summary')).toHaveText(
    new RegExp(`^1 notebook, 2 pages, last changed ${today}$`),
  );
  await p2.getByRole('dialog').getByRole('button', { name: 'Replace my notes' }).click();
  await expect(p2.getByText(/^Backup restored: 1 notebook, 2 pages/)).toBeVisible();
  await expect(p2.getByRole('radio', { name: /^Cambria-style/ })).toBeChecked(); // setting

  await p2.getByRole('link', { name: '‹ Notebooks' }).click();
  const stack = p2.locator('.stacks').getByRole('link', { name: /Pune trip claims/ });
  await expect(stack).toHaveCSS('background-color', 'rgb(216, 243, 220)'); // mint
  await expect(stack).toContainText('1,030.75');
  await stack.click();
  await expect(p2.locator('details.archive').getByText('Archive (1)')).toBeVisible();
  await p2.locator('details.archive summary').click();
  await p2
    .locator('details.archive')
    .getByRole('link', { name: /Airport run/ })
    .click();
  await expect(p2.getByRole('button', { name: 'Reopen' })).toBeVisible(); // still Final
  await expect(description(p2, 1)).toHaveValue('Taxi to airport');
  await expect(amount(p2, 2)).toHaveValue('(300.00)');
  await expect(amount(p2, 1)).toHaveCSS('font-family', /^Caladea/);

  // A mistaken restore can be undone: back to the empty profile.
  await p2.goto('/settings');
  await p2.getByRole('button', { name: 'Undo last restore' }).click();
  await p2.getByRole('dialog').getByRole('button', { name: 'Undo restore' }).click();
  await expect(p2.getByText('The last restore was undone.')).toBeVisible();
  await p2.goto('/');
  await expect(
    p2.getByText('Create your first notebook to start adding up expenses.'),
  ).toBeVisible();
  await fresh.close();
});

test('RES-01 / B3: the wrong file (a PDF) is refused and nothing changes', async ({ page }) => {
  await createNotebookViaUi(page, 'Keep');
  await page.goto('/settings');
  await page.getByLabel('Restore from a backup file').setInputFiles({
    name: 'photo.json',
    mimeType: 'application/json',
    buffer: Buffer.from('%PDF-1.7 not json'),
  });
  await expect(page.getByText('This is not a Note-Add backup file.')).toBeVisible();
  await page.goto('/');
  await expect(page.locator('.stacks').getByRole('link', { name: /Keep/ })).toBeVisible();
});

test('RES-06: a tampered file is refused with its message', async ({ page }) => {
  await restoreFile(page, join(FIXTURES, 'tampered-totals.json'));
  await expect(page.getByText(/do not add up/)).toBeVisible();
});

test('MTB-03 / RES-17: a restore tells other tabs to reload', async ({ context }) => {
  const a = await context.newPage();
  await createNotebookViaUi(a, 'Tab test');
  const b = await context.newPage();
  await b.goto(a.url());
  await expect(b.getByRole('heading', { name: 'Page 1 of 1' })).toBeVisible();
  const reloaded = b.waitForEvent('load');
  await restoreFile(a, join(FIXTURES, 'v1/valid-3-notebooks-21-pages.json'));
  await a.getByRole('dialog').getByRole('button', { name: 'Replace my notes' }).click();
  await reloaded; // tab B reloaded by itself
  await expect(b.getByText('That notebook no longer exists.')).toBeVisible();
});

test('backup through the share menu (emulated): JSON file shared; cancel is not a backup', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as { shared: string[]; mode: string };
    w.shared = [];
    w.mode = 'abort';
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: (d: ShareData) => {
        if (w.mode === 'abort') return Promise.reject(new DOMException('closed', 'AbortError'));
        w.shared.push(`${d.files![0]!.name}|${d.files![0]!.type}`);
        return Promise.resolve();
      },
    });
  });
  await createNotebookViaUi(page, 'Shared');
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Back up', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Back up', exact: true })).toBeEnabled();
  await expect(page.getByTestId('last-backup')).toHaveText('Never'); // BAK-02

  await page.evaluate(() => ((window as unknown as { mode: string }).mode = 'ok'));
  await page.getByRole('button', { name: 'Back up', exact: true }).click();
  const today = await todayDisplay(page);
  await expect(page.getByTestId('last-backup')).toHaveText(today);
  expect(await page.evaluate(() => (window as unknown as { shared: string[] }).shared)).toEqual([
    `note-add-backup-${today.replaceAll('/', '-')}.json|application/json`,
  ]);
});
