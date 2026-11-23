// Dumps the layout-shift items (with element rectangles) of a URL path from the last lhci run.
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const arg = process.argv[2] ?? '/';
const path = arg.startsWith('/') ? arg : `/${arg}`;
const dir = '.lighthouseci';
const run = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')).find(
  (r) => new URL(r.url).pathname === path && r.isRepresentativeRun,
);
const audits = JSON.parse(readFileSync(join(dir, basename(run.jsonPath)), 'utf8')).audits;
console.log(JSON.stringify(audits['layout-shifts']?.details?.items, null, 1)?.slice(0, 2500));
console.log(
  JSON.stringify(
    audits['cls-culprits-insight']?.details ?? audits['layout-shift-elements']?.details,
    null,
    1,
  )?.slice(0, 2500),
);
