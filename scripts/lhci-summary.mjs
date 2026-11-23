// Prints the scores and key timings from the last `npm run lhci` (reports in .lighthouseci/).
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const dir = '.lighthouseci';
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
for (const run of manifest) {
  const report = JSON.parse(readFileSync(join(dir, basename(run.jsonPath)), 'utf8'));
  const a = report.audits;
  const ms = (id) => Math.round(a[id].numericValue);
  const s = run.summary;
  console.log(
    `${new URL(run.url).pathname.padEnd(10)} ${run.isRepresentativeRun ? 'median' : '      '}` +
      `  performance ${s.performance}  accessibility ${s.accessibility}  best-practices ${s['best-practices']}` +
      `  | FCP ${ms('first-contentful-paint')} ms  LCP ${ms('largest-contentful-paint')} ms` +
      `  TBT ${ms('total-blocking-time')} ms  CLS ${a['cumulative-layout-shift'].numericValue.toFixed(3)}`,
  );
}
