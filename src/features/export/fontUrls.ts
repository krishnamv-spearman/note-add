/** Browser: bundled URLs of the WOFF files embedded into PDFs (fetched from this origin). */
import carlitoLatin400 from '@fontsource/carlito/files/carlito-latin-400-normal.woff?url';
import carlitoLatinExt400 from '@fontsource/carlito/files/carlito-latin-ext-400-normal.woff?url';
import carlitoLatin700 from '@fontsource/carlito/files/carlito-latin-700-normal.woff?url';
import carlitoLatinExt700 from '@fontsource/carlito/files/carlito-latin-ext-700-normal.woff?url';
import atkinsonHyperlegibleLatin400 from '@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff?url';
import atkinsonHyperlegibleLatinExt400 from '@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-ext-400-normal.woff?url';
import atkinsonHyperlegibleLatin700 from '@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff?url';
import atkinsonHyperlegibleLatinExt700 from '@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-ext-700-normal.woff?url';
import caladeaLatin400 from '@fontsource/caladea/files/caladea-latin-400-normal.woff?url';
import caladeaLatinExt400 from '@fontsource/caladea/files/caladea-latin-ext-400-normal.woff?url';
import caladeaLatin700 from '@fontsource/caladea/files/caladea-latin-700-normal.woff?url';
import caladeaLatinExt700 from '@fontsource/caladea/files/caladea-latin-ext-700-normal.woff?url';
import merriweatherLatin400 from '@fontsource/merriweather/files/merriweather-latin-400-normal.woff?url';
import merriweatherLatinExt400 from '@fontsource/merriweather/files/merriweather-latin-ext-400-normal.woff?url';
import merriweatherLatin700 from '@fontsource/merriweather/files/merriweather-latin-700-normal.woff?url';
import merriweatherLatinExt700 from '@fontsource/merriweather/files/merriweather-latin-ext-700-normal.woff?url';
import workSansLatin400 from '@fontsource/work-sans/files/work-sans-latin-400-normal.woff?url';
import workSansLatinExt400 from '@fontsource/work-sans/files/work-sans-latin-ext-400-normal.woff?url';
import workSansLatin600 from '@fontsource/work-sans/files/work-sans-latin-600-normal.woff?url';
import workSansLatinExt600 from '@fontsource/work-sans/files/work-sans-latin-ext-600-normal.woff?url';
import notoSansDevanagariDevanagari400 from '@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-400-normal.woff?url';
import notoSansDevanagariDevanagari700 from '@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-700-normal.woff?url';
import type { FontKey } from './fontFiles';

export const FONT_URLS: Record<FontKey, string> = {
  'carlito-latin-400': carlitoLatin400,
  'carlito-latin-ext-400': carlitoLatinExt400,
  'carlito-latin-700': carlitoLatin700,
  'carlito-latin-ext-700': carlitoLatinExt700,
  'atkinson-hyperlegible-latin-400': atkinsonHyperlegibleLatin400,
  'atkinson-hyperlegible-latin-ext-400': atkinsonHyperlegibleLatinExt400,
  'atkinson-hyperlegible-latin-700': atkinsonHyperlegibleLatin700,
  'atkinson-hyperlegible-latin-ext-700': atkinsonHyperlegibleLatinExt700,
  'caladea-latin-400': caladeaLatin400,
  'caladea-latin-ext-400': caladeaLatinExt400,
  'caladea-latin-700': caladeaLatin700,
  'caladea-latin-ext-700': caladeaLatinExt700,
  'merriweather-latin-400': merriweatherLatin400,
  'merriweather-latin-ext-400': merriweatherLatinExt400,
  'merriweather-latin-700': merriweatherLatin700,
  'merriweather-latin-ext-700': merriweatherLatinExt700,
  'work-sans-latin-400': workSansLatin400,
  'work-sans-latin-ext-400': workSansLatinExt400,
  'work-sans-latin-600': workSansLatin600,
  'work-sans-latin-ext-600': workSansLatinExt600,
  'noto-sans-devanagari-devanagari-400': notoSansDevanagariDevanagari400,
  'noto-sans-devanagari-devanagari-700': notoSansDevanagariDevanagari700,
};

const cache = new Map<FontKey, Promise<Uint8Array>>();

/** Same-origin fetch (CSP connect-src 'self'); cached for the session. */
export function loadFontBytes(key: FontKey): Promise<Uint8Array> {
  let p = cache.get(key);
  if (!p) {
    p = fetch(FONT_URLS[key]).then(async (r) => {
      if (!r.ok) throw new Error(`Font ${key}: HTTP ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    });
    cache.set(key, p);
    p.catch(() => cache.delete(key));
  }
  return p;
}
