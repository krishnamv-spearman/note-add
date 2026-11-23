/**
 * Lighthouse CI (plan P7.9): mobile preset (Lighthouse's default), against the production build
 * served with the production headers. Lighthouse 12+ has no PWA category; installability,
 * offline and the service worker are covered by tests/e2e/pwa.spec.ts and offline.spec.ts.
 *
 * Local:  npm run build && npm run lhci
 * Chrome: CHROME_PATH, else the Chromium that Playwright installed.
 */
const { chromium } = require('@playwright/test');

const port = 4175;

module.exports = {
  ci: {
    collect: {
      startServerCommand: `npx vite preview --port ${port} --strictPort`,
      startServerReadyPattern: 'Local',
      url: [`http://localhost:${port}/`, `http://localhost:${port}/settings`],
      numberOfRuns: 3,
      settings: {
        chromePath: process.env.CHROME_PATH || chromium.executablePath(),
        chromeFlags: '--no-sandbox --headless=new',
        // Lighthouse's default mobile preset (simulated slow 4G, 4× CPU slowdown).
        onlyCategories: ['performance', 'accessibility', 'best-practices'],
      },
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
      },
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci' },
  },
};
