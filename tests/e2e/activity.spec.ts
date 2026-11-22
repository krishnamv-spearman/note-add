import { expect, test } from '@playwright/test';
import { amount, createNotebookViaUi, editor, markFinal, todayDisplay } from './helpers';

test.beforeEach(({ browserName: _b }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'chromium only (test-plan §7.1)');
});

test('ACT-*: the last 5 changes appear on the library, newest first', async ({ page }) => {
  await createNotebookViaUi(page, 'Pune trip claims'); // 1
  await amount(page, 1).fill('1');
  await markFinal(page); // 2
  await page.getByRole('button', { name: 'Reopen' }).click(); // 3
  await editor(page).getByRole('button', { name: 'New page' }).click(); // (not an activity)
  await expect(page.getByRole('heading', { name: 'Page 2 of 2' })).toBeVisible();
  await amount(page, 1).fill('2');
  await markFinal(page); // 4
  await createNotebookViaUi(page, 'Groceries'); // 5
  await page.getByRole('link', { name: '‹ Groceries' }).click();
  await page.getByRole('button', { name: 'Rename' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Weekly groceries');
  await page.getByRole('button', { name: 'Save' }).click(); // 6
  await expect(page.getByRole('heading', { name: 'Weekly groceries' })).toBeVisible();
  const today = await todayDisplay(page);

  await page.getByRole('link', { name: 'Notebooks', exact: true }).click();
  const items = page.getByRole('region', { name: 'Recent activity' }).getByRole('listitem');
  await expect(items).toHaveText([
    'Notebook Groceries renamed to Weekly groceries',
    'Notebook Groceries created',
    `Page 2 of Pune trip claims marked Final, ${today}`,
    `Page 1 of Pune trip claims reopened, ${today}`,
    `Page 1 of Pune trip claims marked Final, ${today}`,
  ]);
  // ACT-03: the entry keeps the name it was written with; links open the notebook.
  await items.first().getByRole('link').click();
  await expect(page.getByRole('heading', { name: 'Weekly groceries' })).toBeVisible();
});
