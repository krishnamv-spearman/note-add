import { expect, test } from '@playwright/test';
import { amount, createNotebookViaUi, description } from './helpers';

const COLOURS = [
  'Canary yellow',
  'Mint green',
  'Blush pink',
  'Lavender',
  'Sky blue',
  'Peach',
  'Light grey',
] as const;

// DEV-03 / test-plan §8: baselines are created and compared only on CI Linux, because font
// rendering differs between operating systems.
test.beforeEach(({ browserName: _b }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium-desktop' || process.platform !== 'linux' || !process.env.CI,
    'visual baselines run on CI Linux only',
  );
});

for (const colour of COLOURS) {
  test(`slip baseline: editor in ${colour}`, async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 900 });
    await page.clock.setFixedTime(new Date('2026-11-20T10:00:00+05:30'));
    await createNotebookViaUi(page, 'Visual', colour);
    await description(page, 1).fill('Taxi to airport');
    await amount(page, 1).fill('1280.75');
    await description(page, 2).fill('Refund');
    await amount(page, 2).fill('-300');
    await amount(page, 2).blur();
    await expect(page.locator('.editor-slip')).toHaveScreenshot(
      `slip-${colour.toLowerCase().replace(/\s+/g, '-')}.png`,
      { maxDiffPixelRatio: 0.001 },
    );
  });
}

const FONTS = ['Calibri-style', 'Verdana-style', 'Cambria-style', 'Classic serif'] as const;

for (const font of FONTS) {
  test(`export baseline: JPEG in ${font}`, async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    });
    await page.clock.setFixedTime(new Date('2026-11-20T10:00:00+05:30'));
    await page.goto('/settings');
    await page.getByRole('radio', { name: new RegExp(`^${font}`) }).check();
    await createNotebookViaUi(page, 'Visual');
    await description(page, 1).fill('Taxi to airport');
    await amount(page, 1).fill('1280.75');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('article').getByRole('button', { name: 'Export JPEG' }).click(),
    ]);
    const { readFileSync } = await import('node:fs');
    expect(readFileSync(await download.path())).toMatchSnapshot(
      `export-${font.toLowerCase().replace(/\s+/g, '-')}.jpg`,
      { maxDiffPixelRatio: 0.001 },
    );
  });
}
