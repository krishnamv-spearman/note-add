import type { FontId } from '@/db';

/**
 * WOFF files embedded into PDFs (subset). Keys are Fontsource file stems; the browser loader
 * maps them to bundled URLs and tests read them from node_modules. Each chain is ordered:
 * the first font that has a glyph draws it. Every character allowed by the English-only rule
 * (decided 23/11/2026) is covered by the slip font or Work Sans (TXT-07).
 */
export type FontKey = keyof typeof FONT_PACKAGES;

export const FONT_PACKAGES = {
  'carlito-latin-400': 'carlito',
  'carlito-latin-ext-400': 'carlito',
  'carlito-latin-700': 'carlito',
  'carlito-latin-ext-700': 'carlito',
  'atkinson-hyperlegible-latin-400': 'atkinson-hyperlegible',
  'atkinson-hyperlegible-latin-ext-400': 'atkinson-hyperlegible',
  'atkinson-hyperlegible-latin-700': 'atkinson-hyperlegible',
  'atkinson-hyperlegible-latin-ext-700': 'atkinson-hyperlegible',
  'caladea-latin-400': 'caladea',
  'caladea-latin-ext-400': 'caladea',
  'caladea-latin-700': 'caladea',
  'caladea-latin-ext-700': 'caladea',
  'merriweather-latin-400': 'merriweather',
  'merriweather-latin-ext-400': 'merriweather',
  'merriweather-latin-700': 'merriweather',
  'merriweather-latin-ext-700': 'merriweather',
  'work-sans-latin-400': 'work-sans',
  'work-sans-latin-ext-400': 'work-sans',
  'work-sans-latin-600': 'work-sans',
  'work-sans-latin-ext-600': 'work-sans',
} as const;

const SLIP_STEM: Record<FontId, string> = {
  carlito: 'carlito',
  atkinson: 'atkinson-hyperlegible',
  caladea: 'caladea',
  merriweather: 'merriweather',
};

export interface FontChains {
  body: FontKey[];
  bold: FontKey[];
  ui: FontKey[];
  uiBold: FontKey[];
}

export function fontChains(fontId: FontId): FontChains {
  const s = SLIP_STEM[fontId];
  const k = (key: string) => key as FontKey;
  return {
    body: [
      k(`${s}-latin-400`),
      k(`${s}-latin-ext-400`),
      'work-sans-latin-400',
      'work-sans-latin-ext-400',
    ],
    bold: [
      k(`${s}-latin-700`),
      k(`${s}-latin-ext-700`),
      'work-sans-latin-600',
      'work-sans-latin-ext-600',
    ],
    ui: ['work-sans-latin-400', 'work-sans-latin-ext-400'],
    uiBold: ['work-sans-latin-600', 'work-sans-latin-ext-600'],
  };
}

export const fileNameOf = (key: FontKey): string => `${key}-normal.woff`;
