import { PDFDocument, type PDFFont, type PDFPage, rgb } from 'pdf-lib';
import { parseHex } from '@/engine';
import { type FontKey, fontChains } from './fontFiles';
import {
  AMOUNT_COL_W,
  COL_GAP,
  DESC_W,
  fitText,
  LINE_H,
  MARGIN_X,
  NOTES_LINE_H,
  PDF_H,
  PDF_SCALE,
  PDF_W,
  rowBaseline,
  rowBottom,
  SIZE_FOOTER,
  SIZE_LINE,
  SIZE_META,
  SIZE_NOTEBOOK,
  SIZE_NOTES,
  SIZE_TITLE,
  SLIP_W,
  wrapNotes,
  Y_FOOTER,
  Y_META,
  Y_NOTEBOOK,
  Y_NOTES,
  Y_TITLE,
} from './layout';
import type { SlipModel } from './model';
import { miniFontkit, type ParsedFont, parseFont, readFontTables, subsetFont } from './ttf';

export type LoadFont = (key: FontKey) => Promise<Uint8Array>;

const colour = (hex: string) => {
  const [r, g, b] = parseHex(hex);
  return rgb(r / 255, g / 255, b / 255);
};

interface Run {
  key: FontKey;
  text: string;
}

/**
 * A fallback chain of fonts: characters go to the first font that has them; a character no
 * font has becomes "?" (a safeguard; the English-only rule means it does not happen, TXT-07).
 */
class Chain {
  /** The font that draws the "?" for a character nobody has (the chain's first font). */
  private readonly fallback: FontKey;

  constructor(
    private readonly keys: FontKey[],
    private readonly parsed: Map<FontKey, ParsedFont>,
    private readonly embedded: Map<FontKey, PDFFont>,
  ) {
    this.fallback = keys[0] ?? 'work-sans-latin-400';
  }

  runs(text: string): Run[] {
    const runs: Run[] = [];
    for (const ch of text) {
      const cp = ch.codePointAt(0) as number;
      const key = this.keys.find((k) => this.parsed.get(k)?.cmap.has(cp));
      const use = key ?? this.fallback;
      const piece = key ? ch : '?';
      const last = runs.at(-1);
      if (last?.key === use) last.text += piece;
      else runs.push({ key: use, text: piece });
    }
    return runs;
  }

  private font(key: FontKey): PDFFont {
    return this.embedded.get(key) as PDFFont;
  }

  width(text: string, size: number): number {
    return this.runs(text).reduce(
      (w, r) => w + this.font(r.key).widthOfTextAtSize(r.text, size),
      0,
    );
  }

  draw(page: PDFPage, text: string, x: number, y: number, size: number, hex: string): void {
    let cx = x;
    for (const r of this.runs(text)) {
      const font = this.font(r.key);
      page.drawText(r.text, { x: cx, y, size, font, color: colour(hex) });
      cx += font.widthOfTextAtSize(r.text, size);
    }
  }
}

/** Slip coordinates (1080 × 1350, y down) → PDF points (y up). */
const px = (x: number) => x * PDF_SCALE;
const py = (y: number) => PDF_H - y * PDF_SCALE;
const ps = (size: number) => size * PDF_SCALE;

/** Every string a page can draw, plus the ellipsis and "?" that fitting and fallback add. */
function allStrings(model: SlipModel): string[] {
  return [
    model.notebookName,
    model.pageTitle,
    `${model.dateDisplay} · ${model.pageLabel} · ${model.statusLabel}`,
    ...model.notes,
    'Brought forward',
    'Total',
    model.broughtForward,
    model.total,
    model.footer,
    ...model.lines.flatMap((l) => [l.description, l.amount]),
    '…?',
  ];
}

/**
 * P5.5 (decided 22/11/2026): the slip as real, selectable text with the bundled fonts
 * embedded (as TrueType subsets made by ./ttf, glyph IDs unchanged). Same model and layout
 * constants as the canvas renderer.
 */
