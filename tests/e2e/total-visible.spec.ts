import { expect, type Page, test } from '@playwright/test';
import { amount, createNotebookViaUi, description } from './helpers';

// Phase 8 part 2: the Total is the most important number; scrolled to the bottom of a full
// page it must be completely visible above the bottom navigation, whatever else is open.

const SIZES = [
  { name: 'desktop 1280x720', width: 1280, height: 720 },
  { name: 'small phone 360x640', width: 360, height: 640 },
  { name: 'iPhone SE 375x667', width: 375, height: 667 },
  { name: 'Pixel 7 412x915', width: 412, height: 915 },
] as const;

async function fillPage(page: Page): Promise<void> {
  await createNotebookViaUi(page, 'Full page');
  for (let i = 1; i <= 10; i++) {
    await description(page, i).fill(`Item ${i}`);
    await amount(page, i).fill('1234.50');
  }
  await amount(page, 10).blur();
}

async function expectTotalClear(page: Page, label: string): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const row = page.getByTestId('total').locator('xpath=ancestor::*[contains(@class,"row")][1]');
  await expect(row, label).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav).toBeVisible();
  // Wait until the scroll has settled.
  let previous = -1;
  await expect
    .poll(async () => {
      const y = (await row.boundingBox())?.y ?? -2;
      const settled = y === previous;
      previous = y;
      return settled;
    })
    .toBe(true);
  const rowBox = await row.boundingBox();
  const navBox = await nav.boundingBox();
  const viewport = page.viewportSize();
  if (!rowBox || !navBox || !viewport) throw new Error('missing box');
  expect(rowBox.y, `${label}: Total row inside the viewport (top)`).toBeGreaterThanOrEqual(0);
  expect(rowBox.y + rowBox.height, `${label}: row bottom above the navigation`).toBeLessThanOrEqual(
    navBox.y,
  );
  expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(viewport.height);
}

for (const size of SIZES) {
  test(`LOOK-05: ${size.name}: the Total row is fully visible above the bottom navigation`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await fillPage(page);
    await expectTotalClear(page, size.name);
  });
}

test('LOOK-05: at the largest text size the Total row is still above the navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await fillPage(page);
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await expectTotalClear(page, 'largest text');
});

test('LOOK-05: with notices open in the toast layer the Total row is still reachable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await fillPage(page);
  // Two notices, as in D74 (for example "ready to work offline" and "update available").
  await page.evaluate(() => {
    const layer = document.querySelector('.toast-layer');
    if (!layer) throw new Error('no toast layer');
    for (const text of ['Note-Add is ready to work offline.', 'A new version is ready.']) {
      const p = document.createElement('p');
      p.className = 'banner';
      p.textContent = text;
      layer.appendChild(p);
    }
  });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const row = page.getByTestId('total').locator('xpath=ancestor::*[contains(@class,"row")][1]');
  const toast = page.locator('.toast-layer');
  await expect(toast).toBeVisible();
  await expect
    .poll(async () => {
      const r = await row.boundingBox();
      const t = await toast.boundingBox();
      return r && t ? t.y - (r.y + r.height) : -999;
    })
    .toBeGreaterThanOrEqual(0);
});
