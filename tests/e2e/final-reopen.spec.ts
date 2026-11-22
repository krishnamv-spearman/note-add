import { expect, test } from '@playwright/test';
import { amount, createNotebookViaUi, editor, markFinal, todayDisplay } from './helpers';

test('LIF-18 / LIF-01 / LIF-02: Final refused while invalid; Final → Archive → Reopen', async ({
  page,
}) => {
  await createNotebookViaUi(page, 'Office petty cash');
  await amount(page, 1).fill('12a');
  await amount(page, 2).fill('300');
  await amount(page, 2).blur();
  await expect(
    page.getByText('1 amount is not a number. Fix it before marking this page Final.'),
  ).toBeVisible();
  await expect(editor(page).getByRole('button', { name: 'Mark as Final' })).toBeDisabled();
  await expect(page.getByRole('dialog')).toHaveCount(0); // refused

  await amount(page, 1).fill('120');
  await amount(page, 1).blur();
  await markFinal(page);
  const today = await todayDisplay(page);
  await expect(page.getByText(`Final since ${today}`)).toBeVisible();
  await expect(amount(page, 1)).toHaveAttribute('readonly', '');
  await expect(page.getByRole('toolbar', { name: 'Amount keys' })).toHaveCount(0);

  await page.getByRole('link', { name: '‹ Office petty cash' }).click();
  await expect(
    page.getByText('No draft pages. Final pages are in the Archive below.'),
  ).toBeVisible();
  const archive = page.locator('details.archive');
  await expect(archive.getByText('Archive (1)')).toBeVisible();
  await archive.getByRole('link', { name: /Page 1/ }).click();

  await page.getByRole('button', { name: 'Reopen' }).click();
  await expect(page.getByText(`Reopened on ${today}`)).toBeVisible();
  await expect(amount(page, 1)).not.toHaveAttribute('readonly', '');
  await page.getByRole('link', { name: '‹ Office petty cash' }).click();
  await expect(page.getByText('Archive (0)')).toBeVisible();
  await expect(page.getByRole('link', { name: /Draft.*Page 1/ })).toBeVisible();
});
