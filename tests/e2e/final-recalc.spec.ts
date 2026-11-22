import { expect, test } from '@playwright/test';
import {
  amount,
  createNotebookViaUi,
  markFinal,
  newPageFromEditor,
  todayDisplay,
  total,
  stepPage,
} from './helpers';

test('CHN-04 / CHN-08: editing page 1 updates Final page 2 with a note; Reopen clears it', async ({
  page,
}) => {
  await createNotebookViaUi(page, 'Trip');
  await amount(page, 1).fill('100');
  await newPageFromEditor(page, 2);
  await amount(page, 1).fill('5');
  await amount(page, 1).blur();
  await markFinal(page);
  await expect(total(page)).toHaveText('105.00');

  await stepPage(page, 'Previous');
  await amount(page, 1).fill('200');
  await amount(page, 1).blur();
  await expect(page.getByText('Saved')).toBeVisible();
  await stepPage(page, 'Next');
  await expect(total(page)).toHaveText('205.00');
  const today = await todayDisplay(page);
  await expect(page.getByText(`Total updated from earlier page on ${today}`)).toBeVisible();

  await page.getByRole('button', { name: 'Reopen' }).click();
  await expect(page.getByText(`Reopened on ${today}`)).toBeVisible();
  await expect(page.getByText(/Total updated from earlier page/)).toHaveCount(0);
});
