import { expect, test } from '@playwright/test';
import { activateServiceWorker, amount, createNotebookViaUi } from './helpers';

// Test plan §7.1: Chromium. Replaces the old Lighthouse PWA category (arch §12).
test.beforeEach(({ browserName: _b }, testInfo) => {
  test.skip(testInfo.project.name === 'iphone-14', 'Chromium installability (test-plan §7.1)');
});

test.describe('installable and cached', () => {
  test.use({ serviceWorkers: 'allow' });

  test('P7.3: the manifest has the required fields and every icon loads at its size', async ({
    page,
  }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe('/manifest.webmanifest');
    const response = await page.request.get('/manifest.webmanifest');
    expect(response.headers()['content-type']).toContain('application/manifest+json');
    const manifest = (await response.json()) as Record<string, unknown> & {
      icons: { src: string; sizes: string; type: string; purpose: string }[];
    };
    expect(manifest).toMatchObject({
      id: '/',
      name: 'Note-Add',
      short_name: 'Note-Add',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      theme_color: '#FFF4A3',
      background_color: '#FAFAF7',
      lang: 'en-IN',
    });
    expect(manifest.icons.map((i) => `${i.sizes} ${i.purpose}`).sort()).toEqual([
      '192x192 any',
      '512x512 any',
      '512x512 maskable',
    ]);
    for (const icon of manifest.icons) {
      const png = await page.request.get(`/${icon.src}`);
      expect(png.status(), icon.src).toBe(200);
      expect(png.headers()['content-type']).toBe('image/png');
      const size = await page.evaluate(
        async (b64) => {
          const img = new Image();
          img.src = `data:image/png;base64,${b64}`;
          await img.decode();
          return `${img.naturalWidth}x${img.naturalHeight}`;
        },
        (await png.body()).toString('base64'),
      );
      expect(size).toBe(icon.sizes);
    }
  });

  test('P7.3: iPhone and browser tags — apple-touch-icon 180, standalone, title, favicon', async ({
    page,
  }) => {
    await page.goto('/');
    const meta = (name: string) => page.locator(`meta[name="${name}"]`).getAttribute('content');
    expect(await meta('apple-mobile-web-app-capable')).toBe('yes');
    expect(await meta('mobile-web-app-capable')).toBe('yes');
    expect(await meta('apple-mobile-web-app-title')).toBe('Note-Add');
    expect(await meta('theme-color')).toBe('#FFF4A3');
    const touch = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
    expect(touch).toBe('/icons/apple-touch-icon.png');
    const size = await page.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      return `${img.naturalWidth}x${img.naturalHeight}`;
    }, touch as string);
    expect(size).toBe('180x180');
    expect((await page.request.get('/favicon.svg')).status()).toBe(200);
  });

  test('P7.1: a service worker controls the page after first load', async ({ page }) => {
    await activateServiceWorker(page);
    const worker = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return { scope: reg?.scope, script: reg?.active?.scriptURL, state: reg?.active?.state };
    });
    expect(worker.scope).toMatch(/\/$/);
    expect(worker.script).toMatch(/\/sw\.js$/);
    expect(worker.state).toBe('activated');
  });

  test('D30: the precache holds the app, the lazy chunks and only latin / latin-ext fonts', async ({
    page,
  }) => {
    await activateServiceWorker(page);
    const urls = await page.evaluate(async () => {
      const names = await caches.keys();
      const out: string[] = [];
      for (const n of names) for (const r of await (await caches.open(n)).keys()) out.push(r.url);
      return out.map((u) => new URL(u).pathname);
    });
    const has = (re: RegExp) => urls.some((u) => re.test(u));
    expect(has(/^\/$|^\/index\.html$/)).toBe(true);
    expect(has(/\/assets\/exporter-.*\.js$/)).toBe(true); // export works offline
    expect(has(/\/assets\/EditorRoute-.*\.js$/)).toBe(true);
    expect(has(/\/assets\/SettingsScreen-.*\.js$/)).toBe(true);
    expect(has(/\/icons\/icon-512\.png$/)).toBe(true);
    expect(has(/\/fonts\/LICENSES\/Carlito-OFL\.txt$/)).toBe(true);
    const fonts = urls.filter((u) => /\.woff2?$/.test(u));
    expect(fonts.length).toBeGreaterThan(30);
    expect(fonts.filter((u) => !/-latin(-ext)?-/.test(u))).toEqual([]); // no cyrillic, greek, …
    for (const family of [
      'carlito',
      'atkinson-hyperlegible',
      'caladea',
      'merriweather',
      'work-sans',
    ]) {
      expect(
        fonts.some((u) => u.includes(`${family}-latin-400`)),
        family,
      ).toBe(true);
      expect(
        fonts.some((u) => u.endsWith('.woff2') && u.includes(`${family}-latin-ext-400`)),
        family,
      ).toBe(true);
    }
  });

  test('P7.2 / PWA-03: a new version shows the prompt; nothing reloads by itself; Reload saves typing first', async ({
    page,
  }) => {
    await activateServiceWorker(page);
    await createNotebookViaUi(page, 'Update test');
    await amount(page, 1).fill('777'); // typed, not saved yet, no blur
    const origin = await page.evaluate(() => performance.timeOrigin);
    // A different worker script for the same scope is installed next to the active one and
    // waits: exactly what a deployed new version looks like to the page. (Whether the browser
    // notices a real deploy is a manual check, M7.)
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js?v=2');
    });
    await expect(page.getByText('New version available —')).toBeVisible();
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(origin); // no reload by itself

    await page.getByRole('button', { name: 'Reload' }).click();
    await page.waitForFunction((o) => performance.timeOrigin !== o, origin);
    await expect(page.getByRole('heading', { name: 'Page 1 of 1' })).toBeVisible();
    await expect(amount(page, 1)).toHaveValue('777.00'); // saved before the reload
  });
});

test.describe('without a service worker', () => {
  test.use({ serviceWorkers: 'block' });

  test('PWA-10: a blocked or failed registration changes nothing and shows no error', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Notebooks' })).toBeVisible();
    await createNotebookViaUi(page, 'No worker');
    await amount(page, 1).fill('5');
    await amount(page, 1).blur();
    await expect(page.getByText('Saved')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});
