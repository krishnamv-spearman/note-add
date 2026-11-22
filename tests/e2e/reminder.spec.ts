import { expect, type Page, test } from '@playwright/test';
import { amount, createNotebookViaUi } from './helpers';

test.beforeEach(({ browserName: _b }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'chromium only (test-plan §7.1)');
});

const DAY = 86_400_000;
const START = new Date('2026-11-01T10:00:00+05:30').getTime();
const banner = (page: Page) => page.getByRole('region', { name: 'Backup reminder' });

test('REM-01 / REM-03: shown after 30 days with data; dismissed for 30 days', async ({ page }) => {
  await page.clock.setFixedTime(START);
  await createNotebookViaUi(page, 'Reminder');
  await amount(page, 1).fill('10');
  await amount(page, 1).blur();
  await expect(page.getByText('Saved')).toBeVisible();

  await page.clock.setFixedTime(START + 30 * DAY);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notebooks' })).toBeVisible();
  await expect(banner(page)).toHaveCount(0);

  await page.clock.setFixedTime(START + 31 * DAY);
  await page.reload();
  await expect(banner(page)).toBeVisible();
  await banner(page).getByRole('button', { name: 'Not now' }).click();
  await expect(banner(page)).toHaveCount(0);

  await page.clock.setFixedTime(START + 50 * DAY);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Notebooks' })).toBeVisible();
  await expect(banner(page)).toHaveCount(0);

  await page.clock.setFixedTime(START + 62 * DAY);
  await page.reload();
  await expect(banner(page)).toBeVisible();
});

test('the reminder button backs up, and the banner goes away', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });
  await page.clock.setFixedTime(START);
  await createNotebookViaUi(page, 'Reminder');
  await amount(page, 1).fill('10');
  await amount(page, 1).blur();
  await expect(page.getByText('Saved')).toBeVisible();
  await page.clock.setFixedTime(START + 40 * DAY);
  await page.goto('/');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    banner(page).getByRole('button', { name: 'Back up now' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('note-add-backup-11-12-2026.json');
  await expect(banner(page)).toHaveCount(0);
});

test('REM-02 / DAT-05: an empty notebook, or a clock moved backwards, shows no banner', async ({
  page,
}) => {
  await page.clock.setFixedTime(START);
  await createNotebookViaUi(page, 'Empty');
  await page.clock.setFixedTime(START + 90 * DAY);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notebooks' })).toBeVisible();
  await expect(banner(page)).toHaveCount(0);

  await page.clock.setFixedTime(START - 10 * DAY);
  await page.reload();
  await expect(banner(page)).toHaveCount(0);
});
