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
