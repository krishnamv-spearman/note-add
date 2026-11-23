/**
 * Build-time stub for `@pdf-lib/standard-fonts` (bundle budget D37, phase 7). pdf-lib bundles
 * the metrics of the 14 standard PDF fonts (~100 KB gzip). Note-Add never uses them: every
 * font is embedded from the bundled files. `FontNames` is empty, so no name is "standard" and
 * pdf-lib always takes the embedded-font path.
 */
export const FontNames: Record<string, string> = {};
export const Encodings: Record<string, unknown> = {};
export const Font = {
  load(): never {
    throw new Error('Standard PDF fonts are not available in Note-Add');
  },
};
