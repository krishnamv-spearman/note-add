/**
 * P5.1: export layout in logical pixels of a 1080 × 1350 portrait slip (4:5). The canvas
 * renderer draws at these numbers; the PDF renderer scales them to a 108 × 135 mm page.
 * The on-screen slip uses the same proportions (amount column ≈ 40% of the content width).
 */
export const SLIP_W = 1080;
export const SLIP_H = 1350;
export const MARGIN_X = 72;
export const CONTENT_W = SLIP_W - 2 * MARGIN_X;
export const AMOUNT_COL_W = 380; // ≈ 40% of CONTENT_W, like the editor's amount column
export const COL_GAP = 24;
export const DESC_W = CONTENT_W - AMOUNT_COL_W - COL_GAP;

export const Y_NOTEBOOK = 96;
export const Y_TITLE = 160;
export const Y_META = 208;
export const Y_NOTES = 240;
export const NOTES_LINE_H = 28;
export const Y_BF = 330; // baseline of the brought-forward row
export const LINE_H = 78; // row pitch; ruled line under each row
export const ROWS_TOP = 290; // top of the first ruled row (BF row)
export const Y_FOOTER = SLIP_H - 56;

export const SIZE_NOTEBOOK = 30;
export const SIZE_TITLE = 46;
export const SIZE_META = 26;
export const SIZE_NOTES = 22;
export const SIZE_LINE = 36;
export const SIZE_FOOTER = 24;

/** Baseline of row i (0 = brought forward, 1..10 = lines, 11 = total). */
export const rowBaseline = (i: number): number => Y_BF + i * LINE_H;
/** Bottom of row i, where its ruled line is drawn. */
export const rowBottom = (i: number): number => ROWS_TOP + (i + 1) * LINE_H;

/** PDF page: 108 × 135 mm in points (1 mm = 72 / 25.4 pt). */
export const PDF_W = (108 * 72) / 25.4;
export const PDF_H = (135 * 72) / 25.4;
export const PDF_SCALE = PDF_W / SLIP_W;

export const ELLIPSIS = '…';

/** EXP-05: notes joined with " · ", wrapped onto at most two lines (the second is fitted). */
export function wrapNotes(
  notes: readonly string[],
  maxWidth: number,
  measure: (s: string) => number,
): string[] {
  const lines: string[] = [];
  let current = '';
  for (const note of notes) {
    const next = current ? `${current} · ${note}` : note;
    if (current && measure(next) > maxWidth && lines.length === 0) {
      lines.push(current);
      current = note;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2).map((l) => fitText(l, maxWidth, measure));
}

/**
 * EXP-02: cut text with an ellipsis so it fits, the same rule for canvas and PDF.
 * `measure` returns the width of a string in the renderer's units.
 */
export function fitText(text: string, maxWidth: number, measure: (s: string) => number): string {
  if (measure(text) <= maxWidth) return text;
  const chars = [...text];
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(chars.slice(0, mid).join('').trimEnd() + ELLIPSIS) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo === 0 ? ELLIPSIS : chars.slice(0, lo).join('').trimEnd() + ELLIPSIS;
}
