import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

interface VercelRule {
  source: string;
  headers: { key: string; value: string }[];
}

/**
 * SEC-02 / P7.6: `vite preview` does not read vercel.json, so its header rules (CSP, and the
 * per-path cache rules for the service worker and hashed assets) are applied here. E2E tests
 * therefore run under the real production headers.
 */
function vercelHeaders(base: string): Plugin {
  const rules = (
    JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
      headers: VercelRule[];
    }
  ).headers.map((r) => ({
    // Vercel path patterns: "/(.*)" and "/assets/(.*)" → regular expressions.
    re: new RegExp(
      '^' +
        r.source
          .split('(.*)')
          .map((part) => part.replace(/[.+?^${}|[\]\\]/g, '\\$&'))
          .join('.*') +
        '$',
    ),
    headers: r.headers,
  }));
  return {
    name: 'note-add-vercel-headers',
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        let path = (req.url ?? '/').split('?')[0] ?? '/';
        if (base !== '/' && path.startsWith(base)) path = '/' + path.slice(base.length);
        for (const rule of rules) {
          if (rule.re.test(path)) for (const h of rule.headers) res.setHeader(h.key, h.value);
        }
        next();
      });
    },
  };
}

const base = process.env.VITE_BASE ?? '/';

/** Arch §10: precache the whole build, but only the latin and latin-ext font subsets (D30). */
const pwa = VitePWA({
  registerType: 'prompt',
  injectRegister: false, // registered from src/features/pwa/register.ts (a script file, CSP)
  manifest: {
    id: base,
    name: 'Note-Add',
    short_name: 'Note-Add',
    description: 'Sticky-note expense pages that add themselves up. Made by Spearman.',
    lang: 'en-IN',
    display: 'standalone',
    start_url: base,
    scope: base,
    theme_color: '#FFF4A3',
    background_color: '#FAFAF7',
    categories: ['finance', 'productivity'],
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: 'icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },
  workbox: {
    // HTML, JS (including the lazy export chunk, so export works offline), CSS, icons, licences.
    globPatterns: [
      '**/*.{html,js,css,svg,png,webmanifest}',
      'fonts/LICENSES/*.txt',
      'assets/*-latin-*-normal-*.{woff2,woff}',
    ],
    // Fonts: latin and latin-ext only, as WOFF2 (screen) and WOFF (embedded into PDFs).
    // No cyrillic, greek, vietnamese… subsets: English-only text cannot use them.
    globIgnores: ['**/node_modules/**'],
    navigateFallback: `${base}index.html`,
    cleanupOutdatedCaches: true,
    maximumFileSizeToCacheInBytes: 1_000_000,
  },
});

const testTz = process.env.TEST_TZ ?? 'Asia/Kolkata';

/** P7.8: preload the first-paint fonts from the HTML itself, so the downloads start with the
 *  page instead of after the JavaScript and the database open (arch §14). The default slip font
 *  is marked so applySlipFont can drop it when the user chose another one. */
function fontPreloads(): Plugin {
  const wanted: [RegExp, boolean][] = [
    [/work-sans-latin-400-normal[^/]*.woff2$/, false],
    [/work-sans-latin-600-normal[^/]*.woff2$/, false],
    [/carlito-latin-400-normal[^/]*.woff2$/, true],
  ];
  return {
    name: 'font-preloads',
    apply: 'build',
    transformIndexHtml(_html, ctx) {
      const names = Object.keys(ctx.bundle ?? {});
      return wanted.flatMap(([re, slip]) => {
        const file = names.find((n) => re.test(n));
        if (!file) return [];
        return [
          {
            tag: 'link',
            injectTo: 'head' as const,
            attrs: {
              rel: 'preload',
              as: 'font',
              type: 'font/woff2',
              crossorigin: 'anonymous',
              href: `${base}${file}`,
              ...(slip ? { 'data-default-slip': '' } : {}),
            },
          },
        ];
      });
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), vercelHeaders(base), fontPreloads(), ...(process.env.VITEST ? [] : [pwa])],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Bundle budget (D37): pdf-lib's unused standard-font metrics and PNG codec are stubbed.
      '@pdf-lib/standard-fonts': fileURLToPath(
        new URL('./src/features/export/stubs/standard-fonts.ts', import.meta.url),
      ),
      '@pdf-lib/upng': fileURLToPath(
        new URL('./src/features/export/stubs/upng.ts', import.meta.url),
      ),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    env: { TZ: testTz },
    setupFiles: ['./tests/setup/common.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/index.ts', 'src/main.tsx', 'src/vite-env.d.ts'],
      thresholds: {
        'src/engine/**': { lines: 100, branches: 100, functions: 100, statements: 100 },
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/engine/**/*.test.ts', 'src/db/**/*.test.ts', 'tests/unit/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          setupFiles: ['./tests/setup/dom.ts'],
          include: ['src/*.test.{ts,tsx}', 'src/{ui,features,platform,theme}/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
});
