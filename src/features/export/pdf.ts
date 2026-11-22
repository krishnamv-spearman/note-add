// fontkit's Indic shaper (Hindi in PDFs, EXP-12) expects a global regeneratorRuntime.
import 'regenerator-runtime/runtime';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, type PDFFont, type PDFPage, rgb } from 'pdf-lib';
import { parseHex } from '@/engine';
import { type FontChains, type FontKey, fontChains } from './fontFiles';
import {
  AMOUNT_COL_W,
  COL_GAP,
  DESC_W,
  fitText,
  LINE_H,
  MARGIN_X,
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
  Y_FOOTER,
  Y_META,
  Y_NOTEBOOK,
  Y_NOTES,
  NOTES_LINE_H,
  wrapNotes,
  Y_TITLE,
} from './layout';
import type { SlipModel } from './model';

export type LoadFont = (key: FontKey) => Promise<Uint8Array>;

interface ChainFont {
  key: FontKey;
  has: (codePoint: number) => boolean;
  embedded: PDFFont | null;
  bytes: Uint8Array;
}

interface Run {
  font: ChainFont;
  text: string;
}

const colour = (hex: string) => {
  const [r, g, b] = parseHex(hex);
  return rgb(r / 255, g / 255, b / 255);
};

/**
 * A fallback chain of fonts. Characters go to the first font that has them; characters no
 * font has become "?" (EXP-12). Fonts are embedded (subset) only when a run needs them.
 */
class Chain {
  constructor(
    private readonly doc: PDFDocument,
    private readonly fonts: ChainFont[],
  ) {}

  static async create(doc: PDFDocument, keys: FontKey[], load: LoadFont): Promise<Chain> {
    const fonts = await Promise.all(
      keys.map(async (key) => {
        const bytes = await load(key);
        const fk = fontkit.create(bytes);
        return { key, bytes, embedded: null, has: (cp: number) => fk.hasGlyphForCodePoint(cp) };
      }),
    );
    return new Chain(doc, fonts);
  }

  runs(text: string): Run[] {
    const runs: Run[] = [];
    const primary = this.fonts[0] as ChainFont;
    for (const ch of text) {
      const cp = ch.codePointAt(0) as number;
      const font = this.fonts.find((f) => f.has(cp));
      const piece = font ? ch : '?';
      const use = font ?? primary;
      const last = runs.at(-1);
      if (last?.font === use) last.text += piece;
      else runs.push({ font: use, text: piece });
    }
    return runs;
  }

  async embed(runs: Run[]): Promise<void> {
    for (const r of runs) {
      r.font.embedded ??= await this.doc.embedFont(r.font.bytes, { subset: true });
    }
  }

  async width(text: string, size: number): Promise<number> {
    const runs = this.runs(text);
    await this.embed(runs);
    return runs.reduce(
      (w, r) => w + (r.font.embedded as PDFFont).widthOfTextAtSize(r.text, size),
      0,
    );
  }

  async draw(
    page: PDFPage,
    text: string,
    x: number,
    y: number,
    size: number,
    hex: string,
  ): Promise<number> {
    const runs = this.runs(text);
    await this.embed(runs);
    let cx = x;
    for (const r of runs) {
      const font = r.font.embedded as PDFFont;
      page.drawText(r.text, { x: cx, y, size, font, color: colour(hex) });
      cx += font.widthOfTextAtSize(r.text, size);
    }
    return cx - x;
  }
}

/** Slip coordinates (1080 × 1350, y down) → PDF points (y up). */
const px = (x: number) => x * PDF_SCALE;
const py = (y: number) => PDF_H - y * PDF_SCALE;
const ps = (size: number) => size * PDF_SCALE;

/**
 * P5.5 (decided 22/11/2026): the slip as real, selectable text with the bundled fonts
 * embedded. Same model and layout constants as the canvas renderer.
 */
