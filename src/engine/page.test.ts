import { describe, expect, it } from 'vitest';
import { aLine, linesOf } from '../../tests/builders';
import {
  countFlagged,
  defaultTitle,
  displayTitle,
  emptyLine,
  emptyLines,
  isFlagged,
  isPageEmpty,
  LINES_PER_PAGE,
  pageSum,
  pageTotal,
} from './page';
import { addPaise, asPaise, isWithinLimit, MAX_PAISE, MIN_PAISE } from './types';

describe('types', () => {
  it('asPaise accepts safe integers and normalises -0', () => {
    expect(asPaise(5)).toBe(5);
    expect(Object.is(asPaise(-0), 0)).toBe(true);
  });

  it('asPaise and addPaise refuse non-integers', () => {
    expect(() => asPaise(0.1)).toThrow(RangeError);
    expect(() => asPaise(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
    expect(() => addPaise(asPaise(1), 0.5 as never)).toThrow(RangeError);
    expect(() => addPaise(0.5 as never, asPaise(1))).toThrow(RangeError);
  });

  it('TOT-05: isWithinLimit is inclusive at ±MAX', () => {
    expect(isWithinLimit(MAX_PAISE)).toBe(true);
    expect(isWithinLimit(MIN_PAISE)).toBe(true);
    expect(isWithinLimit(MAX_PAISE + 1)).toBe(false);
    expect(isWithinLimit(MIN_PAISE - 1)).toBe(false);
    expect(() => isWithinLimit(NaN)).toThrow(RangeError);
  });
});

describe('page', () => {
  it('a page has 10 empty lines', () => {
    expect(LINES_PER_PAGE).toBe(10);
    expect(emptyLines()).toHaveLength(10);
    expect(emptyLines()[0]).toEqual(emptyLine());
  });

  it('TOT-01: all lines empty → total = brought forward', () => {
    expect(pageSum(emptyLines())).toBe(0);
    expect(pageTotal(asPaise(12345), emptyLines())).toBe(12345);
  });

  it('TOT-02: invalid and empty count as 0; only invalid ones are flagged', () => {
    const lines = linesOf(['450', '', 'abc', '-300', '12a']);
    expect(pageSum(lines)).toBe(15000);
    expect(lines.map(isFlagged).slice(0, 5)).toEqual([false, false, true, false, true]);
    expect(countFlagged(lines)).toBe(2);
  });

  it('TOT-03: description without amount and amount without description are not flagged', () => {
    expect(isFlagged(aLine('', 'Taxi'))).toBe(false);
    expect(isFlagged(aLine('450', ''))).toBe(false);
    expect(isFlagged(aLine('   ', 'Taxi'))).toBe(false);
  });

  it('TOT-04: each amount within the limit but the page total over it', () => {
    const lines = linesOf(Array.from({ length: 10 }, () => '99,99,99,999.99'));
    const total = pageTotal(asPaise(0), lines);
    expect(isWithinLimit(total)).toBe(false);
    expect(Number.isSafeInteger(total)).toBe(true);
  });

  it('TOT-06: negative page total below the limit', () => {
    const lines = linesOf(['-99,99,99,999.99', '-1']);
    expect(isWithinLimit(pageTotal(asPaise(0), lines))).toBe(false);
  });

  it('isPageEmpty', () => {
    expect(isPageEmpty(emptyLines())).toBe(true);
    expect(isPageEmpty(linesOf([], ['Taxi']))).toBe(false);
    expect(isPageEmpty(linesOf(['5']))).toBe(false);
    expect(isPageEmpty(linesOf(['  '], ['  ']))).toBe(true);
  });

  it('SRC-05 / EDT-13: default title is "Page N"', () => {
    expect(defaultTitle(3)).toBe('Page 3');
    expect(displayTitle({ number: 3, title: null })).toBe('Page 3');
    expect(displayTitle({ number: 3, title: 'Taxi' })).toBe('Taxi');
  });
});
