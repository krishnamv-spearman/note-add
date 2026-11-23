import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

interface VercelHeaders {
  headers: { source: string; headers: { key: string; value: string }[] }[];
}

/**
 * SEC-02: `vite preview` does not read vercel.json, so the same headers (CSP included)
 * are applied here. E2E tests therefore run under the real production CSP.
 */
function productionHeaders(): Record<string, string> {
  const vercel = JSON.parse(
    readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'),
  ) as VercelHeaders;
  const all = vercel.headers.find((h) => h.source === '/(.*)');
  return Object.fromEntries((all?.headers ?? []).map((h) => [h.key, h.value]));
}

const testTz = process.env.TEST_TZ ?? 'Asia/Kolkata';

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
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
  preview: {
    headers: productionHeaders(),
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
