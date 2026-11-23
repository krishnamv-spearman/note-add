import { defineConfig, devices } from '@playwright/test';

const port = 4173;

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: '**/base-path.spec.ts', // built and served separately: npm run test:e2e:base
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  timeout: 45_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    timezoneId: 'Asia/Kolkata',
    locale: 'en-IN',
    // The service worker is exercised only by pwa/offline/privacy/csp specs (they opt in with
    // test.use({ serviceWorkers: 'allow' })); elsewhere it would cache and bypass page.route.
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
    { name: 'iphone-14', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
