import { describe, expect, it } from 'vitest';
import { aChain, aLine, aPage, linesOf } from '../../tests/builders';
import { chainErrorMessage, type ChainInput, recalculateChain, renumber } from './chain';
import { formatPaise } from './money';
import { asPaise, MAX_PAISE } from './types';

const TODAY = '2026-11-22';
const LATER = '2026-11-25';

/**
 * Recalculate so cached values are current, as they are in a real notebook. Statuses are
 * applied afterwards: a page is finalised only after its totals exist, so settling the
 * builder's stale zero totals must not count as "updated from an earlier page".
 */
const settled = (pages: ChainInput[]): ChainInput[] =>
  recalculateChain(
    pages.map((p) => ({ ...p, status: 'draft' as const })),
    TODAY,
  ).pages.map((p, i) => ({
    ...p,
    status: pages[i]!.status,
    totalUpdatedOn: pages[i]!.totalUpdatedOn,
  }));

function withLine(page: ChainInput, index: number, amountText: string): ChainInput {
  const lines = page.lines.map((l, i) => (i === index ? aLine(amountText, l.description) : l));
  return { ...page, lines };
}

function expectConsistent(pages: ChainInput[]): void {
  let bf = 0;
  for (const p of pages) {
    expect(p.broughtForwardPaise).toBe(bf);
    const sum = p.lines.reduce((s, l) => s + (l.amountPaise ?? 0), 0);
    expect(p.totalPaise).toBe(bf + sum);
    bf = p.totalPaise;
  }
}

