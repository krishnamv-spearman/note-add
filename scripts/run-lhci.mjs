// Runs Lighthouse CI with Playwright's Chromium unless CHROME_PATH is already set.
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';

process.env.CHROME_PATH ||= chromium.executablePath();
const result = spawnSync('npx', ['lhci', 'autorun', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});
process.exit(result.status ?? 1);
