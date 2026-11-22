/**
 * The single source of slip and ink colours (spec §4, arch §7.5). CSS custom properties,
 * the export renderers and the contrast test all read from here.
 */
export type SlipColourId = 'canary' | 'mint' | 'blush' | 'lavender' | 'sky' | 'peach' | 'grey';

export interface SlipColour {
  id: SlipColourId;
  label: string;
  paper: string;
  rule: string;
}

export const SLIP_COLOURS: readonly SlipColour[] = [
  { id: 'canary', label: 'Canary yellow', paper: '#FFF4A3', rule: '#E8D96B' },
  { id: 'mint', label: 'Mint green', paper: '#D8F3DC', rule: '#A9D8B3' },
  { id: 'blush', label: 'Blush pink', paper: '#FADADD', rule: '#E9AEB5' },
  { id: 'lavender', label: 'Lavender', paper: '#E6DDF7', rule: '#C3B3E6' },
  { id: 'sky', label: 'Sky blue', paper: '#D6ECFA', rule: '#A6CDE8' },
  { id: 'peach', label: 'Peach', paper: '#FFE0C2', rule: '#F0B98A' },
  { id: 'grey', label: 'Light grey', paper: '#ECECEA', rule: '#C9C9C4' },
];

/** Dark olive charcoal; secondary text. Both must pass 4.5:1 on every slip. */
export const INK = '#363A27';
export const INK_2 = '#4A4D3A';

export function slipColour(id: string | null | undefined): SlipColour {
  return SLIP_COLOURS.find((c) => c.id === id) ?? (SLIP_COLOURS[0] as SlipColour);
}
