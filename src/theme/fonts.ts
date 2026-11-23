/**
 * Font registry (P4.4, spec §4). All fonts are bundled (SIL OFL) so they work offline and look
 * the same everywhere. Screen: WOFF2 through Fontsource CSS.
 */
// Weight files declare every subset with its unicode-range, so browsers fetch only what a
// page uses (latin for digits, latin-ext for ₹).
import '@fontsource/work-sans/400.css';
import '@fontsource/work-sans/500.css';
import '@fontsource/work-sans/600.css';
import '@fontsource/carlito/400.css';
import '@fontsource/carlito/700.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource/caladea/400.css';
import '@fontsource/caladea/700.css';
import '@fontsource/merriweather/400.css';
import '@fontsource/merriweather/700.css';
import workSansPreload from '@fontsource/work-sans/files/work-sans-latin-400-normal.woff2?url';
import carlitoPreload from '@fontsource/carlito/files/carlito-latin-400-normal.woff2?url';
import atkinsonPreload from '@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2?url';
import caladeaPreload from '@fontsource/caladea/files/caladea-latin-400-normal.woff2?url';
import merriweatherPreload from '@fontsource/merriweather/files/merriweather-latin-400-normal.woff2?url';

export type SlipFontId = 'carlito' | 'atkinson' | 'caladea' | 'merriweather';

export interface SlipFont {
  id: SlipFontId;
  /** Settings label (spec §4). */
  label: string;
  family: string;
  note: string;
  /** CSS stack: the font, then bundled Work Sans for letters it lacks, then system fallbacks. */
  stack: string;
  /** Latin regular WOFF2, preloaded when this font is selected (arch §14). */
  preload: string;
  /** False when the font has no ₹ glyph (it falls back; LOOK-03, see README). */
  hasRupee: boolean;
}

const FALLBACK_SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const FALLBACK_SERIF = 'Georgia, "Times New Roman", serif';

export const SLIP_FONTS: readonly SlipFont[] = [
  {
    id: 'carlito',
    label: 'Calibri-style',
    family: 'Carlito',
    note: 'Metric-compatible with Calibri; familiar to office users',
    stack: `Carlito, "Work Sans", Calibri, ${FALLBACK_SANS}`,
    preload: carlitoPreload,
    hasRupee: true,
  },
  {
    id: 'atkinson',
    label: 'Verdana-style',
    family: 'Atkinson Hyperlegible',
    note: 'Wide, open spacing; 1/l/I and 0/O always distinct',
    stack: `"Atkinson Hyperlegible", "Work Sans", Verdana, ${FALLBACK_SANS}`,
    preload: atkinsonPreload,
    hasRupee: false,
  },
  {
    id: 'caladea',
    label: 'Cambria-style',
    family: 'Caladea',
    note: 'Metric-compatible with Cambria',
    stack: `Caladea, "Work Sans", Cambria, ${FALLBACK_SERIF}`,
    preload: caladeaPreload,
    hasRupee: false,
  },
  {
    id: 'merriweather',
    label: 'Classic serif',
    family: 'Merriweather',
    note: 'Serif designed for screens',
    stack: `Merriweather, "Work Sans", ${FALLBACK_SERIF}`,
    preload: merriweatherPreload,
    hasRupee: true,
  },
];

export const CHROME_FONT = {
  family: 'Work Sans',
  stack: `"Work Sans", ${FALLBACK_SANS}`,
  preload: workSansPreload,
};

export function slipFont(id: string | null | undefined): SlipFont {
  return SLIP_FONTS.find((f) => f.id === id) ?? (SLIP_FONTS[0] as SlipFont);
}

function preload(href: string): void {
  if (document.head.querySelector(`link[rel="preload"][href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'font';
  link.type = 'font/woff2';
  link.crossOrigin = 'anonymous';
  link.href = href;
  document.head.appendChild(link);
}

/** P4.10: set the slip font before the first paint of any slip; preload only what is used. */
export function applySlipFont(id: string | null | undefined): void {
  const font = slipFont(id);
  preload(CHROME_FONT.preload);
  preload(font.preload);
  // The build preloads the default slip font from the HTML; drop it if another one is in use.
  if (font.id !== SLIP_FONTS[0]?.id) {
    document.head.querySelectorAll('link[data-default-slip]').forEach((l) => l.remove());
  }
  document.documentElement.style.setProperty('--slip-font', font.stack);
  document.documentElement.dataset.slipFont = font.id;
}
