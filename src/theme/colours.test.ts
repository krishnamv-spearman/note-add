import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@/engine';
import { INK, INK_2, SLIP_COLOURS, slipColour } from './colours';

describe('slip colours', () => {
  it('has the seven spec colours', () => {
    expect(SLIP_COLOURS.map((c) => [c.label, c.paper, c.rule])).toEqual([
      ['Canary yellow', '#FFF4A3', '#E8D96B'],
      ['Mint green', '#D8F3DC', '#A9D8B3'],
      ['Blush pink', '#FADADD', '#E9AEB5'],
      ['Lavender', '#E6DDF7', '#C3B3E6'],
      ['Sky blue', '#D6ECFA', '#A6CDE8'],
      ['Peach', '#FFE0C2', '#F0B98A'],
      ['Light grey', '#ECECEA', '#C9C9C4'],
    ]);
    expect([INK, INK_2]).toEqual(['#363A27', '#4A4D3A']);
  });

  const pairs = SLIP_COLOURS.flatMap((c) => [
    [c.label, 'ink', c.paper, INK] as const,
    [c.label, 'secondary ink', c.paper, INK_2] as const,
  ]);

  it.each(pairs)('LOOK-01: %s × %s ≥ 4.5:1', (_label, _ink, paper, ink) => {
    expect(contrastRatio(paper, ink)).toBeGreaterThanOrEqual(4.5);
  });

  it('covers all 14 pairs', () => {
    expect(pairs).toHaveLength(14);
  });

  it('unknown colour ids fall back to canary', () => {
    expect(slipColour('nope').id).toBe('canary');
    expect(slipColour(null).id).toBe('canary');
    expect(slipColour('mint').paper).toBe('#D8F3DC');
  });
});
