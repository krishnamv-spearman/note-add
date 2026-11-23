import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import fontkit from '@pdf-lib/fontkit';
import { describe, expect, it } from 'vitest';
import { FONT_PACKAGES, type FontKey, fileNameOf } from '../../src/features/export/fontFiles';
import {
  MiniFont,
  miniFontkit,
  parseFont,
  readFontTables,
  subsetFont,
  writeSfnt,
} from '../../src/features/export/ttf';

const require = createRequire(import.meta.url);
const bytesOf = (key: FontKey) =>
  new Uint8Array(
    readFileSync(require.resolve(`@fontsource/${FONT_PACKAGES[key]}/files/${fileNameOf(key)}`)),
  );
const load = async (key: FontKey) => parseFont(await readFontTables(bytesOf(key)));
const cps = (s: string) => [...s].map((c) => c.codePointAt(0) as number);

const KEYS: FontKey[] = [
  'carlito-latin-400',
  'carlito-latin-ext-400',
  'atkinson-hyperlegible-latin-700',
  'caladea-latin-400',
  'merriweather-latin-400',
  'work-sans-latin-600',
  'work-sans-latin-ext-400',
];

describe('TrueType toolkit (D37: replaces fontkit in the export chunk)', () => {
  it.each(KEYS)(
    'reads %s (WOFF) and agrees with fontkit on metrics and glyph widths',
    async (key) => {
      const mine = await load(key);
      const ref = fontkit.create(Buffer.from(bytesOf(key)));
      expect(mine.unitsPerEm).toBe(ref.unitsPerEm);
      expect(mine.numGlyphs).toBe(ref.numGlyphs);
      expect(mine.ascent).toBe(ref.ascent);
      expect(mine.descent).toBe(ref.descent);
      expect(mine.postscriptName).toBe(ref.postscriptName);
      for (const cp of [...cps('0123456789.,()-₹ AaZz'), 0xe9, 0x141, 0x2014]) {
        const glyph = ref.hasGlyphForCodePoint(cp) ? ref.glyphForCodePoint(cp) : null;
        expect(mine.cmap.has(cp), `U+${cp.toString(16)}`).toBe(glyph !== null && glyph.id !== 0);
        if (glyph && glyph.id !== 0) {
          expect(mine.cmap.get(cp)).toBe(glyph.id);
          expect(mine.advance(glyph.id)).toBe(glyph.advanceWidth);
        }
      }
    },
  );

  it('every character the English-only rule allows maps to the same glyph as fontkit', async () => {
    const mine = await load('carlito-latin-400');
    const ref = fontkit.create(Buffer.from(bytesOf('carlito-latin-400')));
    for (let cp = 0x20; cp <= 0x17f; cp++) {
      if (!ref.hasGlyphForCodePoint(cp)) continue;
      expect(mine.cmap.get(cp), `U+${cp.toString(16)}`).toBe(ref.glyphForCodePoint(cp).id);
    }
  });

  it.each(KEYS)('subset of %s is a valid font with identical outlines and widths', async (key) => {
    const font = await load(key);
    const text = 'Taxi 1,280.75 (300.00) ₹ Café Łódź — “quoted” …';
    const subset = subsetFont(font, cps(text));
    const ref = fontkit.create(Buffer.from(bytesOf(key)));
    const out = fontkit.create(Buffer.from(subset));
    expect(out.unitsPerEm).toBe(ref.unitsPerEm);
    expect(out.numGlyphs).toBe(ref.numGlyphs); // glyph IDs are unchanged
    expect(out.postscriptName).toBe(ref.postscriptName);
    let checked = 0;
    for (const cp of cps(text)) {
      if (!ref.hasGlyphForCodePoint(cp)) continue;
      const a = ref.glyphForCodePoint(cp);
      const b = out.glyphForCodePoint(cp);
      expect(b.id).toBe(a.id);
      expect(b.advanceWidth).toBe(a.advanceWidth);
      expect(b.path.toSVG()).toBe(a.path.toSVG()); // the very same outline
      checked++;
    }
    expect(checked).toBeGreaterThan(key.includes('latin-ext') ? 5 : 20); // latin-ext files hold fewer of these characters
    // Unused glyphs are empty, so the subset is much smaller than the source.
    expect(subset.length).toBeLessThan(bytesOf(key).length);
  });

  it('keeps the components of composite glyphs (accented letters)', async () => {
    const font = await load('carlito-latin-400');
    const ref = fontkit.create(Buffer.from(bytesOf('carlito-latin-400')));
    const accented = cps('ÁéîõüŠžÇñ');
    const composite = accented.filter((cp) => {
      const g = ref.glyphForCodePoint(cp) as unknown as {
        _getContours?: unknown;
        path: { commands: unknown[] };
      };
      return g.path.commands.length > 0;
    });
    expect(composite.length).toBe(accented.length);
    const out = fontkit.create(Buffer.from(subsetFont(font, accented)));
    for (const cp of accented) {
      expect(out.glyphForCodePoint(cp).path.toSVG()).toBe(ref.glyphForCodePoint(cp).path.toSVG());
    }
  });

  it('subset contains the tables PDF needs and a correct checksum adjustment', async () => {
    const font = await load('merriweather-latin-400');
    const subset = subsetFont(font, cps('Total 450.00'));
    const tables = await readFontTables(subset);
    for (const t of ['head', 'hhea', 'maxp', 'hmtx', 'loca', 'glyf', 'cmap', 'name', 'post']) {
      expect(tables.has(t), t).toBe(true);
    }
    // Whole-file checksum must equal 0xB1B0AFBA (that is what checkSumAdjustment guarantees).
    const d = new DataView(subset.buffer, subset.byteOffset, subset.byteLength);
    let sum = 0;
    for (let i = 0; i < subset.length; i += 4) sum = (sum + d.getUint32(i)) >>> 0;
    expect(sum).toBe(0xb1b0afba);
  });

  it('unmapped characters become .notdef and are not in the character set', async () => {
    const font = await load('carlito-latin-400');
    const mini = new MiniFont(parseFont(await readFontTables(subsetFont(font, cps('AB')))));
    expect(mini.characterSet).toEqual(cps('AB'));
    expect(mini.layout('A?').glyphs.map((g) => g.id)).toEqual([font.cmap.get(65), 0]);
    expect(mini.layout('AB').glyphs[0]?.advanceWidth).toBe(
      font.advance(font.cmap.get(65) as number),
    );
  });

  it('miniFontkit.create reads the subset bytes; rejects CFF and non-fonts', async () => {
    const font = await load('work-sans-latin-400');
    expect(miniFontkit.create(subsetFont(font, cps('Hi'))).characterSet).toEqual(cps('Hi'));
    await expect(
      readFontTables(new Uint8Array([0x4f, 0x54, 0x54, 0x4f, 0, 0, 0, 0])),
    ).rejects.toThrow(/CFF/);
    await expect(readFontTables(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).rejects.toThrow(
      /Not a TrueType/,
    );
  });

  it('plain TrueType input is read too (round trip through writeSfnt)', async () => {
    const font = await load('caladea-latin-400');
    const tables = await readFontTables(writeSfnt(font.tables));
    expect(parseFont(tables).numGlyphs).toBe(font.numGlyphs);
    expect(parseFont(tables).cmap.get(65)).toBe(font.cmap.get(65));
  });
});
