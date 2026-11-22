import { describe, expect, it } from 'vitest';
import { contrastRatio, parseHex, relativeLuminance } from './contrast';

describe('contrast', () => {
  it('WCAG reference pairs', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
    expect(contrastRatio('#123456', '#123456')).toBe(1);
  });

  it('relative luminance of black and white', () => {
    expect(relativeLuminance('#000')).toBe(0);
    expect(relativeLuminance('#fff')).toBeCloseTo(1, 10);
  });

  it('parses 3- and 6-digit hex, refuses anything else', () => {
    expect(parseHex('#FFF4A3')).toEqual([255, 244, 163]);
    expect(parseHex('#abc')).toEqual([170, 187, 204]);
    expect(() => parseHex('FFF4A3')).toThrow(RangeError);
    expect(() => parseHex('#GGGGGG')).toThrow(RangeError);
  });

  it('arch §5.7 pre-check: lavender is the lowest at 8.96 and 6.65', () => {
    expect(contrastRatio('#363A27', '#E6DDF7')).toBeCloseTo(8.96, 1);
    expect(contrastRatio('#4A4D3A', '#E6DDF7')).toBeCloseTo(6.65, 1);
  });
});
