import { CHROME_FONT, slipFont } from '@/theme/fonts';
import {
  AMOUNT_COL_W,
  COL_GAP,
  DESC_W,
  fitText,
  LINE_H,
  MARGIN_X,
  rowBaseline,
  rowBottom,
  SIZE_FOOTER,
  SIZE_LINE,
  SIZE_META,
  SIZE_NOTEBOOK,
  SIZE_NOTES,
  SIZE_TITLE,
  SLIP_H,
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

/** EXP-10: wait for the bundled fonts so the export never draws with a fallback by accident. */
export async function loadExportFonts(model: SlipModel): Promise<void> {
  const slip = slipFont(model.fontId).family;
  await Promise.all([
    document.fonts.load(`${SIZE_LINE}px "${slip}"`),
    document.fonts.load(`700 ${SIZE_LINE}px "${slip}"`),
    document.fonts.load(`${SIZE_META}px "${CHROME_FONT.family}"`),
    document.fonts.load(`600 ${SIZE_TITLE}px "${CHROME_FONT.family}"`),
  ]);
}

/**
 * P5.3: draws the slip at 1080 × 1350 logical px with Canvas 2D. Scripts the bundled fonts do
 * not cover (Hindi, emoji) use the browser's font fallback, like the screen (EXP-03).
 */
export function renderSlipCanvas(model: SlipModel, scale = 1): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SLIP_W * scale;
  canvas.height = SLIP_H * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.scale(scale, scale);

  const slip = slipFont(model.fontId).stack;
  const ui = CHROME_FONT.stack;
  const left = MARGIN_X;
  const right = SLIP_W - MARGIN_X;
  const font = (size: number, family: string, weight = 400) => {
    ctx.font = `${weight} ${size}px ${family}`;
  };
  const measure = (s: string) => ctx.measureText(s).width;
  const text = (
    s: string,
    x: number,
    y: number,
    colour: string,
    align: CanvasTextAlign = 'left',
  ) => {
    ctx.fillStyle = colour;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
  };
  const rule = (y: number, colour: string, thickness = 2) => {
    ctx.fillStyle = colour;
    ctx.fillRect(left, y - thickness / 2, right - left, thickness);
  };

  ctx.fillStyle = model.paper;
  ctx.fillRect(0, 0, SLIP_W, SLIP_H);
  ctx.textBaseline = 'alphabetic';

  font(SIZE_NOTEBOOK, ui);
  text(fitText(model.notebookName, right - left, measure), left, Y_NOTEBOOK, model.ink2);
  font(SIZE_TITLE, ui, 600);
  text(fitText(model.pageTitle, right - left, measure), left, Y_TITLE, model.ink);
  font(SIZE_META, ui);
  text(
    `${model.dateDisplay} · ${model.pageLabel} · ${model.statusLabel}`,
    left,
    Y_META,
    model.ink2,
  );
  if (model.notes.length > 0) {
    font(SIZE_NOTES, ui);
    wrapNotes(model.notes, right - left, measure).forEach((line, i) =>
      text(line, left, Y_NOTES + i * NOTES_LINE_H, model.ink2),
    );
  }

  font(SIZE_LINE, slip, 700);
  text('Brought forward', left, rowBaseline(0), model.ink);
  font(SIZE_LINE, slip);
  text(model.broughtForward, right, rowBaseline(0), model.ink, 'right');
  rule(rowBottom(0), model.rule);

  model.lines.forEach((line, i) => {
    const y = rowBaseline(i + 1);
    font(SIZE_LINE, slip);
    if (line.description) text(fitText(line.description, DESC_W, measure), left, y, model.ink);
    if (line.amount) {
      text(fitText(line.amount, AMOUNT_COL_W, measure), right, y, model.ink, 'right');
      if (line.flagged) {
        ctx.fillStyle = model.ink2;
        ctx.beginPath();
        ctx.arc(right - AMOUNT_COL_W - COL_GAP / 2, y - SIZE_LINE / 3, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    rule(rowBottom(i + 1), model.rule);
  });

  const totalY = rowBaseline(model.lines.length + 1);
  rule(totalY - LINE_H + 12, model.ink2, 3);
  font(SIZE_LINE, slip, 700);
  text('Total', left, totalY, model.ink);
  text(model.total, right, totalY, model.ink, 'right');

  font(SIZE_FOOTER, ui);
  text(model.footer, SLIP_W / 2, Y_FOOTER, model.ink2, 'center');
  return canvas;
}

/** P5.4 */
export function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('JPEG encoding failed'))),
      'image/jpeg',
      0.92,
    );
  });
}
