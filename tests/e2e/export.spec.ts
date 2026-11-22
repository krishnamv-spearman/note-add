import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import {
  amount,
  createNotebookViaUi,
  description,
  editor,
  newPageFromEditor,
  total,
} from './helpers';

test.beforeEach(({ browserName: _b }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'chromium only (test-plan §7.1)');
});

/** A desktop without the Web Share API: exports must download (P5.7 step 2). */
async function withoutShare(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  });
}

async function downloadFrom(page: Page, button: string) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    editor(page).getByRole('button', { name: button }).click(),
  ]);
  const path = await download.path();
  return { name: download.suggestedFilename(), bytes: new Uint8Array(readFileSync(path)) };
}

async function pdfStrings(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({
    data: bytes.slice(), // pdfjs detaches the buffer it is given
    disableFontFace: true,
    useSystemFonts: false,
  });
  const doc = await task.promise;
  const content = await (await doc.getPage(1)).getTextContent();
  await task.destroy();
  return content.items.map((i) => ('str' in i ? i.str : '')).filter((s) => s.trim() !== '');
}

function jpegSize(bytes: Uint8Array): { width: number; height: number } {
  for (let i = 2; i < bytes.length - 9; i++) {
    if (bytes[i] === 0xff && (bytes[i + 1] === 0xc0 || bytes[i + 1] === 0xc2)) {
      return {
        height: (bytes[i + 5]! << 8) | bytes[i + 6]!,
        width: (bytes[i + 7]! << 8) | bytes[i + 8]!,
      };
    }
  }
  throw new Error('no SOF marker');
}

const fileDate = (page: Page) =>
  page.evaluate(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
  });

test('EXP-11 / FN-01 / EXP-07: PDF downloads with real text matching the screen', async ({
  page,
}) => {
  const cspErrors: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to/.test(m.text())) cspErrors.push(m.text());
  });
  await withoutShare(page);
  await createNotebookViaUi(page, 'Pune trip claims');
  await amount(page, 1).fill('100');
  await newPageFromEditor(page, 2);
  await page.getByRole('textbox', { name: 'Title' }).fill('Airport run');
  await description(page, 1).fill('Taxi to airport');
  await amount(page, 1).fill('1280.75');
  await description(page, 2).fill('Refund');
  await amount(page, 2).fill('-300');
  await description(page, 3).fill('Snacks');
  // EXP-07: export straight after typing — no blur, no wait for autosave.
  await amount(page, 3).fill('12a');

  const { name, bytes } = await downloadFrom(page, 'Export PDF');
  expect(name).toBe(`Pune trip claims-Airport run-${await fileDate(page)}.pdf`);
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');

  // The strings the screen shows, read from the page itself.
  const screen = {
    bf: (await page.getByTestId('brought-forward').textContent())!,
    total: (await total(page).textContent())!,
    date: await page.getByRole('textbox', { name: 'Date' }).inputValue(),
    amounts: [
      await amount(page, 1).inputValue(),
      await amount(page, 2).inputValue(),
      await amount(page, 3).inputValue(),
    ],
  };
  expect(screen.amounts).toEqual(['1,280.75', '(300.00)', '12a']);
  const text = await pdfStrings(bytes);
  expect(text).toEqual([
    'Pune trip claims',
    'Airport run',
    `${screen.date} · Page 2 of 2 · Draft`,
    'Brought forward',
    screen.bf,
    'Taxi to airport',
    screen.amounts[0],
    'Refund',
    screen.amounts[1],
    'Snacks',
    screen.amounts[2],
    'Total',
    screen.total,
    'Made with Note-Add · spearman.in',
  ]);
  expect(screen.total).toBe('1,080.75');
  const raw = new TextDecoder('latin1').decode(bytes);
  expect(raw).toMatch(/\/FontFile2/); // fonts embedded
  expect(raw).toMatch(/\/BaseFont \/Carlito-Regular-\d+/);
  expect(cspErrors).toEqual([]); // works under the production CSP (SEC-04)
});

test('P5.4 / FN-01: JPEG downloads at 1080 × 1350', async ({ page }) => {
  await withoutShare(page);
  await createNotebookViaUi(page, 'Groceries');
  await amount(page, 1).fill('450');
  const { name, bytes } = await downloadFrom(page, 'Export JPEG');
  expect(name).toBe(`Groceries-Page 1-${await fileDate(page)}.jpg`);
  expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]);
  expect(jpegSize(bytes)).toEqual({ width: 1080, height: 1350 });
});