export async function renderSlipPdf(model: SlipModel, load: LoadFont): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(miniFontkit as never);
  doc.setTitle(`${model.notebookName} – ${model.pageTitle}`);
  doc.setSubject(`${model.pageLabel}, ${model.dateDisplay}`);
  doc.setCreator('Note-Add');
  doc.setProducer('Note-Add');

  const chains = fontChains(model.fontId);
  const keys = [...new Set([...chains.body, ...chains.bold, ...chains.ui, ...chains.uiBold])];
  const parsed = new Map<FontKey, ParsedFont>(
    await Promise.all(
      keys.map(async (k) => [k, parseFont(await readFontTables(await load(k)))] as const),
    ),
  );

  // Which characters does each font draw? Subset each used font once, then embed it.
  const strings = allStrings(model);
  const usage = new Map<FontKey, Set<number>>();
  for (const list of [chains.body, chains.bold, chains.ui, chains.uiBold]) {
    const probe = new Chain(list, parsed, new Map());
    for (const s of strings) {
      for (const run of probe.runs(s)) {
        const set = usage.get(run.key) ?? new Set<number>();
        for (const ch of run.text) set.add(ch.codePointAt(0) as number);
        usage.set(run.key, set);
      }
    }
  }
  const embedded = new Map<FontKey, PDFFont>();
  for (const [key, codePoints] of usage) {
    const font = parsed.get(key) as ParsedFont;
    embedded.set(key, await doc.embedFont(subsetFont(font, codePoints)));
  }
  const body = new Chain(chains.body, parsed, embedded);
  const bold = new Chain(chains.bold, parsed, embedded);
  const ui = new Chain(chains.ui, parsed, embedded);
  const uiBold = new Chain(chains.uiBold, parsed, embedded);

  const page = doc.addPage([PDF_W, PDF_H]);
  page.drawRectangle({ x: 0, y: 0, width: PDF_W, height: PDF_H, color: colour(model.paper) });

  const left = MARGIN_X;
  const right = SLIP_W - MARGIN_X;
  const text = (c: Chain, s: string, x: number, y: number, size: number, hex: string) =>
    c.draw(page, s, px(x), py(y), ps(size), hex);
  // Measure in slip units so the ellipsis rule matches the canvas renderer.
  const measure = (c: Chain, size: number) => (t: string) => c.width(t, ps(size)) / PDF_SCALE;
  const fitted = (c: Chain, s: string, max: number, size: number) =>
    fitText(s, max, measure(c, size));
  const rightAligned = (c: Chain, s: string, y: number, size: number, hex: string) =>
    text(c, s, right - measure(c, size)(s), y, size, hex);
  const rule = (y: number, hex: string, thickness = 2) =>
    page.drawLine({
      start: { x: px(left), y: py(y) },
      end: { x: px(right), y: py(y) },
      thickness: ps(thickness),
      color: colour(hex),
    });

  // Header
  text(
    ui,
    fitted(ui, model.notebookName, right - left, SIZE_NOTEBOOK),
    left,
    Y_NOTEBOOK,
    SIZE_NOTEBOOK,
    model.ink2,
  );
  text(
    uiBold,
    fitted(uiBold, model.pageTitle, right - left, SIZE_TITLE),
    left,
    Y_TITLE,
    SIZE_TITLE,
    model.ink,
  );
  text(
    ui,
    `${model.dateDisplay} · ${model.pageLabel} · ${model.statusLabel}`,
    left,
    Y_META,
    SIZE_META,
    model.ink2,
  );
  wrapNotes(model.notes, right - left, measure(ui, SIZE_NOTES)).forEach((line, k) =>
    text(ui, line, left, Y_NOTES + k * NOTES_LINE_H, SIZE_NOTES, model.ink2),
  );

  // Brought forward, ten lines, total
  text(bold, 'Brought forward', left, rowBaseline(0), SIZE_LINE, model.ink);
  rightAligned(body, model.broughtForward, rowBaseline(0), SIZE_LINE, model.ink);
  rule(rowBottom(0), model.rule);
  for (const [i, line] of model.lines.entries()) {
    const y = rowBaseline(i + 1);
    if (line.description) {
      text(body, fitted(body, line.description, DESC_W, SIZE_LINE), left, y, SIZE_LINE, model.ink);
    }
    if (line.amount) {
      rightAligned(
        body,
        fitted(body, line.amount, AMOUNT_COL_W, SIZE_LINE),
        y,
        SIZE_LINE,
        model.ink,
      );
      if (line.flagged) {
        page.drawCircle({
          x: px(right - AMOUNT_COL_W - COL_GAP / 2),
          y: py(y - SIZE_LINE / 3),
          size: ps(5),
          color: colour(model.ink2),
        });
      }
    }
    rule(rowBottom(i + 1), model.rule);
  }
  const totalY = rowBaseline(model.lines.length + 1);
  rule(totalY - LINE_H + 12, model.ink2, 3);
  text(bold, 'Total', left, totalY, SIZE_LINE, model.ink);
  rightAligned(bold, model.total, totalY, SIZE_LINE, model.ink);

  // Footer
  const fw = measure(ui, SIZE_FOOTER)(model.footer);
  text(ui, model.footer, (SLIP_W - fw) / 2, Y_FOOTER, SIZE_FOOTER, model.ink2);

  return doc.save({ useObjectStreams: false });
}
