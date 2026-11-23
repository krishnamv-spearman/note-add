// Prints what Lighthouse found for one URL path from the last `npm run lhci`: layout shifts,
// the LCP element and its phases, and the biggest requests. Usage: node scripts/lhci-detail.mjs /settings
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const arg = process.argv[2] ?? '/';
const path = arg.startsWith('/') ? arg : `/${arg}`; // Git Bash rewrites a leading slash into a Windows path
const dir = '.lighthouseci';
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
const run = manifest.find((r) => new URL(r.url).pathname === path && r.isRepresentativeRun);
if (!run) throw new Error(`no report for ${path}`);
const a = JSON.parse(readFileSync(join(dir, basename(run.jsonPath)), 'utf8')).audits;

const items = (id) => a[id]?.details?.items ?? [];
console.log(
  `== ${path}: LCP ${Math.round(a['largest-contentful-paint'].numericValue)} ms, CLS ${a['cumulative-layout-shift'].numericValue.toFixed(3)}`,
);
console.log('-- layout shifts');
for (const i of items('layout-shifts')) {
  console.log(
    `  ${Number(i.score).toFixed(3)}  ${i.node?.selector ?? ''}  ${(i.node?.snippet ?? '').slice(0, 90)}`,
  );
}
console.log('-- LCP element and breakdown');
for (const table of a['largest-contentful-paint-element']?.details?.items ?? []) {
  for (const row of table.items ?? []) {
    if (row.node) console.log(`  ${row.node.selector}  ${(row.node.snippet ?? '').slice(0, 90)}`);
    else console.log('  ' + JSON.stringify(row).slice(0, 200));
  }
}
console.log('-- network (largest)');
for (const r of items('network-requests')
  .sort((x, y) => y.transferSize - x.transferSize)
  .slice(0, 8)) {
  console.log(
    `  ${String(Math.round(r.transferSize / 1024)).padStart(5)} KB  ${Math.round(r.networkEndTime - r.networkRequestTime)} ms  ${new URL(r.url).pathname}`,
  );
}
console.log('-- critical request chain depth / render-blocking');
for (const r of items('render-blocking-resources'))
  console.log(`  blocking ${r.url} wasted ${Math.round(r.wastedMs)} ms`);
