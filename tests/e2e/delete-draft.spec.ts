import { expect, test } from '@playwright/test';
import {
  amount,
  broughtForward,
  createNotebookViaUi,
  editor,
  newPageFromEditor,
  total,
  stepPage,
} from './helpers';

test('LIF-05 / LIF-06: delete page 2 of 4, then page 1; pages renumber and chains are right', async ({
  page,
}) => {
  await createNotebookViaUi(page, 'Groceries');
  const amounts = ['10', '20', '30', '40'];
  for (const [i, a] of amounts.entries()) {
    if (i > 0) await newPageFromEditor(page, i + 1);
    await amount(page, 1).fill(a);
    await amount(page, 1).blur();
  }
  await expect(total(page)).toHaveText('100.00');

  await stepPage(page, 'Previous');
  await stepPage(page, 'Previous');
  await expect(page.getByRole('heading', { name: 'Page 2 of 4' })).toBeVisible();
  await editor(page).getByRole('button', { name: 'Delete page' }).click();
  await expect(page.getByText('Later pages will be renumbered')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete page' }).click();
  await expect(page.getByText('Page 2 deleted. Later pages were renumbered.')).toBeVisible();

  // Pages list newest first: 3, 2, 1 with totals 80, 40, 10.
  await expect(page.getByTestId('card-total-3')).toHaveText('80.00');
  await expect(page.getByTestId('card-total-2')).toHaveText('40.00');
  await expect(page.getByTestId('card-total-1')).toHaveText('10.00');

  await page.getByRole('link', { name: /Page 1/ }).click();
  await editor(page).getByRole('button', { name: 'Delete page' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete page' }).click();
  await expect(page.getByTestId('card-total-1')).toHaveText('30.00');
  await page.getByRole('link', { name: /Page 1/ }).click();
  await expect(broughtForward(page)).toHaveText('0.00');
  await expect(amount(page, 1)).toHaveValue('30.00');
});
