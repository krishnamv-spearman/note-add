import { expect, test } from '@playwright/test';
import { amount, createNotebookViaUi, markFinal, newPageFromNav } from './helpers';

test('NB-05: an empty library shows only "Add a new book" and a hint', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByText('Create your first notebook to start adding up expenses.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add a new book' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('button', { name: 'New page' })
    .click();
  await expect(page.getByRole('heading', { name: 'Add a new book' })).toBeVisible();
});

test('NB-01: an empty name is refused in the dialog', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add a new book' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('   ');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Give the notebook a name')).toBeVisible();
});

test('create, rename, recolour and delete a notebook (NB-07 second confirmation)', async ({
  page,
}) => {
  await createNotebookViaUi(page, 'Pune trip claims', 'Mint green');
  await amount(page, 1).fill('450');
  await markFinal(page);
  await newPageFromNav(page, 2); // LIF-17: from a Final last page

  await page.getByRole('link', { name: '‹ Pune trip claims' }).click();
  await expect(page.getByRole('heading', { name: 'Pune trip claims' })).toBeVisible();

  await page.getByRole('button', { name: 'Rename' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Pune claims');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Pune claims' })).toBeVisible();

  await page.getByRole('button', { name: 'Colour' }).click();
  await page.getByRole('radio', { name: 'Sky blue' }).check();
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('link', { name: '‹ Notebooks' }).click();
  const stack = page.locator('.stacks').getByRole('link', { name: /Pune claims/ });
  await expect(stack).toBeVisible();
  await expect(stack).toHaveCSS('background-color', 'rgb(214, 236, 250)'); // sky blue paper

  await stack.click();
  await page.getByRole('button', { name: 'Delete notebook' }).click();
  await expect(page.getByText('This deletes the notebook and its 2 pages.')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete notebook' }).click();
  await expect(page.getByRole('heading', { name: 'This notebook has Final pages' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete 1 Final page too' }).click();
  await expect(page.getByText('Notebook Pune claims deleted.')).toBeVisible();
  await expect(page.locator('.stacks').getByRole('link', { name: /Pune claims/ })).toHaveCount(0);
});
