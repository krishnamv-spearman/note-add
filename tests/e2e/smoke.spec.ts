import { expect, test } from '@playwright/test';

test('app loads and shows Note-Add', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.headers()['content-security-policy']).toContain("default-src 'self'");
  await expect(page.getByRole('heading', { name: 'Note-Add' })).toBeVisible();
});
