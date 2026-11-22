import { expect, test } from '@playwright/test';
import { amount, createNotebookViaUi, total } from './helpers';

test('PWA-05: every screen except the library has an in-app back control', async ({ page }) => {
  await createNotebookViaUi(page, 'Trip');
  await page.getByRole('link', { name: '‹ Trip' }).click();
  await expect(page.getByRole('heading', { name: 'Trip' })).toBeVisible();
  await page.getByRole('link', { name: '‹ Notebooks' }).click();
  await expect(page.getByRole('heading', { name: 'Notebooks' })).toBeVisible();
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByRole('link', { name: '‹ Notebooks' }).click();
  await expect(page.getByRole('heading', { name: 'Notebooks' })).toBeVisible();
});

test('bottom-nav New page appends to the last opened notebook', async ({ page }) => {
  await createNotebookViaUi(page, 'Trip');
  await amount(page, 1).fill('12');
  await amount(page, 1).blur();
  await page.getByRole('link', { name: 'Notebooks', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('button', { name: 'New page' })
    .click();
  await expect(page.getByRole('heading', { name: 'Page 2 of 2' })).toBeVisible();
  await expect(page.getByTestId('brought-forward')).toHaveText('12.00');
  await expect(total(page)).toHaveText('12.00');
});

test('NB-09: a deleted notebook link goes home with a notice', async ({ page }) => {
  await page.goto('/n/does-not-exist');
  await expect(page.getByText('That notebook no longer exists.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Notebooks' })).toBeVisible();
});
