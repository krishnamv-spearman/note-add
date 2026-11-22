import { expect, test } from '@playwright/test';
import { amount, createNotebookViaUi, total } from './helpers';

test.beforeEach(({ browserName: _b }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'chromium only (test-plan §7.1)');
});

test('RND-06: the same total in the library, pages list and editor', async ({ page }) => {
  await createNotebookViaUi(page, 'Big claims');
  await amount(page, 1).fill('12,34,567.89');
  await amount(page, 2).fill('-0.89');
  await amount(page, 2).blur();
  await expect(total(page)).toHaveText('12,34,567.00');
  await expect(page.getByText('Saved')).toBeVisible();

  await page.getByRole('link', { name: '‹ Big claims' }).click();
  await expect(page.getByTestId('card-total-1')).toHaveText('12,34,567.00');
  await page.getByRole('link', { name: '‹ Notebooks' }).click();
  await expect(page.locator('.stacks').getByRole('link', { name: /Big claims/ })).toContainText(
    '12,34,567.00',
  );
});
