declare const paiseBrand: unique symbol;

/** An amount in integer paise. Always a safe integer. Created only by engine helpers. */
export type Paise = number & { readonly [paiseBrand]: 'Paise' };

/** Local calendar date, 'YYYY-MM-DD'. Never a UTC timestamp. */
export type IsoDate = string;

export type PageStatus = 'draft' | 'final';

export interface Line {
  /** Free text, up to 120 characters. */
  description: string;
  /** Exactly what the user typed, kept for display and editing. */
  amountText: string;
  /** null = empty or not a number (counts as 0; flagged when amountText is non-empty). */
  amountPaise: Paise | null;
}

/** ₹99,99,99,999.99 — the largest amount or total allowed (spec §5). */
export const MAX_PAISE = 99_999_999_999 as Paise;
export const MIN_PAISE = -99_999_999_999 as Paise;
export const ZERO = 0 as Paise;

function assertSafe(n: number): void {
  if (!Number.isSafeInteger(n)) {
    throw new RangeError(`Not a safe integer number of paise: ${String(n)}`);
  }
}

/** Brands a number as Paise after checking it is a safe integer. Normalises -0 to 0. */
export function asPaise(n: number): Paise {
  assertSafe(n);
  return (n === 0 ? 0 : n) as Paise;
}

/** Exact integer addition of paise. Does not check the money limit (see isWithinLimit). */
export function addPaise(a: Paise, b: Paise): Paise {
  assertSafe(a);
  assertSafe(b);
  return asPaise(a + b);
}

export function isWithinLimit(n: number): boolean {
  assertSafe(n);
  return n >= MIN_PAISE && n <= MAX_PAISE;
}
