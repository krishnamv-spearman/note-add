import { expect, type Page, test } from '@playwright/test';

// Run by playwright.base-path.config.ts: the app built with VITE_BASE=/note-add/.
// Paths are relative (./) because the base URL itself ends in /note-add/.

const amount = (page: Page, n: number) =>
  page.getByRole('textbox', { name: `Line ${n} amount`, exact: true });

test('PWA-09: manifest, service worker, router, assets and offline all follow the base path', async ({
  page,
  context,
  baseURL,
}) => {
  const origin = new URL(baseURL as string).origin;
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Notebooks' })).toBeVisible();
  await expect(page).toHaveURL(`${origin}/note-add/`);

  // Manifest: scope, start_url and id are the base; icons resolve under it.
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/note-add/manifest.webmanifest');
  const manifest = (await (await page.request.get(`${origin}${href}`)).json()) as {
    start_url: string;
    scope: string;
    id: string;
    icons: { src: string }[];
  };
  expect([manifest.start_url, manifest.scope, manifest.id]).toEqual([
    '/note-add/',
    '/note-add/',
    '/note-add/',
  ]);
  for (const icon of manifest.icons) {
    const r = await page.request.get(new URL(icon.src, `${origin}${href}`).toString());
    expect(r.status(), icon.src).toBe(200);
  }
  expect(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')).toBe(
    '/note-add/icons/apple-touch-icon.png',
  );

  // Every script, style and font the page loads comes from under the base path.
  const loaded: string[] = [];
  page.on('request', (r) => loaded.push(new URL(r.url()).pathname));

  // Router: notebooks and pages live under the base path.
  await page.getByRole('button', { name: 'Add a new book' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Under a path');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: 'Page 1 of 1' })).toBeVisible();
  await expect(page).toHaveURL(/\/note-add\/n\/[^/]+\/p\/1$/);
  await amount(page, 1).fill('450');
  await amount(page, 1).blur();
  await expect(page.getByText('Saved')).toBeVisible();
  await page.getByRole('link', { name: 'Settings' }).click(); // lazy chunk under the base path
  await expect(page).toHaveURL(`${origin}/note-add/settings`);
  await expect(page.getByRole('heading', { name: 'Backup and restore' })).toBeVisible();
  expect(loaded.filter((p) => !p.startsWith('/note-add/'))).toEqual([]);

  // Service worker scope is the base path.
  await page.evaluate(() => navigator.serviceWorker.ready);
  expect(
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope),
  ).toBe(`${origin}/note-add/`);
  await page.goto('./');
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  // Offline deep link under the path.
  await page
    .locator('.stacks')
    .getByRole('link', { name: /Under a path/ })
    .click();
  await page.getByRole('link', { name: /Page 1/ }).click();
  await expect(page).toHaveURL(/\/note-add\/n\/[^/]+\/p\/1$/);
  const editorUrl = page.url();
  await context.setOffline(true);
  await page.goto(editorUrl);
  await expect(amount(page, 1)).toHaveValue('450.00');
});
