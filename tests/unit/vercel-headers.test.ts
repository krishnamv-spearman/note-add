import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Rule {
  source: string;
  headers: { key: string; value: string }[];
}
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
  headers: Rule[];
  rewrites: { source: string; destination: string }[];
};
const header = (source: string, key: string): string | undefined =>
  vercel.headers.find((r) => r.source === source)?.headers.find((h) => h.key === key)?.value;

describe('vercel.json (P7.6, arch §11, §13.5)', () => {
  it('the service worker is never cached long-term, so updates are picked up', () => {
    expect(header('/sw.js', 'Cache-Control')).toBe('no-cache');
    expect(header('/manifest.webmanifest', 'Cache-Control')).toBe('no-cache');
  });

  it('hashed assets and the Workbox runtime are cached for a year, immutable', () => {
    for (const source of ['/assets/(.*)', '/workbox-(.*).js']) {
      expect(header(source, 'Cache-Control')).toBe('public, max-age=31536000, immutable');
    }
  });

  it('the manifest has the right content type', () => {
    expect(header('/manifest.webmanifest', 'Content-Type')).toBe('application/manifest+json');
  });

  it('SEC-01 / SEC-04: the CSP allows only this origin, no eval and no inline scripts', () => {
    const csp = header('/(.*)', 'Content-Security-Policy') ?? '';
    const directives = Object.fromEntries(
      csp.split(';').map((d) => {
        const [name, ...values] = d.trim().split(/\s+/);
        return [name, values];
      }),
    ) as Record<string, string[]>;
    expect(directives['default-src']).toEqual(["'self'"]);
    expect(directives['script-src']).toEqual(["'self'"]); // service worker and registration are script files
    expect(directives['worker-src']).toEqual(["'self'"]); // the service worker itself
    expect(directives['connect-src']).toEqual(["'self'"]);
    expect(directives['font-src']).toEqual(["'self'"]);
    expect(csp).not.toMatch(/unsafe-eval|https?:|\*/);
    expect(directives['frame-ancestors']).toEqual(["'none'"]);
  });

  it('other security headers are present', () => {
    expect(header('/(.*)', 'X-Content-Type-Options')).toBe('nosniff');
    expect(header('/(.*)', 'Referrer-Policy')).toBe('no-referrer');
    expect(header('/(.*)', 'Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
  });

  it('the SPA rewrite keeps files with extensions (sw.js, manifest, icons) out of the fallback', () => {
    const rule = vercel.rewrites[0];
    expect(rule?.destination).toBe('/index.html');
    const re = new RegExp(`^${rule?.source}$`);
    for (const deep of ['/n/abc', '/n/abc/p/3', '/settings', '/privacy']) {
      expect(re.test(deep), deep).toBe(true);
    }
    for (const file of ['/sw.js', '/manifest.webmanifest', '/icons/icon-192.png', '/assets/x.js']) {
      expect(re.test(file), file).toBe(false);
    }
  });
});
