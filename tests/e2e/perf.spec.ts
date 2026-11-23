import { expect, test, type Page } from '@playwright/test';
import { activateServiceWorker, createNotebookViaUi } from './helpers';

// P7.8/P7.9, arch §14. Chromium only (layout-shift entries); Lighthouse covers the rest in CI.
test.beforeEach(({ browserName: _b }, testInfo) => {
  test.skip(testInfo.project.name === 'iphone-14', 'layout-shift entries are Chromium-only');
});

async function observeShifts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[])
        if (!e.hadRecentInput) w.__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

const cls = (page: Page) => page.evaluate(() => (window as unknown as { __cls: number }).__cls);

test('P7.8: cold loads of the library, a notebook and Settings shift the layout by < 0.1', async ({
  page,
}) => {
  await observeShifts(page);
  await createNotebookViaUi(page, 'Shifts');
  const editor = page.url();
  const notebook = editor.replace(/\/page\/.*$/, '');
  for (const url of ['/', notebook, '/settings', editor]) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    expect(await cls(page), url).toBeLessThan(0.1);
  }
});

test('P7.8: the default font and Work Sans are preloaded from the HTML', async ({ page }) => {
  await page.goto('/');
  const hrefs = await page
    .locator('link[rel="preload"][as="font"]')
    .evaluateAll((ls) => ls.map((l) => l.getAttribute('href')));
  expect(hrefs.filter((h) => /work-sans-latin-(400|600)-normal/.test(h ?? ''))).toHaveLength(2);
  expect(hrefs.some((h) => /carlito-latin-400-normal/.test(h ?? ''))).toBe(true);
});

test.describe('repeat visit', () => {
  test.use({ serviceWorkers: 'allow' });

  test('P7.9: with the service worker active, a reload is interactive in under 1 s', async ({
    page,
  }) => {
    await page.goto('/');
    await activateServiceWorker(page);
    await page.reload();
    await page.waitForLoadState('load');
    const t = await page.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return n.domInteractive;
    });
    expect(t).toBeLessThan(1000);
    await expect(page.getByRole('heading', { name: /notebooks|note-add/i }).first()).toBeVisible();
  });
});
