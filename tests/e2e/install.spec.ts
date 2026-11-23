import { expect, type Page, test } from '@playwright/test';
import { amount, createNotebookViaUi } from './helpers';

const HINT = 'Install to keep your notes safe: tap Share, then Add to Home Screen.';
const hint = (page: Page) => page.getByRole('region', { name: 'Install Note-Add' });

test.describe('iPhone (WebKit, Safari user agent)', () => {
  test.beforeEach(({ browserName: _b }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'iPhone project only');
  });

  test('P7.5: first visit shows the hint before any data; dismissing keeps it away after a reload', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(hint(page)).toBeVisible();
    await expect(hint(page).getByText(HINT)).toBeVisible();
    await expect(hint(page).getByRole('button', { name: 'Back up now' })).toHaveCount(0);
    await hint(page).getByRole('button', { name: 'Got it' }).click();
    await expect(hint(page)).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Notebooks' })).toBeVisible();
    await expect(hint(page)).toHaveCount(0);
  });

  test('STO-05: with notes already in Safari, the hint says to back up first and offers it', async ({
    page,
  }) => {
    await createNotebookViaUi(page, 'Safari notes');
    await amount(page, 1).fill('450');
    await amount(page, 1).blur();
    await expect(page.getByText('Saved')).toBeVisible();
    await page.getByRole('link', { name: 'Notebooks', exact: true }).click();
    await expect(hint(page)).toContainText('Back up first, then restore inside the installed app');
    await expect(hint(page).getByRole('button', { name: 'Back up now' })).toBeVisible();
  });

  test('PWA-07: nothing is shown once installed to the home screen', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Notebooks' })).toBeVisible();
    await expect(hint(page)).toHaveCount(0);
  });
});

test.describe('Chromium (desktop and Android)', () => {
  test.beforeEach(({ browserName: _b }, testInfo) => {
    test.skip(testInfo.project.name === 'iphone-14', 'Chromium engines only');
  });

  test('the iPhone hint is not shown on Android or desktop', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Notebooks' })).toBeVisible();
    await expect(hint(page)).toHaveCount(0);
  });

  test('P7.5: "Install app" appears in Settings after beforeinstallprompt and uses the prompt', async ({
    page,
  }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Install app' })).toHaveCount(0);
    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: string }>;
      };
      event.prompt = () => {
        (window as unknown as { prompted: boolean }).prompted = true;
        return Promise.resolve();
      };
      event.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(event);
    });
    await page.getByRole('button', { name: 'Install app' }).click();
    expect(await page.evaluate(() => (window as unknown as { prompted?: boolean }).prompted)).toBe(
      true,
    );
    await expect(page.getByRole('button', { name: 'Install app' })).toHaveCount(0);
  });

  test('PWA-07: already installed (standalone display mode) → no Install app button', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (q: string) =>
        q.includes('display-mode: standalone') ? { ...real(q), matches: true } : real(q);
    });
    await page.goto('/settings');
    await page.evaluate(() =>
      window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true })),
    );
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Install app' })).toHaveCount(0);
  });

  test('P7.4 / STO-04: Settings › About shows the storage status as information', async ({
    page,
  }) => {
    await createNotebookViaUi(page, 'Storage');
    await amount(page, 1).fill('5');
    await amount(page, 1).blur();
    await expect(page.getByText('Saved')).toBeVisible(); // first save asks for persistent storage
    await page.goto('/settings');
    const status = page.getByTestId('storage-status');
    await expect(status).not.toHaveAttribute('data-status', 'unknown');
    await expect(status).toHaveText(
      /^Storage: (protected|may be cleared by the browser — keep backups)$/,
    );
  });

  test('STO-02: a small storage quota (private window) shows the deletion warning on every screen', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator.storage, 'estimate', {
        value: () => Promise.resolve({ quota: 30 * 1024 * 1024, usage: 0 }),
        configurable: true,
      });
    });
    await page.goto('/');
    await expect(
      page.getByText('Notes in a private window are deleted when it closes.'),
    ).toBeVisible();
    await createNotebookViaUi(page, 'Private');
    await expect(
      page.getByText('Notes in a private window are deleted when it closes.'),
    ).toBeVisible();
  });
});

test.describe('in-app browser (SHR-07)', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.38.108;]',
  });
  test.beforeEach(({ browserName: _b }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'one engine is enough');
  });

  test('"Open in Chrome or Safari to keep your notes." with the reason; OK hides it', async ({
    page,
  }) => {
    await page.goto('/');
    const banner = page
      .getByRole('status')
      .filter({ hasText: 'Open in Chrome or Safari to keep your notes.' });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('keeps its own storage and may block downloads');
    await createNotebookViaUi(page, 'In app'); // still visible on the editor screen
    await expect(banner).toBeVisible();
    await banner.getByRole('button', { name: 'OK' }).click();
    await expect(banner).toHaveCount(0);
  });
});
