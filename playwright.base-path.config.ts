import { defineConfig, devices } from '@playwright/test';

/**
 * PWA-09: the whole app built and served under `/note-add/` (the `spearman.in/note-add`
 * option, arch §10.2). One extra build with VITE_BASE set; run with `npm run test:e2e:base`.
 */
const port = 4174;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'base-path.spec.ts',
  timeout: 45_000,
  expect: { timeout: 7_000 },
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${port}/note-add/`,
    serviceWorkers: 'allow',
    timezoneId: 'Asia/Kolkata',
    locale: 'en-IN',
  },
  projects: [{ name: 'chromium-base-path', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite build --outDir dist-base && npx vite preview --outDir dist-base --port ${port} --strictPort`,
    url: `http://localhost:${port}/note-add/`,
    env: { VITE_BASE: '/note-add/' },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
