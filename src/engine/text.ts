/**
 * Decision 23/11/2026: version 1 is English only. Descriptions, page titles and notebook names
 * accept Latin-script text: Basic Latin, Latin-1 Supplement and Latin Extended-A, plus ₹ and
 * common punctuation. Every allowed character is drawn by the bundled fonts (TXT-07).
 */
export const UNSUPPORTED_TEXT_MESSAGE = 'Only English text is supported for now';

/** Common punctuation beyond Latin-1: dashes, curly quotes, bullet, ellipsis, primes, guillemets. */
const PUNCTUATION = new Set([
  0x2013, 0x2014, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e, 0x2022, 0x2026, 0x2032, 0x2033,
  0x2039, 0x203a,
]);
const RUPEE = 0x20b9;
/** Invisible soft hyphen and the deprecated ŉ (no bundled glyph): left out on purpose. */
const EXCLUDED = new Set([0x00ad, 0x0149]);

export function isSupportedCodePoint(cp: number): boolean {
  if (EXCLUDED.has(cp)) return false;
  return (
    (cp >= 0x20 && cp <= 0x7e) || // Basic Latin (printable)
    (cp >= 0xa0 && cp <= 0x17f) || // Latin-1 Supplement and Latin Extended-A
    cp === RUPEE ||
    PUNCTUATION.has(cp)
  );
}

export interface FilteredText {
  text: string;
  /** True when any character was removed. */
  removed: boolean;
}

/**
 * Keeps only supported characters (TXT-01). Text is composed first (NFC) so a Latin letter typed
 * as letter + combining accent is kept as one supported character.
 */
export function filterSupportedText(input: string): FilteredText {
  const composed = input.normalize('NFC');
  let text = '';
  for (const ch of composed) {
    if (isSupportedCodePoint(ch.codePointAt(0) as number)) text += ch;
  }
  return { text, removed: text !== composed };
}

export function isSupportedText(input: string): boolean {
  return !filterSupportedText(input).removed;
}
