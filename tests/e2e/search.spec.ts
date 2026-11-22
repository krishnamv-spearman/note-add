import { expect, test } from '@playwright/test';
import { amount, createNotebookViaUi, description, markFinal, newPageFromNav } from './helpers';

test('SRC-*: finds notebooks, titles, default titles, descriptions and Archived pages', async ({
  page,
}) => {
  await createNotebookViaUi(page, 'Pune trip claims');
  await page.getByRole('textbox', { name: 'Title' }).fill('Airport run');
  await description(page, 1).fill('Taxi to airport');
  await amount(page, 1).fill('450');
  await amount(page, 1).blur();
  await markFinal(page);
  await newPageFromNav(page, 2);
  await description(page, 1).fill('Café lunch');
  await description(page, 1).blur();
  await expect(page.getByText('Saved')).toBeVisible();

  await page.goto('/');
  const box = page.getByRole('searchbox', { name: 'Search' });
  const results = page.getByRole('list', { name: 'Search results' });

  await box.fill('pune');
  await expect(results.getByRole('link', { name: 'Pune trip claims' })).toBeVisible();

  await box.fill('airport run');
  await expect(results.getByRole('link', { name: /Airport run/ })).toBeVisible();
  await expect(results.getByText('Final')).toBeVisible(); // SRC-06

  await box.fill('TAXI');
  await expect(results.getByRole('link', { name: /Airport run/ })).toBeVisible();

  await box.fill('cafe'); // SRC-02 accents
  await expect(results.getByRole('link', { name: /Page 2/ })).toBeVisible();

  await box.fill('page 2'); // SRC-05 default title
  await expect(results.getByRole('link', { name: /Page 2/ })).toBeVisible();

  await box.fill('zebra');
  await expect(page.getByText(/^No notebooks or pages match/)).toBeVisible();

  await box.fill('taxi');
  await results.getByRole('link', { name: /Airport run/ }).click();
  await expect(page.getByRole('heading', { name: 'Page 1 of 2' })).toBeVisible();
});
