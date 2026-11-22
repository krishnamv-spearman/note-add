import { join } from 'node:path';
import { expect, test } from '@playwright/test';

test.beforeEach(({ browserName: _b }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'chromium only (test-plan §7.1)');
});

test('OLD-01: the committed v1 fixture restores through the real UI', async ({ page }) => {
  await page.goto('/settings');
  await page
    .getByLabel('Restore from a backup file')
    .setInputFiles(
      join(import.meta.dirname, '../fixtures/backups/v1/valid-3-notebooks-21-pages.json'),
    );
  await expect(page.getByTestId('restore-summary')).toHaveText(
    '3 notebooks, 21 pages, last changed 03/11/2026',
  );
  await page.getByRole('dialog').getByRole('button', { name: 'Replace my notes' }).click();
  await expect(page.getByText(/^Backup restored/)).toBeVisible();
  await page.getByRole('link', { name: '‹ Notebooks' }).click();
  const stacks = page.locator('.stacks .notebook-stack');
  await expect(stacks).toHaveCount(3);
  for (const name of ['Pune trip claims', 'Office petty cash', 'Groceries']) {
    await expect(
      page.locator('.stacks').getByRole('link', { name: new RegExp(name) }),
    ).toBeVisible();
  }
});
