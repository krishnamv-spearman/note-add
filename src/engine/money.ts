import { asPaise, MAX_PAISE, type Paise } from './types';

export type RejectReason = 'too-many-decimals' | 'over-limit';

export type ParseResult =
  | { kind: 'empty' }
  | { kind: 'ok'; paise: Paise }
  | { kind: 'invalid' }
  | { kind: 'rejected'; reason: RejectReason };

export const REJECT_MESSAGES: Record<RejectReason, string> = {
  'too-many-decimals': 'Up to 2 decimal places, for example 450.50',
  'over-limit': 'Amounts must be under ₹99.99 crore',
};

const EMPTY: ParseResult = { kind: 'empty' };
const INVALID: ParseResult = { kind: 'invalid' };

/** Invisible characters pasted from WhatsApp, web pages and editors (PST-02). */
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u00AD]/g;
const CURRENCY_PREFIX = /^(?:₹|inr|rs\.?)\s*/i;
/** Indian grouping 1,00,000 / 12,34,567 or Western 100,000 / 1,234,567 (MON-14, MON-16). */
const INDIAN_GROUPED = /^\d{1,2}(?:,\d{2})*,\d{3}$/;
const WESTERN_GROUPED = /^\d{1,3}(?:,\d{3})+$/;
/** Rupee digits allowed once leading zeros are removed: 99,99,99,999 has 9. */
const MAX_RUPEE_DIGITS = String(MAX_PAISE).length - 2;

function mapDigitsAndDashes(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0) as number; // for…of yields whole code points, never empty
    if (code >= 0x0966 && code <= 0x096f) {
      out += String(code - 0x0966); // Devanagari digits (MON-25)
    } else if (code >= 0xff10 && code <= 0xff19) {
      out += String(code - 0xff10); // full-width digits (MON-25)
    } else if (ch === '\u2212' || ch === '\u2013') {
      out += '-'; // Unicode minus, en dash (MON-20)
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Parses what the user typed into integer paise. String-only: never uses floating point.
 * Rules: arch §5.2; cases: edge-cases §1, §1.1, §3.1.
 */
export function parseAmount(input: string): ParseResult {
  let s = mapDigitsAndDashes(input.replace(INVISIBLE, '')).trim();
  if (s === '') return EMPTY;

  // Indian "only" suffix: 450/- (PST-07, decided 22/11/2026).
  if (s.endsWith('/-')) s = s.slice(0, -2).trimEnd();

  // Leading tokens, each at most once, in any order: currency prefix, sign, opening bracket.
  let sign: '' | '+' | '-' = '';
  let bracket = false;
  let prefix = false;
  for (;;) {
    const m = prefix ? null : CURRENCY_PREFIX.exec(s);
    if (m) {
      prefix = true;
      s = s.slice(m[0].length);
    } else if (sign === '' && (s.startsWith('-') || s.startsWith('+'))) {
      sign = s.startsWith('-') ? '-' : '+';
      s = s.slice(1);
    } else if (!bracket && s.startsWith('(')) {
      bracket = true;
      s = s.slice(1);
    } else {
      break;
    }
  }
  if (bracket) {
    if (sign !== '' || !s.endsWith(')')) return INVALID; // -(300), (-300), (300 (MON-21)
    s = s.slice(0, -1);
  }

  const dot = s.indexOf('.');
  const intPart = dot === -1 ? s : s.slice(0, dot);
  const fracPart = dot === -1 ? '' : s.slice(dot + 1);

  let intDigits = intPart;
  if (intPart.includes(',')) {
    if (!INDIAN_GROUPED.test(intPart) && !WESTERN_GROUPED.test(intPart)) return INVALID;
    intDigits = intPart.replaceAll(',', '');
  }
  if (!/^\d*$/.test(intDigits) || !/^\d*$/.test(fracPart)) return INVALID;
  if (intDigits === '' && fracPart === '') return INVALID; // '.', '₹', '-', '()'

  if (fracPart.length > 2) return { kind: 'rejected', reason: 'too-many-decimals' };

  const significant = intDigits.replace(/^0+/, '');
  if (significant.length > MAX_RUPEE_DIGITS) return { kind: 'rejected', reason: 'over-limit' };

  // Integer maths on digit strings: at most 9 + 2 digits, always a safe integer.
  const rupees = significant === '' ? 0 : Number(significant);
  const magnitude = rupees * 100 + Number(fracPart.padEnd(2, '0'));
  const negative = sign === '-' || bracket;
  return { kind: 'ok', paise: asPaise(negative ? -magnitude : magnitude) };
}

export type NegativeStyle = 'brackets' | 'minus';

function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const groups: string[] = [];
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  groups.unshift(rest);
  return `${groups.join(',')},${last3}`;
}

/** Magnitude with Indian grouping and two decimals, no sign: 10000000 → '1,00,000.00'. */
function formatMagnitude(paise: Paise): string {
  const digits = String(Math.abs(asPaise(paise))).padStart(3, '0');
  return `${groupIndian(digits.slice(0, -2))}.${digits.slice(-2)}`;
}

/**
 * Formats paise for display: Indian grouping, two decimals, negatives in brackets by default.
 * String-built, so the output is identical in every browser and in Node (FMT-05).
 */
export function formatPaise(paise: Paise, options: { style?: NegativeStyle } = {}): string {
  const body = formatMagnitude(paise);
  if (paise >= 0) return body;
  return options.style === 'minus' ? `-${body}` : `(${body})`;
}

/** Accessible reading of an amount, e.g. "minus 300.00 rupees" (A11Y-01). */
export function spokenPaise(paise: Paise): string {
  const body = formatMagnitude(paise);
  return paise < 0 ? `minus ${body} rupees` : `${body} rupees`;
}
