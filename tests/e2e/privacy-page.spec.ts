import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const STATEMENT =
  'Note-Add stores your notes only on your device. Nothing is sent to Spearman or anyone else. Backups and exports go only where you choose to send them.';

test('P8.5: the privacy page shows the statement, is linked from Settings, and links back', async ({
  page,
}) => {
  await page.goto('/settings');
  await page.getByRole('link', { name: 'Read the full privacy page' }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible();
  await expect(page.getByTestId('privacy-statement')).toHaveText(STATEMENT);
  await page.getByRole('link', { name: '‹ Settings' }).click();
  await expect(page).toHaveURL(/\/settings$/);
});

test('P8.5: opening /privacy directly works, makes no other-origin request, and is accessible', async ({
  page,
}) => {
  const foreign: string[] = [];
  const own = new URL(test.info().project.use.baseURL as string).origin;
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.protocol.startsWith('http') && url.origin !== own) foreign.push(r.url());
  });
  await page.goto('/privacy');
  await expect(page.getByTestId('privacy-statement')).toHaveText(STATEMENT);
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
  expect(foreign).toEqual([]);
});
