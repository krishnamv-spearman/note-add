// Renders public/icons/* and public/favicon.svg from the single source scripts/icons/icon.svg.
// Run:  npm run icons   (needs the Playwright Chromium browser; outputs are committed)
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const PAPER = '#FFF4A3';
const svg = readFileSync('scripts/icons/icon.svg', 'utf8');
const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const out = 'public/icons';
mkdirSync(out, { recursive: true });

// scale < 1 shrinks the artwork inside a full-bleed paper square (maskable safe zone).
const targets = [
  { file: 'icon-192.png', size: 192, scale: 1, bg: null },
  { file: 'icon-512.png', size: 512, scale: 1, bg: null },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.72, bg: PAPER },
  { file: 'apple-touch-icon.png', size: 180, scale: 1, bg: PAPER },
  { file: 'favicon-32.png', size: 32, scale: 1, bg: null },
];

const browser = await chromium.launch();
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.size, height: t.size } });
  await page.setContent(
    `<body style="margin:0;width:${t.size}px;height:${t.size}px;display:grid;place-items:center;background:${t.bg ?? 'transparent'}">
       <img id="i" src="${dataUrl}" style="width:${t.size * t.scale}px;height:${t.size * t.scale}px">
     </body>`,
  );
  await page.waitForFunction(() => document.getElementById('i').complete);
  await page.screenshot({ path: join(out, t.file), omitBackground: t.bg === null });
  await page.close();
  console.log(`wrote ${join(out, t.file)} (${t.size}×${t.size})`);
}
await browser.close();
copyFileSync('scripts/icons/icon.svg', 'public/favicon.svg');
console.log('wrote public/favicon.svg');