describe('recalculateChain', () => {
  it('CHN-01: one page; brought forward 0; total = page sum', () => {
    const r = recalculateChain([aPage(1, { amounts: ['450', '50.25'] })], TODAY);
    expect(r.pages[0]?.broughtForwardPaise).toBe(0);
    expect(r.pages[0]?.totalPaise).toBe(50025);
    expect(r.changedIds).toEqual(['p1']);
    expect(r.error).toBeUndefined();
  });

  it('page N brought forward = total of page N−1', () => {
    const r = recalculateChain(aChain(3), TODAY);
    // each page adds 450 − 300 + 1280.75 = 1430.75
    expect(r.pages.map((p) => p.broughtForwardPaise)).toEqual([0, 143075, 286150]);
    expect(r.pages.map((p) => p.totalPaise)).toEqual([143075, 286150, 429225]);
  });

  it.each([50, 200, 1000])('CHN-02: edit page 1 of %d pages; every later page correct', (n) => {
    const pages = settled(aChain(n));
    expectConsistent(pages);
    const edited = [withLine(pages[0]!, 0, '1000'), ...pages.slice(1)];
    const r = recalculateChain(edited, TODAY);
    expectConsistent(r.pages);
    // 1000 − 450 = +550.00 on every page
    r.pages.forEach((p, i) => expect(p.totalPaise - pages[i]!.totalPaise).toBe(55000));
    expect(r.changedIds).toHaveLength(n);
    expect(r.pages[n - 1]!.totalPaise).toBe(n * 143075 + 55000);
  });

  it('negatives and refunds that bring a total below zero', () => {
    const r = recalculateChain(
      [aPage(1, { amounts: ['100'] }), aPage(2, { amounts: ['-250.50'] })],
      TODAY,
    );
    expect(r.pages[1]?.totalPaise).toBe(-15050);
    expect(formatPaise(r.pages[1]!.totalPaise)).toBe('(150.50)');
  });

  it('CHN-04: a Final page whose total changes gets totalUpdatedOn = today', () => {
    const pages = settled([
      aPage(1, { amounts: ['100'] }),
      aPage(2, { amounts: ['5'], status: 'final' }),
    ]);
    expect(pages[1]?.totalUpdatedOn).toBeNull();
    const r = recalculateChain([withLine(pages[0]!, 0, '200'), pages[1]!], LATER);
    expect(r.pages[1]?.totalUpdatedOn).toBe(LATER);
    expect(r.pages[1]?.totalPaise).toBe(20500);
  });

  it('CHN-04: a Final page whose total does not change keeps its old value', () => {
    const pages = settled([
      aPage(1, { amounts: ['100'] }),
      { ...aPage(2, { amounts: ['5'], status: 'final' }), totalUpdatedOn: '2026-01-01' },
    ]);
    const r = recalculateChain([withLine(pages[0]!, 0, '100.00'), pages[1]!], LATER);
    expect(r.pages[1]?.totalUpdatedOn).toBe('2026-01-01');
    expect(r.changedIds).toEqual([]);
  });

  it('CHN-05: total changes then changes back: note stays, with the latest date', () => {
    const p = settled([
      aPage(1, { amounts: ['100'] }),
      aPage(2, { amounts: ['5'], status: 'final' }),
    ]);
    const once = recalculateChain([withLine(p[0]!, 0, '200'), p[1]!], '2026-11-23').pages;
    const back = recalculateChain([withLine(once[0]!, 0, '100'), once[1]!], LATER).pages;
    expect(back[1]?.totalPaise).toBe(10500);
    expect(back[1]?.totalUpdatedOn).toBe(LATER);
  });

  it('a Draft page never gets totalUpdatedOn', () => {
    const p = settled([aPage(1, { amounts: ['100'] }), aPage(2, { amounts: ['5'] })]);
    const r = recalculateChain([withLine(p[0]!, 0, '200'), p[1]!], LATER);
    expect(r.pages[1]?.totalUpdatedOn).toBeNull();
  });

  it('CHN-06: a description edit changes no cached value', () => {
    const p = settled(aChain(5));
    const lines = p[0]!.lines.map((l, i) => (i === 0 ? { ...l, description: 'Taxi' } : l));
    const r = recalculateChain([{ ...p[0]!, lines }, ...p.slice(1)], LATER);
    expect(r.changedIds).toEqual([]);
    r.pages.slice(1).forEach((page, i) => expect(page).toBe(p[i + 1]));
  });

  it('CHN-07: retyping 450 as 450.00 rewrites nothing and sets no note', () => {
    const p = settled([
      aPage(1, { amounts: ['450'] }),
      aPage(2, { amounts: ['1'], status: 'final' }),
    ]);
    const r = recalculateChain([withLine(p[0]!, 0, '450.00'), p[1]!], LATER);
    expect(r.changedIds).toEqual([]);
    expect(r.pages[1]?.totalUpdatedOn).toBeNull();
  });

  it('changedIds lists only pages whose cached values changed', () => {
    const p = settled(aChain(4));
    const r = recalculateChain([...p.slice(0, 2), withLine(p[2]!, 0, '0'), p[3]!], TODAY);
    expect(r.changedIds).toEqual(['p3', 'p4']);
  });

  it('CHN-03: an edit on page 1 pushes page 40 over the limit: error names page 40', () => {
    const pages = settled(
      Array.from({ length: 50 }, (_, i) =>
        aPage(i + 1, { amounts: i === 39 ? ['99,99,99,999.99', '-1'] : [] }),
      ),
    );
    expectConsistent(pages);
    const r = recalculateChain([withLine(pages[0]!, 0, '1.01'), ...pages.slice(1)], TODAY);
    expect(r.error).toEqual({ kind: 'over-limit', pageNumber: 40 });
    expect(r.changedIds).toEqual([]);
    expect(r.pages[39]).toBe(pages[39]);
    expect(chainErrorMessage(r.error!)).toBe(
      'This would make the total on page 40 more than ₹99.99 crore',
    );
  });

  it('TOT-05: totals exactly at ±MAX are allowed; one paisa beyond is an error', () => {
    const at = recalculateChain([aPage(1, { amounts: ['99,99,99,999.99'] })], TODAY);
    expect(at.error).toBeUndefined();
    expect(at.pages[0]?.totalPaise).toBe(MAX_PAISE);
    const over = recalculateChain(
      [aPage(1, { amounts: ['99,99,99,999.99'] }), aPage(2, { amounts: ['0.01'] })],
      TODAY,
    );
    expect(over.error?.pageNumber).toBe(2);
    const minAt = recalculateChain([aPage(1, { amounts: ['-99,99,99,999.99'] })], TODAY);
    expect(minAt.error).toBeUndefined();
    const minOver = recalculateChain([aPage(1, { amounts: ['-99,99,99,999.99', '-0.01'] })], TODAY);
    expect(minOver.error?.pageNumber).toBe(1);
  });

  it('TOT-04: ten maximum amounts on one page are an error', () => {
    const r = recalculateChain(
      [aPage(1, { amounts: Array.from({ length: 10 }, () => '99,99,99,999.99') })],
      TODAY,
    );
    expect(r.error?.pageNumber).toBe(1);
  });

  it('CHN-12: sign flipped on page 1 → every later total drops by exactly 600.00', () => {
    const p = settled(aChain(5, ['300']));
    const r = recalculateChain([withLine(p[0]!, 0, '-300'), ...p.slice(1)], TODAY);
    r.pages.forEach((page, i) => expect(p[i]!.totalPaise - page.totalPaise).toBe(60000));
  });

  it('CHN-13: valid → invalid text counts as 0 from then on', () => {
    const p = settled(aChain(3, ['450']));
    const r = recalculateChain([withLine(p[0]!, 0, '45o'), ...p.slice(1)], TODAY);
    r.pages.forEach((page, i) => expect(p[i]!.totalPaise - page.totalPaise).toBe(45000));
    expect(r.pages[0]?.lines[0]?.amountPaise).toBeNull();
  });

  it('CHN-16: mixed Draft/Final pages: only the Final ones get the note', () => {
    const statuses = ['draft', 'draft', 'final', 'draft', 'final'] as const;
    const p = settled(statuses.map((status, i) => aPage(i + 1, { amounts: ['10'], status })));
    const r = recalculateChain([withLine(p[0]!, 0, '20'), ...p.slice(1)], LATER);
    expect(r.pages.map((x) => x.totalUpdatedOn)).toEqual([null, null, LATER, null, LATER]);
  });

  it('CHN-18: a later total becoming exactly 0 shows 0.00', () => {
    const p = settled([aPage(1, { amounts: ['100'] }), aPage(2, { amounts: ['-50'] })]);
    const r = recalculateChain([withLine(p[0]!, 0, '50'), p[1]!], TODAY);
    expect(r.pages[1]?.totalPaise).toBe(0);
    expect(formatPaise(r.pages[1]!.totalPaise)).toBe('0.00');
  });

  it('an empty notebook is fine', () => {
    expect(recalculateChain([], TODAY)).toEqual({ pages: [], changedIds: [] });
  });
});

