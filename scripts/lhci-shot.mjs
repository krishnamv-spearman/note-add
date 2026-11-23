// Saves the final screenshot of one URL path from the last `npm run lhci` (default /settings).
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const arg = process.argv[2] ?? '/';
const path = arg.startsWith('/') ? arg : `/${arg}`;
const out = process.argv[3] ?? 'lighthouse-final.jpg';
const dir = '.lighthouseci';
const run = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')).find(
  (r) => new URL(r.url).pathname === path && r.isRepresentativeRun,
);
const report = JSON.parse(readFileSync(join(dir, basename(run.jsonPath)), 'utf8'));
const data = report.audits['final-screenshot'].details.data;
writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
console.log(`wrote ${out}`);
