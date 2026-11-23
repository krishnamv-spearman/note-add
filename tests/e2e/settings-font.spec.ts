import { expect, type Page, test } from '@playwright/test';
import { amount, createNotebookViaUi } from './helpers';

const FONTS = [
  ['Calibri-style', 'Carlito'],
  ['Verdana-style', 'Atkinson Hyperlegible'],
  ['Cambria-style', 'Caladea'],
  ['Classic serif', 'Merriweather'],
] as const;

const FONT_IDS = {
  Carlito: 'carlito',
  'Atkinson Hyperlegible': 'atkinson',
  Caladea: 'caladea',
  Merriweather: 'merriweather',
} as const;

/** The font stored in IndexedDB's settings row. */
const storedFont = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string | null>((resolve) => {
        const open = indexedDB.open('note-add');
        open.onsuccess = () => {
          const req = open.result.transaction('settings').objectStore('settings').get('settings');
          req.onsuccess = () => {
            resolve((req.result as { font?: string } | undefined)?.font ?? null);
            open.result.close();
          };
        };
      }),
  );

test('LOOK-08: each font applies to the editor and persists after reload', async ({ page }) => {
  await createNotebookViaUi(page, 'Fonts');
  const editorUrl = page.url();
  // Default font.
  await expect(amount(page, 1)).toHaveCSS('font-family', /^Carlito/);

  for (const [label, family] of FONTS) {
    await page.goto('/settings');
    await page.getByRole('radio', { name: new RegExp(`^${label}`) }).check();
    // The radio updates at once (optimistic); wait until the setting is stored before the
    // test reloads the page, as a full reload can otherwise interrupt the write.
    // No stored row at all means the default font (Calibri-style, "carlito"): choosing the
    // default needs no write, so the row may not exist yet.
    await expect.poll(async () => (await storedFont(page)) ?? 'carlito').toBe(FONT_IDS[family]);
    await expect(page.getByTestId('font-preview')).toHaveCSS(
      'font-family',
      new RegExp(`^"?${family}"?`),
    );
    await page.goto(editorUrl);
    await expect(amount(page, 1)).toHaveCSS('font-family', new RegExp(`^"?${family}"?`));
    await page.reload();
    await expect(amount(page, 1)).toHaveCSS('font-family', new RegExp(`^"?${family}"?`));
    // The font file actually loaded (bundled, same origin).
    await expect
      .poll(() => page.evaluate((f) => document.fonts.check(`16px "${f}"`), family))
      .toBe(true);
    await page.goto('/settings');
    await expect(page.getByRole('radio', { name: new RegExp(`^${label}`) })).toBeChecked();
  }
});

test('About and privacy: version, Spearman link opens outside the app (PWA-06), statement', async ({
  page,
}) => {
  await page.goto('/settings');
  await expect(page.getByText(/^Note-Add version \d+\.\d+\.\d+$/)).toBeVisible();
  const link = page.getByRole('link', { name: 'spearman.in' });
  await expect(link).toHaveAttribute('href', 'https://spearman.in');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
  await expect(
    page.getByText(
      'Note-Add stores your notes only on your device. Nothing is sent to Spearman or anyone else. Backups and exports go only where you choose to send them.',
    ),
  ).toBeVisible();
  const licence = await page.request.get('/fonts/LICENSES/Carlito-OFL.txt');
  expect(await licence.text()).toContain('SIL Open Font License');
});