describe('renumber', () => {
  it('P1.7: after deleting page 3 of 7, numbers are 1..6 and the chain is correct', () => {
    const p = settled(aChain(7, ['100']));
    const after = renumber([...p.slice(0, 2), ...p.slice(3)]);
    expect(after.map((x) => x.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(after.map((x) => x.id)).toEqual(['p1', 'p2', 'p4', 'p5', 'p6', 'p7']);
    const r = recalculateChain(after, TODAY);
    expectConsistent(r.pages);
    expect(r.pages[5]?.totalPaise).toBe(60000);
    expect(r.changedIds).toEqual(['p4', 'p5', 'p6', 'p7']);
  });

  it('keeps unchanged pages as the same objects', () => {
    const p = aChain(3);
    const after = renumber(p);
    after.forEach((x, i) => expect(x).toBe(p[i]));
  });

  it('LIF-06: delete page 1 → old page 2 becomes page 1 with BF 0', () => {
    const p = settled(aChain(3, ['100']));
    const r = recalculateChain(renumber(p.slice(1)), TODAY);
    expect(r.pages[0]?.id).toBe('p2');
    expect(r.pages[0]?.number).toBe(1);
    expect(r.pages[0]?.broughtForwardPaise).toBe(0);
  });

  it('CHN-17 / LIF-07: edit an early page, then delete a page; renumbered Final pages update', () => {
    const p = settled([
      aPage(1, { amounts: ['10'] }),
      aPage(2, { amounts: ['20'] }),
      aPage(3, { amounts: ['30'], status: 'final' }),
      aPage(4, { amounts: ['40'] }),
    ]);
    const edited = recalculateChain([withLine(p[0]!, 0, '15'), ...p.slice(1)], TODAY).pages;
    const r = recalculateChain(renumber([edited[0]!, ...edited.slice(2)]), LATER);
    expect(r.pages.map((x) => [x.id, x.number, x.totalPaise])).toEqual([
      ['p1', 1, 1500],
      ['p3', 2, 4500],
      ['p4', 3, 8500],
    ]);
    expect(r.pages[1]?.lines[0]?.amountText).toBe('30');
    expect(r.pages[1]?.totalUpdatedOn).toBe(LATER);
  });

  it('LIF-08: a delete that pushes a later total over the limit is reported', () => {
    const p = settled([aPage(1, { amounts: ['-1'] }), aPage(2, { amounts: ['99,99,99,999.99'] })]);
    expect(p[1]?.totalPaise).toBe(MAX_PAISE - 100);
    const big = settled([
      aPage(1, { amounts: ['-1'] }),
      aPage(2, { amounts: ['99,99,99,999.99', '0.50'] }),
    ]);
    const r = recalculateChain(renumber(big.slice(1)), TODAY);
    expect(r.error).toEqual({ kind: 'over-limit', pageNumber: 1 });
    expect(asPaise(r.pages[0]!.totalPaise)).toBe(big[1]!.totalPaise);
  });

  it('linesOf builds ten lines', () => {
    expect(linesOf(['1'])).toHaveLength(10);
  });
});
