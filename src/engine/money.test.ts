import { describe, expect, it } from 'vitest';
import { formatPaise, parseAmount, REJECT_MESSAGES, spokenPaise } from './money';
import { asPaise, MAX_PAISE, MIN_PAISE } from './types';

const ok = (paise: number) => ({ kind: 'ok', paise });
const EMPTY = { kind: 'empty' };
const INVALID = { kind: 'invalid' };
const DECIMALS = { kind: 'rejected', reason: 'too-many-decimals' };
const OVER = { kind: 'rejected', reason: 'over-limit' };

type Row = [id: string, input: string, expected: object];

const rows: Row[] = [
  // Plain values
  ['MON-01', '', EMPTY],
  ['MON-01', '   ', EMPTY],
  ['MON-02', '450', ok(45000)],
  ['MON-03', '450.5', ok(45050)],
  ['MON-04', '1280.75', ok(128075)],
  ['MON-05', '450.505', DECIMALS],
  ['MON-06', '450.500', DECIMALS],
  ['MON-07', '.5', ok(50)],
  ['MON-08', '450.', ok(45000)],
  ['MON-09', '007.50', ok(750)],
  // Zero
  ['MON-10', '0', ok(0)],
  ['MON-10', '0.00', ok(0)],
  ['MON-10', '-0', ok(0)],
  ['MON-10', '-0.00', ok(0)],
  // Negatives
  ['MON-11', '-300', ok(-30000)],
  ['MON-12', '(300.00)', ok(-30000)],
  ['MON-13', '+300', ok(30000)],
  ['MON-20', '\u2212300', ok(-30000)],
  ['MON-20', '\u2013300', ok(-30000)],
  ['MON-21', '-(300)', INVALID],
  ['MON-21', '(-300)', INVALID],
  ['MON-21', '(300', INVALID],
  ['MON-21', '300)', INVALID],
  ['MON-22', '--5', INVALID],
  ['MON-22', '5-', INVALID],
  ['MON-22', '+-5', INVALID],
  // Grouping
  ['MON-14', '450,50', INVALID],
  ['MON-15', '1,00,000', ok(10000000)],
  ['MON-15', '100,000', ok(10000000)],
  ['MON-15', '12,34,567.89', ok(123456789)],
  ['MON-15', '1,234,567.89', ok(123456789)],
  ['MON-15', '1,000', ok(100000)],
  ['MON-16', '1,0,0', INVALID],
  ['MON-16', '10,00,0', INVALID],
  ['MON-16', ',100', INVALID],
  ['MON-16', '100,', INVALID],
  ['MON-19', '1 280', INVALID],
  // Prefixes
  ['MON-17', '₹1,280.75', ok(128075)],
  ['MON-17', 'Rs. 1280.75', ok(128075)],
  ['MON-17', 'rs 50', ok(5000)],
  ['MON-17', 'RS50', ok(5000)],
  ['MON-17', 'INR 50', ok(5000)],
  ['MON-17', 'inr50', ok(5000)],
  ['MON-18', '₹', INVALID],
  ['MON-18', 'Rs.', INVALID],
  ['MON-18', '₹₹50', INVALID],
  // Non-ASCII digits (decided 22/11/2026)
  ['MON-25', '४५०', ok(45000)],
  ['MON-25', '१,२८०.७५', ok(128075)],
  ['MON-25', '４５０', ok(45000)],
  // Not numbers
  ['MON-23', '1e5', INVALID],
  ['MON-23', '0x10', INVALID],
  ['MON-23', 'Infinity', INVALID],
  ['MON-23', 'NaN', INVALID],
  ['MON-24', 'abc', INVALID],
  ['MON-24', '12a', INVALID],
  ['MON-24', '1.2.3', INVALID],
  ['MON-24', '.', INVALID],
  ['MON-24', '-', INVALID],
  ['MON-24', '()', INVALID],
  ['MON-26', '1.5L', INVALID],
  ['MON-26', '2cr', INVALID],
  ['MON-26', '5k', INVALID],
  // Limits (₹99,99,99,999.99 = 99,999,999,999 paise)
  ['MON-27', '99,99,99,999.99', ok(99999999999)],
  ['MON-27', '999999999.99', ok(99999999999)],
  ['MON-27', '100000000.00', ok(10000000000)],
  ['MON-28', '1000000000.00', OVER],
  ['MON-28', '1,00,00,00,000', OVER],
  ['MON-29', '-99,99,99,999.99', ok(-99999999999)],
  ['MON-29', '-1000000000', OVER],
  ['MON-29', '(1000000000.00)', OVER],
  ['MON-30', '123456789012345678901234567890', OVER],
  ['MON-30', '000000000000000000000000000001', ok(100)],
  ['MON-30', '0000000000000000000999999999.99', ok(99999999999)],
  // Paste junk
  ['PST-01', '\u00A0450\u00A0', ok(45000)],
  ['PST-01', '\u2009450\u202F', ok(45000)],
  ['PST-02', '\u200B450\u200E', ok(45000)],
  ['PST-02', '\uFEFF450', ok(45000)],
  ['PST-02', '4\u200B50', ok(45000)],
  ['PST-03', '450\t', ok(45000)],
  ['PST-03', '450\r\n', ok(45000)],
  ['PST-04', '450\t300', INVALID],
  ['PST-04', '450\n300', INVALID],
  // Pasted formats
  ['PST-05', '(₹1,280.75)', ok(-128075)],
  ['PST-05', '₹(1,280.75)', ok(-128075)],
  ['PST-06', '-₹300', ok(-30000)],
  ['PST-06', 'Rs.-300', ok(-30000)],
  ['PST-06', '₹-300', ok(-30000)],
  ['PST-07', '450/-', ok(45000)],
  ['PST-07', '₹ 450/-', ok(45000)],
  ['PST-07', '1,280.50/-', ok(128050)],
  ['PST-07', '450 /-', ok(45000)],
  ['PST-07', '/-', INVALID],
  ['PST-08', '450 only', INVALID],
  ['PST-08', '450 INR', INVALID],
  ['PST-08', '1.5 Cr', INVALID],
  ['PST-08', '₹450.00 (paid)', INVALID],
  ['PST-09', '1,280.75 Dr', INVALID],
  ['PST-09', '1,280.75 Cr', INVALID],
  ['PST-10', '1,234.567', DECIMALS],
  ['PST-11', '1.234,56', INVALID],
  ['PST-14', '1,00,000.00', ok(10000000)],
  ['PST-14', '(300.00)', ok(-30000)],
  // Rounding: never rounds, never x * 100
  ['RND-01', '10.005', DECIMALS],
  ['RND-02', '0.29', ok(29)],
  ['RND-02', '1.15', ok(115)],
  ['RND-02', '4.35', ok(435)],
  ['RND-02', '1.005', DECIMALS],
  ['RND-02', '8.20', ok(820)],
  ['RND-02', '19.99', ok(1999)],
];

