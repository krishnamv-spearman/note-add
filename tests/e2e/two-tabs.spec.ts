import { expect, test } from '@playwright/test';
import { amount, broughtForward, editor, openFreshNotebook, total, stepPage } from './helpers';

test.beforeEach(({ browserName: _b }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'chromium only (test-plan §7.1)');
});

test('MTB-01 / CHN-11: page 1 edited in tab A updates page 3 in tab B live', async ({
  context,
}) => {
  const a = await context.newPage();
  await openFreshNotebook(a);
  await amount(a, 1).fill('100');
  await editor(a).getByRole('button', { name: 'New page' }).click();
  await expect(a.getByRole('heading', { name: 'Page 2 of 2' })).toBeVisible();
  await editor(a).getByRole('button', { name: 'New page' }).click();
  await expect(a.getByRole('heading', { name: 'Page 3 of 3' })).toBeVisible();
  const page3Url = a.url();

  const b = await context.newPage();
  await b.goto(page3Url);
  await expect(broughtForward(b)).toHaveText('100.00');

  await stepPage(a, 'Previous');
  await stepPage(a, 'Previous');
  await amount(a, 1).fill('250.50');
  await amount(a, 1).blur();
  await expect(broughtForward(b)).toHaveText('250.50'); // no reload in tab B
  await expect(total(b)).toHaveText('250.50');
});

test('MTB-02: same line edited in two tabs → notice, last write wins per line', async ({
  context,
}) => {
  const a = await context.newPage();
  await openFreshNotebook(a);
  const b = await context.newPage();
  await b.goto(a.url());
  await expect(b.getByRole('heading', { name: 'Page 1 of 1' })).toBeVisible();

  // B starts editing line 1 but has not saved yet (focused, within the debounce).
  await amount(b, 1).focus();
  await b.keyboard.type('5');
  // A saves a different value to the same line.
  await amount(a, 1).fill('9');
  await amount(a, 1).blur();
  await expect(a.getByText('Saved')).toBeVisible();

  await expect(b.getByText('This page was changed in another window')).toBeVisible();
  await amount(b, 2).focus(); // leaving the field takes the new values
  await expect(amount(b, 1)).toHaveValue('9.00');
  await expect(total(a)).toHaveText('9.00');
});
