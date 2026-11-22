import { expect, type Page, test } from '@playwright/test';
import { amount, createNotebookViaUi } from './helpers';

test.beforeEach(({ browserName: _b }, testInfo) => {
  test.skip(testInfo.project.name === 'chromium-desktop', 'phone projects only (test-plan §7.1)');
});

/** Every visible button, link, input and summary; radios/checkboxes measured by their label. */
async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const els = document.querySelectorAll<HTMLElement>('button, a[href], input, summary, select');
    for (const el of els) {
      if (el.closest('[aria-hidden="true"]') || el.closest('dialog:not([open])')) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      let target: HTMLElement = el;
      if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) {
        target = el.closest('label') ?? el;
      }
      const r = target.getBoundingClientRect();
      if (r.width <= 1 && r.height <= 1) continue; // visually-hidden helpers
      if (r.width < 43.5 || r.height < 43.5) {
        out.push(
          `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`,
        );
      }
    }
    return out;
  });
}

test('A11Y-07: every interactive element is at least 44 × 44 px on every screen', async ({
  page,
}) => {
  await page.goto('/');
  expect(await smallTargets(page), 'empty library').toEqual([]);

  await createNotebookViaUi(page, 'Targets');
  await amount(page, 1).fill('12a');
  await amount(page, 2).focus();
  expect(await smallTargets(page), 'editor').toEqual([]);

  await page.getByRole('link', { name: '‹ Targets' }).click();
  await page.locator('summary').click();
  expect(await smallTargets(page), 'pages list').toEqual([]);

  await page.getByRole('link', { name: '‹ Notebooks' }).click();
  await expect(page.getByRole('region', { name: 'Recent activity' })).toBeVisible();
  expect(await smallTargets(page), 'library').toEqual([]);

  await page.getByRole('searchbox', { name: 'Search' }).fill('targets');
  expect(await smallTargets(page), 'search results').toEqual([]);

  await page.getByRole('link', { name: 'Settings' }).click();
  expect(await smallTargets(page), 'settings').toEqual([]);

  await page.getByRole('link', { name: 'Notebooks', exact: true }).click();
  await page.getByRole('button', { name: 'Add a new book' }).click();
  expect(await smallTargets(page), 'new notebook dialog').toEqual([]);
});
