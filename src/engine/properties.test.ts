/**
 * Property tests (test-plan §4.5). Each compares the engine with an independent reference
 * written here using BigInt and plain loops, sharing no code with the engine.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { type ChainInput, recalculateChain, renumber } from './chain';
import { formatPaise, parseAmount } from './money';
import { LINES_PER_PAGE, pageSum } from './page';
import { asPaise, type Line, MAX_PAISE, MIN_PAISE, type Paise } from './types';

const TODAY = '2026-11-22';
const MAX = BigInt(MAX_PAISE);
const MIN = BigInt(MIN_PAISE);

const anyPaise = (min = MIN, max = MAX) => fc.bigInt({ min, max }).map((b) => asPaise(Number(b)));
const lineOf = (p: Paise | null): Line => ({
  description: '',
  amountText: p === null ? '' : formatPaise(p),
  amountPaise: p,
});
const linesArb = (amount: fc.Arbitrary<Paise>) =>
  fc
    .array(fc.option(amount, { nil: null }), {
      minLength: LINES_PER_PAGE,
      maxLength: LINES_PER_PAGE,
    })
    .map((xs) => xs.map(lineOf));

const parsed = (text: string): number => {
  const r = parseAmount(text);
  if (r.kind !== 'ok') throw new Error(`did not parse: ${text}`);
  return r.paise;
};

/** Independent reference chain: BigInt, plain loop. */
function referenceChain(pages: readonly (readonly Line[])[]): { bf: bigint; total: bigint }[] {
  const out: { bf: bigint; total: bigint }[] = [];
  let bf = 0n;
  for (const lines of pages) {
    let total = bf;
    for (const l of lines) total += BigInt(l.amountPaise ?? 0);
    out.push({ bf, total });
    bf = total;
  }
  return out;
}

const toChain = (pages: readonly (readonly Line[])[]): ChainInput[] =>
  pages.map((lines, i) => ({
    id: `p${i}`,
    number: i + 1,
    status: i % 3 === 2 ? 'final' : 'draft',
    lines,
    broughtForwardPaise: asPaise(0),
    totalPaise: asPaise(0),
    totalUpdatedOn: null,
  }));

