// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { applySlipFont } from './fonts';

beforeEach(() => {
  document.head.innerHTML = '<link rel="preload" data-default-slip href="/assets/carlito.woff2">';
});

describe('slip font preloads (P7.8)', () => {
  it('LOOK-08: keeps the build-time default-font preload while the default font is in use', () => {
    applySlipFont('carlito');
    expect(document.head.querySelector('link[data-default-slip]')).not.toBeNull();
  });

  it('LOOK-08: drops the unused default-font preload when another font is chosen', () => {
    applySlipFont('merriweather');
    expect(document.head.querySelector('link[data-default-slip]')).toBeNull();
    expect(document.documentElement.dataset.slipFont).toBe('merriweather');
  });
});
