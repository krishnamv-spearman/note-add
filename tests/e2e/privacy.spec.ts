import { expect, test } from '@playwright/test';
import {
  amount,
  createNotebookViaUi,
  description,
  downloadVia,
  editor,
  newPageFromEditor,
  withoutShare,
} from './helpers';

// SEC-01, spec §7: no accounts, no server, no cookies, no analytics, no third-party requests.
// The service worker is allowed (the real situation); every project runs the same journey.
test.use({ serviceWorkers: 'allow' });

test('SEC-01: a full journey makes no request to any other origin and stores no cookies', async ({
  page,
  context,
  baseURL,
}) => {
  const origin = new URL(baseURL as string).origin;
  const requests: string[] = [];
  context.on('request', (r) => requests.push(r.url()));
  await withoutShare(page);

  await createNotebookViaUi(page, 'Privacy check', 'Mint green');
  await page.getByRole('textbox', { name: 'Title' }).fill('Journey');
  await description(page, 1).fill('Taxi to airport');
  await amount(page, 1).fill('1,280.75');
  await amount(page, 2).fill('-300');
  await amount(page, 2).blur();
  await expect(page.getByText('Saved')).toBeVisible();
  await newPageFromEditor(page, 2);
  await page.getByRole('link', { name: 'Previous page' }).click();
  await expect(page.getByRole('heading', { name: 'Page 1 of 2' })).toBeVisible();
  await downloadVia(page, () => editor(page).getByRole('button', { name: 'Export PDF' }).click());
  await downloadVia(page, () => editor(page).getByRole('button', { name: 'Export JPEG' }).click());

  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Search' }).fill('taxi');
  await expect(page.getByRole('list', { name: 'Search results' })).toBeVisible();
  await page.goto('/settings');
  await page.getByRole('radio', { name: /^Classic serif/ }).check();
  await downloadVia(page, () => page.getByRole('button', { name: 'Back up', exact: true }).click());
  await page.getByLabel('Restore from a backup file').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('not a backup'),
  });
  await expect(page.getByText('This is not a Note-Add backup file.')).toBeVisible();
  await page.waitForTimeout(500); // let the service worker finish registering and precaching

  const network = requests.filter((u) => /^https?:/.test(u));
  expect(network.length).toBeGreaterThan(10);
  const foreign = network.filter((u) => new URL(u).origin !== origin);
  expect(foreign).toEqual([]);

  expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => document.cookie)).toBe('');
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
});