describe('parseAmount', () => {
  it.each(rows)('%s: %j', (_id, input, expected) => {
    expect(parseAmount(input)).toEqual(expected);
  });

  it('MON-10: zero is never negative zero', () => {
    const r = parseAmount('-0');
    expect(r.kind === 'ok' && Object.is(r.paise, -0)).toBe(false);
  });

  it('MON-31: 0.1 + 0.2 is exactly 30 paise', () => {
    const a = parseAmount('0.1');
    const b = parseAmount('0.2');
    expect(a.kind === 'ok' && b.kind === 'ok' ? a.paise + b.paise : null).toBe(30);
  });

  it('MON-05: rejection messages', () => {
    expect(REJECT_MESSAGES['too-many-decimals']).toBe('Up to 2 decimal places, for example 450.50');
    expect(REJECT_MESSAGES['over-limit']).toBe('Amounts must be under ₹99.99 crore');
  });
});

describe('formatPaise', () => {
  it.each<[string, number, string]>([
    ['FMT-01', 0, '0.00'],
    ['FMT-01', 5, '0.05'],
    ['FMT-01', -5, '(0.05)'],
    ['FMT-01', 1, '0.01'],
    ['FMT-01', 99, '0.99'],
    ['FMT-01', 100, '1.00'],
    ['FMT-02', 99999, '999.99'],
    ['FMT-02', 100000, '1,000.00'],
    ['FMT-02', 9999999, '99,999.99'],
    ['FMT-02', 10000000, '1,00,000.00'],
    ['FMT-02', 99999999, '9,99,999.99'],
    ['FMT-02', 100000000, '10,00,000.00'],
    ['FMT-02', 1000000000, '1,00,00,000.00'],
    ['FMT-02', 10000000000, '10,00,00,000.00'],
    ['FMT-03', 99999999999, '99,99,99,999.99'],
    ['FMT-03', -99999999999, '(99,99,99,999.99)'],
    ['MON-11', -30000, '(300.00)'],
  ])('%s: %d → %s', (_id, paise, expected) => {
    expect(formatPaise(asPaise(paise))).toBe(expected);
  });

  it('FMT-04: minus style', () => {
    expect(formatPaise(asPaise(-30000), { style: 'minus' })).toBe('-300.00');
    expect(formatPaise(asPaise(30000), { style: 'minus' })).toBe('300.00');
    expect(formatPaise(asPaise(-30000), { style: 'brackets' })).toBe('(300.00)');
  });

  it('MON-10: negative zero formats as 0.00', () => {
    expect(formatPaise(-0 as never)).toBe('0.00');
  });

  it('rejects non-integers rather than rounding', () => {
    expect(() => formatPaise(1.5 as never)).toThrow(RangeError);
  });

  it('FMT-05: matches Intl en-IN for 1,000 spread values', () => {
    const intl = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    let x = 7;
    for (let i = 0; i < 1000; i++) {
      x = (x * 48271) % 2147483647; // deterministic spread
      const paise = (x * 46) % MAX_PAISE;
      expect(formatPaise(asPaise(paise))).toBe(intl.format(paise / 100));
    }
  });

  it('limits are the documented values', () => {
    expect(formatPaise(MAX_PAISE)).toBe('99,99,99,999.99');
    expect(formatPaise(MIN_PAISE)).toBe('(99,99,99,999.99)');
  });
});

describe('spokenPaise', () => {
  it('A11Y-01: negative amounts read as minus … rupees', () => {
    expect(spokenPaise(asPaise(-30000))).toBe('minus 300.00 rupees');
    expect(spokenPaise(asPaise(128075))).toBe('1,280.75 rupees');
  });
});