export async function renderSlipPdf(model: SlipModel, load: LoadFont): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`${model.notebookName} – ${model.pageTitle}`);
  doc.setSubject(`${model.pageLabel}, ${model.dateDisplay}`);
  doc.setCreator('Note-Add');
  doc.setProducer('Note-Add');

  const chains: FontChains = fontChains(model.fontId);
  const [body, bold, ui, uiBold] = await Promise.all([
    Chain.create(doc, chains.body, load),
    Chain.create(doc, chains.bold, load),
    Chain.create(doc, chains.ui, load),
    Chain.create(doc, chains.uiBold, load),
  ]);

  const page = doc.addPage([PDF_W, PDF_H]);
  page.drawRectangle({ x: 0, y: 0, width: PDF_W, height: PDF_H, color: colour(model.paper) });

  const left = MARGIN_X;
  const right = SLIP_W - MARGIN_X;
  const text = (c: Chain, s: string, x: number, y: number, size: number, hex: string) =>
    c.draw(page, s, px(x), py(y), ps(size), hex);
  const fitted = async (c: Chain, s: string, max: number, size: number) => {
    // Measure in slip units so the ellipsis rule matches the canvas renderer.
    const widths = new Map<string, number>();
    const measure = (t: string) => widths.get(t) ?? 0;
    const candidates = [s, ...[...s].map((_, i) => [...s].slice(0, i).join('').trimEnd() + '…')];
    for (const t of candidates) widths.set(t, (await c.width(t, ps(size))) / PDF_SCALE);
    return fitText(s, max, measure);
  };
  const rightAligned = async (c: Chain, s: string, y: number, size: number, hex: string) => {
    const w = (await c.width(s, ps(size))) / PDF_SCALE;
    await text(c, s, right - w, y, size, hex);
  };
  const rule = (y: number, hex: string, thickness = 2) =>
    page.drawLine({
      start: { x: px(left), y: py(y) },
      end: { x: px(right), y: py(y) },
      thickness: ps(thickness),
      color: colour(hex),
    });

  // Header
  await text(
    ui,
    await fitted(ui, model.notebookName, right - left, SIZE_NOTEBOOK),
    left,
    Y_NOTEBOOK,
    SIZE_NOTEBOOK,
    model.ink2,
  );
  await text(
    uiBold,
    await fitted(uiBold, model.pageTitle, right - left, SIZE_TITLE),
    left,
    Y_TITLE,
    SIZE_TITLE,
    model.ink,
  );
  await text(
    ui,
    `${model.dateDisplay} · ${model.pageLabel} · ${model.statusLabel}`,
    left,
    Y_META,
    SIZE_META,
    model.ink2,
  );
  if (model.notes.length > 0) {
    const size = ps(SIZE_NOTES);
    const widths = new Map<string, number>();
    const all = model.notes.join(' · ');
    const candidates = new Set<string>();
    for (let a = 0; a < model.notes.length; a++) {
      for (let b = a + 1; b <= model.notes.length; b++)
        candidates.add(model.notes.slice(a, b).join(' · '));
    }
    for (const c of [...candidates]) {
      for (let k = 0; k <= [...c].length; k++)
        candidates.add([...c].slice(0, k).join('').trimEnd() + '…');
    }
    candidates.add(all);
    for (const c of candidates) widths.set(c, (await ui.width(c, size)) / PDF_SCALE);
    const lines = wrapNotes(model.notes, right - left, (t) => widths.get(t) ?? 0);
    for (const [k, line] of lines.entries()) {
      await text(ui, line, left, Y_NOTES + k * NOTES_LINE_H, SIZE_NOTES, model.ink2);
    }
  }

  // Brought forward, ten lines, total
  await text(bold, 'Brought forward', left, rowBaseline(0), SIZE_LINE, model.ink);
  await rightAligned(body, model.broughtForward, rowBaseline(0), SIZE_LINE, model.ink);
  rule(rowBottom(0), model.rule);
  for (const [i, line] of model.lines.entries()) {
    const y = rowBaseline(i + 1);
    if (line.description) {
      await text(
        body,
        await fitted(body, line.description, DESC_W, SIZE_LINE),
        left,
        y,
        SIZE_LINE,
        model.ink,
      );
    }
    if (line.amount) {
      const amount = await fitted(body, line.amount, AMOUNT_COL_W, SIZE_LINE);
      await rightAligned(body, amount, y, SIZE_LINE, model.ink);
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
  await text(bold, 'Total', left, totalY, SIZE_LINE, model.ink);
  await rightAligned(bold, model.total, totalY, SIZE_LINE, model.ink);

  // Footer
  const fw = (await ui.width(model.footer, ps(SIZE_FOOTER))) / PDF_SCALE;
  await text(ui, model.footer, (SLIP_W - fw) / 2, Y_FOOTER, SIZE_FOOTER, model.ink2);

  return doc.save({ useObjectStreams: false });
}
