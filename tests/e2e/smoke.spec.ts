import { expect, test } from '@playwright/test';

test('app loads and shows Note-Add', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.headers()['content-security-policy']).toContain("default-src 'self'");
  await expect(page.getByText('Note-Add', { exact: true })).toBeVisible();
});
