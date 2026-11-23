import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { linesOf } from '../builders';
import type { Notebook, Page } from '../../src/db/types';
import fontkit from '@pdf-lib/fontkit';
import { asPaise, isSupportedCodePoint } from '../../src/engine';
import {
  FONT_PACKAGES,
  type FontKey,
  fileNameOf,
  fontChains,
} from '../../src/features/export/fontFiles';
import { buildSlipModel, FOOTER } from '../../src/features/export/model';
import { renderSlipPdf } from '../../src/features/export/pdf';

const require = createRequire(import.meta.url);

const loadFont = (key: FontKey): Promise<Uint8Array> =>
  Promise.resolve(
    new Uint8Array(
      readFileSync(require.resolve(`@fontsource/${FONT_PACKAGES[key]}/files/${fileNameOf(key)}`)),
    ),
  );

const notebook: Notebook = {
  id: 'n1',
  name: 'Pune trip claims',
  colour: 'mint',
  createdAt: 0,
  updatedAt: 0,
};

function pageWith(lines: Page['lines'], extra: Partial<Page> = {}): Page {
  const sum = lines.reduce((s, l) => s + (l.amountPaise ?? 0), 0);
  return {
    id: 'p2',
    notebookId: 'n1',
    number: 2,
    date: '2026-11-20',
    title: 'Airport run',
    colour: null,
    lines,
    status: 'draft',
    finalisedOn: null,
    reopenedOn: [],
    totalUpdatedOn: null,
    broughtForwardPaise: asPaise(10000000),
    totalPaise: asPaise(10000000 + sum),
    createdAt: 0,
    updatedAt: 0,
    ...extra,
  };
}

async function pdfText(bytes: Uint8Array, keepSpaces = false): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    disableFontFace: true,
    useSystemFonts: false,
  });
  const doc = await task.promise;
  expect(doc.numPages).toBe(1);
  const content = await (await doc.getPage(1)).getTextContent();
  const strings = content.items
    .map((i) => ('str' in i ? i.str : ''))
    .filter((s) => keepSpaces || s.trim() !== '');
  await task.destroy();
  return strings;
}

