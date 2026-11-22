import { describe, expect, it } from 'vitest';
import { linesOf } from '../../../tests/builders';
import { asPaise } from '@/engine';
import type { Notebook, Page } from '@/db';
import { ELLIPSIS, fitText, wrapNotes } from './layout';
import { buildSlipModel, exportFileName, FOOTER, type SlipModel } from './model';

const notebook: Notebook = {
  id: 'n',
  name: 'Pune trip claims',
  colour: 'lavender',
  createdAt: 0,
  updatedAt: 0,
};
const page = (extra: Partial<Page> = {}): Page => ({
  id: 'p',
  notebookId: 'n',
  number: 3,
  date: '2026-11-20',
  title: null,
  colour: null,
  lines: linesOf(['1,00,000', '-300', 'abc', ''], ['Hotel', 'Refund', 'Snacks', 'Tip']),
  status: 'draft',
  finalisedOn: null,
  reopenedOn: [],
  totalUpdatedOn: null,
  broughtForwardPaise: asPaise(-5),
  totalPaise: asPaise(9969995),
  createdAt: 0,
  updatedAt: 0,
  ...extra,
});

describe('buildSlipModel', () => {
  it('P5.2: engine formatting — brackets, Indian grouping, "Page N", flags, Draft', () => {
    const m = buildSlipModel(page(), notebook, 7, 'atkinson');
    expect(m).toMatchObject({
      notebookName: 'Pune trip claims',
      pageTitle: 'Page 3',
      dateDisplay: '20/11/2026',
      fileDate: '20-11-2026',
      pageLabel: 'Page 3 of 7',
      statusLabel: 'Draft',
      notes: [],
      broughtForward: '(0.05)',
      total: '99,699.95',
      fontId: 'atkinson',
      footer: FOOTER,
    });
    expect(m.lines.slice(0, 4)).toEqual([
      { description: 'Hotel', amount: '1,00,000.00', flagged: false },
      { description: 'Refund', amount: '(300.00)', flagged: false },
      { description: 'Snacks', amount: 'abc', flagged: true },
      { description: 'Tip', amount: '', flagged: false },
    ]);
    expect(m.lines).toHaveLength(10);
  });

  it('EXP-06: effective colour (page override, else notebook)', () => {
    expect(buildSlipModel(page(), notebook, 1, 'carlito').paper).toBe('#E6DDF7');
    expect(buildSlipModel(page({ colour: 'mint' }), notebook, 1, 'carlito').paper).toBe('#D8F3DC');
  });

  it('EXP-04 / EXP-05 / LIF-15: Final label and notes', () => {
    const m = buildSlipModel(
      page({
        status: 'final',
        finalisedOn: '2026-11-21',
        reopenedOn: ['2026-11-19', '2026-11-20'],
        totalUpdatedOn: '2026-11-22',
        title: 'Hotel',
      }),
      notebook,
      3,
      'carlito',
    );
    expect(m.statusLabel).toBe('Final');
    expect(m.pageTitle).toBe('Hotel');
    expect(m.notes).toEqual([
      'Final since 21/11/2026',
      'Reopened on 20/11/2026',
      'Total updated from earlier page on 22/11/2026',
    ]);
  });
});

describe('file names (P5.6)', () => {
  const model = (notebookName: string, pageTitle: string) =>
    ({ notebookName, pageTitle, fileDate: '20-11-2026' }) as SlipModel;

  it('FN-01: <notebook>-<page title>-<DD-MM-YYYY>.ext; default title', () => {
    expect(exportFileName(model('Pune trip claims', 'Page 3'), 'pdf')).toBe(
      'Pune trip claims-Page 3-20-11-2026.pdf',
    );
    expect(exportFileName(model('Trip', 'Airport'), 'jpg')).toBe('Trip-Airport-20-11-2026.jpg');
  });

  it('NB-04: unsafe characters become "-"; emoji and spaces are kept', () => {
    expect(exportFileName(model('a/b\\c:d*e?f"g<h>i|j', 'Taxi 🚕'), 'pdf')).toBe(
      'a-b-c-d-e-f-g-h-i-j-Taxi 🚕-20-11-2026.pdf',
    );
  });

  it('FN-02: only unsafe characters → note-add-page-<date>', () => {
    expect(exportFileName(model('///', '???'), 'pdf')).toBe('note-add-page-20-11-2026.pdf');
  });

  it('FN-03: Windows reserved names and trailing dots or spaces', () => {
    expect(
      exportFileName({ notebookName: '', pageTitle: '', fileDate: '' } as SlipModel, 'pdf'),
    ).toBe('note-add-page-.pdf');
    const reserved = exportFileName(model('CON', ''), 'pdf');
    expect(reserved).toBe('CON-20-11-2026.pdf'); // not a reserved base name
    expect(
      exportFileName({ notebookName: 'nul', pageTitle: '', fileDate: '' } as SlipModel, 'pdf'),
    ).toBe('nul-.pdf'); // valid on Windows: only a whole base name like "NUL" is reserved
    const long = exportFileName(model('x'.repeat(95) + '. ', 'y'), 'pdf');
    expect(long.endsWith('.pdf')).toBe(true);
    expect(long).not.toMatch(/[ .]\.pdf$/);
  });

  it('FN-04: capped at 100 characters, extension kept', () => {
    const name = exportFileName(model('n'.repeat(80), 't'.repeat(80)), 'jpg');
    expect(name).toHaveLength(100);
    expect(name.endsWith('.jpg')).toBe(true);
  });
});

describe('text fitting', () => {
  const measure = (s: string) => [...s].length; // one unit per character

  it('EXP-02: cuts with an ellipsis only when needed', () => {
    expect(fitText('short', 10, measure)).toBe('short');
    expect(fitText('a long description', 10, measure)).toBe(`a long de${ELLIPSIS}`);
    expect(fitText('abc', 0, measure)).toBe(ELLIPSIS);
  });

  it('EXP-05: wraps notes onto two lines', () => {
    expect(wrapNotes(['aaaa', 'bbbb'], 20, measure)).toEqual(['aaaa · bbbb']);
    expect(wrapNotes(['aaaa', 'bbbb', 'cccc'], 12, measure)).toEqual(['aaaa · bbbb', 'cccc']);
    expect(wrapNotes([], 10, measure)).toEqual([]);
  });
});
