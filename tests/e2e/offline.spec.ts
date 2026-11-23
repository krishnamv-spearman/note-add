import { expect, test } from '@playwright/test';
import {
  activateServiceWorker,
  amount,
  createNotebookViaUi,
  description,
  downloadVia,
  editor,
  newPageFromEditor,
  total,
  withoutShare,
} from './helpers';

test.use({ serviceWorkers: 'allow' });

// Test plan §7.1: chromium and pixel-7. The device checks (airplane mode on real phones)
// are manual tests M7.x.
test.beforeEach(({ browserName: _b }, testInfo) => {
  test.skip(testInfo.project.name === 'iphone-14', 'chromium and pixel-7 (test-plan §7.1)');
});

test('PWA-02 / EXP-08: load once → offline → reload → create, edit, export JPEG and PDF', async ({
  page,
  context,
}) => {
  await withoutShare(page);
  await activateServiceWorker(page);
  await context.setOffline(true);

  await page.reload(); // served from the precache
  await expect(page.getByRole('heading', { name: 'Notebooks' })).toBeVisible();

  await createNotebookViaUi(page, 'Offline trip'); // navigates to "/" again, still offline
  await description(page, 1).fill('Taxi to airport');
  await amount(page, 1).fill('1280.75');
  await amount(page, 2).fill('-300');
  await amount(page, 2).blur();
  await expect(total(page)).toHaveText('980.75');
  await newPageFromEditor(page, 2);
  await expect(page.getByTestId('brought-forward')).toHaveText('980.75');

  // The lazily loaded export chunk and the bundled fonts come from the precache.
  await page.getByRole('link', { name: 'Previous page' }).click();
  await expect(page.getByRole('heading', { name: 'Page 1 of 2' })).toBeVisible();
  const editorUrl = page.url();
  const jpeg = await downloadVia(page, () =>
    editor(page).getByRole('button', { name: 'Export JPEG' }).click(),
  );
  expect([jpeg.bytes[0], jpeg.bytes[1]]).toEqual([0xff, 0xd8]);
  expect(jpeg.name).toMatch(/^Offline trip-Page 1-\d{2}-\d{2}-\d{4}\.jpg$/);
  const pdf = await downloadVia(page, () =>
    editor(page).getByRole('button', { name: 'Export PDF' }).click(),
  );
  expect(new TextDecoder().decode(pdf.bytes.slice(0, 5))).toBe('%PDF-');
  await expect(page.getByText('Export needs one online visit first')).toHaveCount(0);

  // Other lazily loaded screens work offline too.
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Backup and restore' })).toBeVisible();

  // A deep link and a full reload offline (navigation fallback): the data is still there.
  await page.goto(editorUrl);
  await page.reload();
  await expect(description(page, 1)).toHaveValue('Taxi to airport');
  await expect(amount(page, 2)).toHaveValue('(300.00)');
});

test('offline: backup (download) works and the font choice persists', async ({ page, context }) => {
  await withoutShare(page);
  await activateServiceWorker(page);
  await context.setOffline(true);
  await createNotebookViaUi(page, 'Offline backup');
  await page.goto('/settings');
  await page.getByRole('radio', { name: /^Cambria-style/ }).check();
  const backup = await downloadVia(page, () =>
    page.getByRole('button', { name: 'Back up', exact: true }).click(),
  );
  expect(backup.name).toMatch(/^note-add-backup-\d{2}-\d{2}-\d{4}\.json$/);
  expect(new TextDecoder().decode(backup.bytes)).toContain('"format": "note-add-backup"');
  await page.reload();
  await expect(page.getByRole('radio', { name: /^Cambria-style/ })).toBeChecked();
});
