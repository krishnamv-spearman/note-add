import { displayTitle, formatPaise, isFlagged, toDisplay, toFileDate } from '@/engine';
import type { FontId, Notebook, Page } from '@/db';
import { INK, INK_2, slipColour } from '@/theme/colours';

export const FOOTER = 'Made with Note-Add · spearman.in';

export interface SlipLine {
  description: string;
  amount: string;
  flagged: boolean;
}

/** Everything a renderer needs, as display strings from the engine formatters (RND-07). */
export interface SlipModel {
  notebookName: string;
  pageTitle: string;
  dateDisplay: string;
  fileDate: string;
  pageLabel: string;
  /** EXP-04: "Draft" so a recipient does not mistake it for final; "Final" otherwise. */
  statusLabel: 'Draft' | 'Final';
  /** EXP-05 / LIF-15: "Reopened on …", "Total updated from earlier page on …". */
  notes: string[];
  broughtForward: string;
  lines: SlipLine[];
  total: string;
  paper: string;
  rule: string;
  ink: string;
  ink2: string;
  fontId: FontId;
  footer: string;
}

/** P5.2: pure; the same strings the editor shows. */
export function buildSlipModel(
  page: Page,
  notebook: Notebook,
  pageCount: number,
  fontId: FontId,
): SlipModel {
  const colour = slipColour(page.colour ?? notebook.colour);
  const notes: string[] = [];
  const reopened = page.reopenedOn.at(-1);
  if (page.status === 'final' && page.finalisedOn)
    notes.push(`Final since ${toDisplay(page.finalisedOn)}`);
  if (reopened) notes.push(`Reopened on ${toDisplay(reopened)}`);
  if (page.totalUpdatedOn) {
    notes.push(`Total updated from earlier page on ${toDisplay(page.totalUpdatedOn)}`);
  }
  return {
    notebookName: notebook.name,
    pageTitle: displayTitle(page),
    dateDisplay: toDisplay(page.date),
    fileDate: toFileDate(page.date),
    pageLabel: `Page ${page.number} of ${pageCount}`,
    statusLabel: page.status === 'final' ? 'Final' : 'Draft',
    notes,
    broughtForward: formatPaise(page.broughtForwardPaise),
    lines: page.lines.map((l) => ({
      description: l.description,
      amount: l.amountPaise !== null ? formatPaise(l.amountPaise) : l.amountText.trim(),
      flagged: isFlagged(l),
    })),
    total: formatPaise(page.totalPaise),
    paper: colour.paper,
    rule: colour.rule,
    ink: INK,
    ink2: INK_2,
    fontId,
    footer: FOOTER,
  };
}

// eslint-disable-next-line no-control-regex -- control characters are unsafe in file names
const UNSAFE = /[/\\:*?"<>|\u0000-\u001f\u007f]/g;
const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i;
const MAX_NAME = 100;

/**
 * P5.6: `<notebook>-<page title>-<DD-MM-YYYY>.<ext>`. Unsafe characters become "-", spaces are
 * kept, at most 100 characters including the extension (FN-01..04).
 */
export function exportFileName(model: SlipModel, ext: 'pdf' | 'jpg'): string {
  const clean = (s: string) =>
    s.replace(UNSAFE, '-').replace(/\s+/g, ' ').replace(/-{2,}/g, '-').trim();
  const meaningful = (s: string) => s.replace(/[-\s.]/g, '') !== '';
  const nb = clean(model.notebookName);
  const title = clean(model.pageTitle);
  let base =
    meaningful(nb) || meaningful(title)
      ? [nb, title].filter(meaningful).join('-') + `-${model.fileDate}`
      : `note-add-page-${model.fileDate}`; // FN-02
  base = base.slice(0, MAX_NAME - ext.length - 1).replace(/[\s.]+$/, ''); // FN-03, FN-04
  if (RESERVED.test(base)) base = `note-add-${base}`;
  return `${base}.${ext}`;
}