describe('properties', () => {
  it('MON-32: parseAmount(formatPaise(x)) === x, both styles', () => {
    fc.assert(
      fc.property(anyPaise(), (x) => {
        expect(parsed(formatPaise(x))).toBe(x);
        expect(parsed(formatPaise(x, { style: 'minus' }))).toBe(x);
      }),
    );
  });

  it('FMT-04: brackets style never has "-"; minus style never has "("', () => {
    fc.assert(
      fc.property(anyPaise(), (x) => {
        expect(formatPaise(x)).not.toContain('-');
        expect(formatPaise(x, { style: 'minus' })).not.toContain('(');
      }),
    );
  });

  it('TOT-07: pageSum equals a BigInt reference sum (near-limit values)', () => {
    fc.assert(
      fc.property(linesArb(anyPaise()), (lines) => {
        const ref = lines.reduce((s, l) => s + BigInt(l.amountPaise ?? 0), 0n);
        expect(BigInt(pageSum(lines))).toBe(ref);
      }),
    );
  });

  it('RND-03: awkward values sum exactly', () => {
    const tenPaise = Array.from({ length: 10 }, () => parsed('0.10'));
    expect(tenPaise.reduce((a, b) => a + b, 0)).toBe(100);
    const pages = Array.from({ length: 100 }, () =>
      Array.from({ length: LINES_PER_PAGE }, () => lineOf(asPaise(parsed('0.01')))),
    );
    const r = recalculateChain(toChain(pages), TODAY);
    expect(r.pages.at(-1)?.totalPaise).toBe(1000);
  });

  it('RND-04: displayed line amounts (parsed back) + BF equal the displayed total', () => {
    const small = anyPaise(-1_000_000_000n, 1_000_000_000n);
    fc.assert(
      fc.property(small, linesArb(small), (bf, lines) => {
        const r = recalculateChain(
          [
            { ...toChain([[lineOf(bf)]])[0]!, lines: [lineOf(bf)] },
            { ...toChain([lines])[0]!, id: 'x', number: 2 },
          ],
          TODAY,
        );
        const page = r.pages[1]!;
        const shown = page.lines.map((l) =>
          l.amountPaise === null ? 0 : parsed(formatPaise(l.amountPaise)),
        );
        const sum = shown.reduce((a, b) => a + b, parsed(formatPaise(page.broughtForwardPaise)));
        expect(sum).toBe(parsed(formatPaise(page.totalPaise)));
      }),
    );
  });

  it('RND-05: page N brought-forward string equals page N−1 total string (1–300 pages)', () => {
    fc.assert(
      fc.property(
        fc.array(linesArb(anyPaise(-10_000_000n, 10_000_000n)), { minLength: 1, maxLength: 300 }),
        (pages) => {
          const r = recalculateChain(toChain(pages), TODAY);
          for (let i = 1; i < r.pages.length; i++) {
            expect(formatPaise(r.pages[i]!.broughtForwardPaise)).toBe(
              formatPaise(r.pages[i - 1]!.totalPaise),
            );
          }
        },
      ),
      { numRuns: Math.max(10, Math.floor(fc.readConfigureGlobal().numRuns! / 5)) },
    );
  });

  type Op =
    | { kind: 'edit'; page: number; line: number; amount: Paise | null }
    | { kind: 'append' }
    | { kind: 'delete'; page: number };

  const opArb: fc.Arbitrary<Op> = fc.oneof(
    fc.record({
      kind: fc.constant('edit' as const),
      page: fc.nat(),
      line: fc.nat({ max: LINES_PER_PAGE - 1 }),
      amount: fc.option(anyPaise(-100_000_000n, 100_000_000n), { nil: null }),
    }),
    fc.constant({ kind: 'append' as const }),
    fc.record({ kind: fc.constant('delete' as const), page: fc.nat() }),
  );

  it('CHN-19: recalculateChain equals the reference after any edits, appends and deletes', () => {
    fc.assert(
      fc.property(
        fc.array(linesArb(anyPaise(-100_000_000n, 100_000_000n)), { minLength: 1, maxLength: 30 }),
        fc.array(opArb, { maxLength: 40 }),
        (initial, ops) => {
          let chain = recalculateChain(toChain(initial), TODAY).pages;
          let nextId = initial.length;
          for (const op of ops) {
            let next = [...chain];
            if (op.kind === 'append') {
              next.push({
                ...toChain([Array.from({ length: LINES_PER_PAGE }, () => lineOf(null))])[0]!,
                id: `p${nextId++}`,
                number: next.length + 1,
              });
            } else if (op.kind === 'delete' && next.length > 1) {
              next.splice(op.page % next.length, 1);
            } else if (op.kind === 'edit') {
              const i = op.page % next.length;
              const page = next[i]!;
              next[i] = {
                ...page,
                lines: page.lines.map((l, j) => (j === op.line ? lineOf(op.amount) : l)),
              };
            }
            next = renumber(next);
            const r = recalculateChain(next, TODAY);
            expect(r.error).toBeUndefined();
            const ref = referenceChain(next.map((p) => p.lines));
            r.pages.forEach((p, i) => {
              expect(p.number).toBe(i + 1);
              expect(BigInt(p.broughtForwardPaise)).toBe(ref[i]!.bf);
              expect(BigInt(p.totalPaise)).toBe(ref[i]!.total);
            });
            chain = r.pages;
          }
        },
      ),
      { numRuns: Math.max(10, Math.floor(fc.readConfigureGlobal().numRuns! / 2)) },
    );
  });

  it('CHN-03 / TOT-04: any out-of-range total is reported at the first such page and changes nothing', () => {
    const big = anyPaise(MAX / 3n, MAX);
    fc.assert(
      fc.property(
        fc.array(
          linesArb(
            fc.oneof(
              big,
              big.map((x) => asPaise(-1 * x)),
            ),
          ),
          { minLength: 1, maxLength: 8 },
        ),
        (pages) => {
          const input = toChain(pages);
          const r = recalculateChain(input, TODAY);
          const ref = referenceChain(pages);
          const firstBad = ref.findIndex((x) => x.total > MAX || x.total < MIN);
          if (firstBad === -1) {
            expect(r.error).toBeUndefined();
          } else {
            expect(r.error).toEqual({ kind: 'over-limit', pageNumber: firstBad + 1 });
            expect(r.changedIds).toEqual([]);
            r.pages.forEach((p, i) => expect(p).toBe(input[i]));
          }
        },
      ),
    );
  });
});