// Real PDF builds plus pdfjs parsing; the first test also loads both libraries.
describe('PDF export (EXP-11)', { timeout: 30_000 }, () => {
  it('contains real, selectable text that matches the on-screen strings, fonts embedded', async () => {
    const lines = linesOf(
      ['450', '1280.75', '-300', '12a', '', '99,99,999.99'],
      ['Taxi to airport', 'Hotel, 2 nights', 'Refund (cancelled tour)', 'Snacks', 'Tips only'],
    );
    const page = pageWith(lines);
    const model = buildSlipModel(page, notebook, 3, 'carlito');
    const bytes = await renderSlipPdf(model, loadFont);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');

    const text = await pdfText(bytes);
    const expected = [
      'Pune trip claims',
      'Airport run',
      '20/11/2026 · Page 2 of 3 · Draft',
      'Brought forward',
      '1,00,000.00',
      'Taxi to airport',
      '450.00',
      'Hotel, 2 nights',
      '1,280.75',
      'Refund (cancelled tour)',
      '(300.00)',
      'Snacks',
      '12a',
      'Tips only',
      '99,99,999.99',
      'Total',
      model.total,
      FOOTER,
    ];
    // Every on-screen string appears, in reading order, exactly as the screen shows it.
    expect(text).toEqual(expected);
    expect(model.total).toBe('1,01,01,430.74');

    // Fonts are embedded (TrueType subsets), never the viewer's standard fonts.
    const raw = new TextDecoder('latin1').decode(bytes);
    expect((raw.match(/\/FontFile2/g) ?? []).length).toBeGreaterThanOrEqual(3);
    // pdf-lib names subsets /<PostScriptName>-<n>.
    expect(raw).toMatch(/\/BaseFont \/Carlito-Regular-\d+/);
    expect(raw).toMatch(/\/BaseFont \/WorkSans-(Regular|SemiBold)-\d+/);
    expect(raw).not.toMatch(/\/BaseFont \/(Helvetica|Times|Courier)/);
  });

  it.each(['atkinson', 'caladea', 'merriweather'] as const)(
    'embeds the chosen slip font: %s',
    async (fontId) => {
      const model = buildSlipModel(pageWith(linesOf(['5'], ['Tea'])), notebook, 2, fontId);
      const bytes = await renderSlipPdf(model, loadFont);
      const raw = new TextDecoder('latin1').decode(bytes);
      const family = {
        atkinson: 'AtkinsonHyperlegible',
        caladea: 'Caladea',
        merriweather: 'Merriweather',
      }[fontId];
      expect(raw).toMatch(new RegExp(`/BaseFont /${family}-Regular-\\d+`));
      expect(await pdfText(bytes)).toContain('Tea');
    },
  );

  it.each(['carlito', 'atkinson', 'caladea', 'merriweather'] as const)(
    'TXT-06: accented Latin, ₹ and punctuation export exactly, only bundled fonts embedded (%s)',
    async (fontId) => {
      const descriptions = [
        '₹450 tip — “quoted” • …',
        'Łódź, Dvořák, Škoda, Győr',
        'Café crème, Øresund, ß, ½',
      ];
      const model = buildSlipModel(
        pageWith(linesOf(['40', '25', '10'], descriptions)),
        notebook,
        2,
        fontId,
      );
      const bytes = await renderSlipPdf(model, loadFont);
      // A line drawn with two fonts (e.g. ₹ from the latin-ext subset) is several text items,
      // with the spaces between runs as their own items.
      const joined = (await pdfText(bytes, true)).join('');
      for (const d of descriptions) expect(joined).toContain(d); // nothing replaced by "?"
      expect(joined).not.toContain('?');
      const raw = new TextDecoder('latin1').decode(bytes);
      const fonts = [...raw.matchAll(/\/BaseFont \/([A-Za-z]+)-/g)].map((m) => m[1]);
      const family = {
        carlito: 'Carlito',
        atkinson: 'AtkinsonHyperlegible',
        caladea: 'Caladea',
        merriweather: 'Merriweather',
      }[fontId];
      expect(new Set(fonts)).toEqual(
        new Set(fonts.filter((f) => f === family || f === 'WorkSans')),
      );
      expect(raw).not.toMatch(/Devanagari|Noto/);
    },
  );

  it('TXT-07: every character the English-only rule allows has a glyph in each export font chain', async () => {
    const allowed: number[] = [];
    for (let cp = 0x20; cp <= 0x2100; cp++) if (isSupportedCodePoint(cp)) allowed.push(cp);
    expect(allowed).toContain(0x20b9);
    for (const fontId of ['carlito', 'atkinson', 'caladea', 'merriweather'] as const) {
      const chains = fontChains(fontId);
      for (const keys of [chains.body, chains.bold, chains.ui, chains.uiBold]) {
        const fonts = await Promise.all(
          keys.map(async (k) => fontkit.create(Buffer.from(await loadFont(k)))),
        );
        const missing = allowed.filter((cp) => !fonts.some((f) => f.hasGlyphForCodePoint(cp)));
        expect(
          missing.map((cp) => cp.toString(16)),
          `${fontId} ${keys[0]}`,
        ).toEqual([]);
      }
    }
  });

  it('EXP-02 / EXP-04 / EXP-05 / LIF-15: long text has an ellipsis; Final notes are included', async () => {
    const long = 'A very long description that cannot possibly fit on one line of the slip at all';
    const page = pageWith(linesOf(['1'], [long]), {
      status: 'final',
      finalisedOn: '2026-11-21',
      reopenedOn: ['2026-11-20'],
      totalUpdatedOn: '2026-11-22',
    });
    const model = buildSlipModel(page, notebook, 2, 'carlito');
    const text = await pdfText(await renderSlipPdf(model, loadFont));
    expect(text).toContain('20/11/2026 · Page 2 of 2 · Final');
    // EXP-05: all three notes are present, wrapped onto two lines without cutting.
    expect(text.join(' · ')).toContain(
      'Final since 21/11/2026 · Reopened on 20/11/2026 · Total updated from earlier page on 22/11/2026',
    );
    const cut = text.find((t) => t.startsWith('A very long'));
    expect(cut?.endsWith('…')).toBe(true);
    expect(cut!.length).toBeLessThan(long.length);
  });

  it('EXP-01: a page with all lines empty exports normally', async () => {
    const model = buildSlipModel(pageWith(linesOf()), notebook, 2, 'carlito');
    const text = await pdfText(await renderSlipPdf(model, loadFont));
    expect(text).toContain('Brought forward');
    expect(text).toContain('Total');
  });
});