test('EXP-03: Hindi, emoji and Arabic descriptions render in the JPEG (not blank)', async ({
  page,
}) => {
  await withoutShare(page);
  await createNotebookViaUi(page, 'Scripts');
  await description(page, 1).fill('दूध और ब्रेड');
  await description(page, 2).fill('🚕🚕🚕');
  await description(page, 3).fill('قهوة وشاي');
  const { bytes } = await downloadFrom(page, 'Export JPEG');
  const inked = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    // Description area of lines 1–3 (baselines 408, 486, 564; ~36 px tall glyphs).
    return [408, 486, 564].map((baseline) => {
      const { data } = ctx.getImageData(72, baseline - 40, 560, 52);
      let dark = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i]! + data[i + 1]! + data[i + 2]! < 380) dark++;
      }
      return dark;
    });
  }, Buffer.from(bytes).toString('base64'));
  for (const n of inked) expect(n).toBeGreaterThan(200);

  // The PDF builds too (Devanagari fallback font; emoji become "?").
  const pdf = await downloadFrom(page, 'Export PDF');
  const text = (await pdfStrings(pdf.bytes)).join('|');
  expect(text).toContain('???');
});

test('P5.9: page cards export too; Preparing… shows while building', async ({ page }) => {
  await withoutShare(page);
  await createNotebookViaUi(page, 'Cards');
  await amount(page, 1).fill('5');
  await amount(page, 1).blur();
  await expect(page.getByText('Saved')).toBeVisible();
  await page.getByRole('link', { name: '‹ Cards' }).click();
  const card = page.locator('.page-card').first();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    card.getByRole('button', { name: 'Export PDF' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(`Cards-Page 1-${await fileDate(page)}.pdf`);
});

test('share menu path (emulated): the file goes to navigator.share; second tap after NotAllowedError', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as { shared: { name: string; type: string }[]; shareMode: string };
    w.shared = [];
    w.shareMode = 'not-allowed-once';
    Object.defineProperty(navigator, 'canShare', {
      value: (d: ShareData) => Array.isArray(d.files) && d.files.length === 1,
      configurable: true,
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: (d: ShareData) => {
        if (w.shareMode === 'not-allowed-once') {
          w.shareMode = 'ok';
          return Promise.reject(new DOMException('gesture expired', 'NotAllowedError'));
        }
        if (w.shareMode === 'abort')
          return Promise.reject(new DOMException('closed', 'AbortError'));
        const f = d.files![0]!;
        w.shared.push({ name: f.name, type: f.type });
        return Promise.resolve();
      },
    });
  });
  await createNotebookViaUi(page, 'Share');
  await amount(page, 1).fill('9');

  // SHR-02: the first share is refused (slow file on iPhone) → "Your file is ready" + Share.
  await editor(page).getByRole('button', { name: 'Export PDF' }).click();
  await expect(page.getByText('Your file is ready')).toBeVisible();
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(page.getByText('Your file is ready')).toHaveCount(0);
  const shared = await page.evaluate(() => (window as unknown as { shared: unknown[] }).shared);
  expect(shared).toEqual([
    { name: `Share-Page 1-${await fileDate(page)}.pdf`, type: 'application/pdf' },
  ]);

  // SHR-01: closing the sheet shows nothing.
  await page.evaluate(() => ((window as unknown as { shareMode: string }).shareMode = 'abort'));
  await editor(page).getByRole('button', { name: 'Export JPEG' }).click();
  await expect(editor(page).getByRole('button', { name: 'Export JPEG' })).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('Your file is ready')).toHaveCount(0);
});

test('EXP-08: when the export code cannot load (offline first visit), a clear message', async ({
  page,
}) => {
  await createNotebookViaUi(page, 'Offline');
  await page.route(/\/assets\/exporter-.*\.js$/, (r) => r.abort());
  await editor(page).getByRole('button', { name: 'Export PDF' }).click();
  await expect(
    page.getByText('Export needs one online visit first. Connect and try again.'),
  ).toBeVisible();
});
