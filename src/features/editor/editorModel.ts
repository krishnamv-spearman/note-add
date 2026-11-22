import { type Line, type Paise, parseAmount, REJECT_MESSAGES } from '@/engine';
import { AMOUNT_TEXT_MAX, DESCRIPTION_MAX } from '@/db';

/** What the user currently sees in a line (raw text). */
export interface LocalLine {
  description: string;
  amountText: string;
}

/** EDT-05 / EDT-06: newlines and tabs become single spaces; cut at 120 characters. */
export function cleanDescription(text: string): { text: string; cut: boolean } {
  const flat = text.replace(/[\r\n\t]+/g, ' ');
  return flat.length > DESCRIPTION_MAX
    ? { text: flat.slice(0, DESCRIPTION_MAX), cut: true }
    : { text: flat, cut: false };
}

/** EDT-07: a description of only spaces is saved as empty. */
export function descriptionForSave(text: string): string {
  return text.trim() === '' ? '' : text;
}

export type AmountState =
  | { kind: 'empty' }
  | { kind: 'ok'; paise: Paise }
  | { kind: 'invalid'; message: string | null }
  | { kind: 'rejected'; message: string };

export const TOO_LONG = `Too long (${AMOUNT_TEXT_MAX} characters at most)`;

/** PST-12: an over-long paste is kept, not cut, and marked invalid with "Too long". */
export function amountState(text: string): AmountState {
  if (text.length > AMOUNT_TEXT_MAX) return { kind: 'invalid', message: TOO_LONG };
  const r = parseAmount(text);
  switch (r.kind) {
    case 'empty':
      return { kind: 'empty' };
    case 'ok':
      return { kind: 'ok', paise: r.paise };
    case 'invalid':
      return { kind: 'invalid', message: null };
    case 'rejected':
      return { kind: 'rejected', message: REJECT_MESSAGES[r.reason] };
  }
}

/** The stored form of a line whose amount is committable. */
export function toStoredLine(local: LocalLine): Line {
  const s = amountState(local.amountText);
  return {
    description: descriptionForSave(local.description),
    amountText: s.kind === 'empty' ? '' : local.amountText,
    amountPaise: s.kind === 'ok' ? s.paise : null,
  };
}

export function sameLine(a: Line | undefined, b: Line | undefined): boolean {
  return (
    a !== undefined &&
    b !== undefined &&
    a.description === b.description &&
    a.amountText === b.amountText &&
    a.amountPaise === b.amountPaise
  );
}

/**
 * KBD-11: ± on the editing bar. Empty → '-' (waits for digits); invalid → unchanged;
 * a number → sign toggled.
 */
export function toggleSign(text: string): string {
  const t = text.trim();
  if (t === '') return '-';
  const s = amountState(t);
  if (s.kind !== 'ok' && s.kind !== 'rejected') return text;
  if (t.startsWith('(') && t.endsWith(')')) return t.slice(1, -1);
  if (t.startsWith('-') || t.startsWith('−')) return t.slice(1);
  if (t.startsWith('+')) return `-${t.slice(1)}`;
  return `-${t}`;
}

export const fieldIndex = (line: number, field: 0 | 1): number => line * 2 + field;
