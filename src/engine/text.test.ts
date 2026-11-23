import { describe, expect, it } from 'vitest';
import {
  filterSupportedText,
  isSupportedCodePoint,
  isSupportedText,
  UNSUPPORTED_TEXT_MESSAGE,
} from './text';

describe('English-only text (decided 23/11/2026)', () => {
  it('TXT-01: Latin text, accents, ₹ and common punctuation are kept unchanged', () => {
    const ok = [
      'Taxi to airport, 2 nights @ hotel (50% off) #3',
      'Café crème, naïve, Señor, Øresund, Æble, ß',
      'Łódź, Dvořák, Škoda, Győr, İstanbul, œuvre',
      '₹450 tip — “quoted” ‘single’ „low“ • bullet … 5′ 6″ ‹a› «b»',
      '¡Hola! ¿Qué? £ ¥ © ® ° ± ½ × ÷ ¶ §',
    ];
    for (const s of ok) expect(filterSupportedText(s)).toEqual({ text: s, removed: false });
  });

  it('TXT-02: Devanagari, Arabic, emoji, CJK and other scripts are removed', () => {
    expect(filterSupportedText('दूध और ब्रेड')).toEqual({ text: '  ', removed: true });
    expect(filterSupportedText('Taxi 🚕')).toEqual({ text: 'Taxi ', removed: true });
    expect(filterSupportedText('قهوة tea')).toEqual({ text: ' tea', removed: true });
    expect(filterSupportedText('Milk 牛奶 Молоко Γάλα')).toEqual({
      text: 'Milk   ',
      removed: true,
    });
    expect(filterSupportedText('👍🏽❤️')).toEqual({ text: '', removed: true });
  });

  it('TXT-03: invisible and unsupported marks are removed (zero-width, soft hyphen, ŉ, Unicode hyphens)', () => {
    expect(filterSupportedText('a\u200Bb\u00ADcŉd\u2010e\u2011f').text).toBe('abcdef');
    expect(filterSupportedText('\u0000\u001f\u007f').text).toBe('');
  });

  it('TXT-04: a Latin letter typed with a combining accent is composed and kept', () => {
    const decomposed = 'Cafe\u0301';
    // Composing is not removing: no message is shown.
    expect(filterSupportedText(decomposed)).toEqual({ text: 'Café', removed: false });
    expect(filterSupportedText('Café'.normalize('NFC')).removed).toBe(false);
    // A combining mark with no precomposed Latin letter is removed.
    expect(filterSupportedText('q\u0301').text).toBe('q');
  });

  it('code point boundaries', () => {
    expect([0x1f, 0x20, 0x7e, 0x7f, 0x9f, 0xa0, 0x17f, 0x180].map(isSupportedCodePoint)).toEqual([
      false,
      true,
      true,
      false,
      false,
      true,
      true,
      false,
    ]);
    expect(isSupportedCodePoint(0x20b9)).toBe(true);
    expect(isSupportedCodePoint(0x20ac)).toBe(false); // € is not in the v1 set
  });

  it('isSupportedText and the message', () => {
    expect(isSupportedText('Hotel')).toBe(true);
    expect(isSupportedText('Hotel 🏨')).toBe(false);
    expect(UNSUPPORTED_TEXT_MESSAGE).toBe('Only English text is supported for now');
  });
});
