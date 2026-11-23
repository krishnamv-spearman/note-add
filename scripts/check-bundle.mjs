// Bundle budgets (arch §14, plan P7.8; D37). Run after `npm run build`:  npm run size
//  - initial JS (every script the entry HTML loads, incl. modulepreload) ≤ 150 KB gzip
//  - lazy export chunk (exporter-*.js, which holds pdf-lib and the renderers)  ≤ 250 KB gzip
// Sizes use zlib's default gzip level, the same as Vite's build report.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = process.argv[2] ?? 'dist';
const KB = 1024;
const budgets = { initial: 150 * KB, exporter: 250 * KB };

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="[^"]*?\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
const gz = (rel) => gzipSync(readFileSync(join(dist, rel))).length;

const initialFiles = [...new Set(refs)];
const initial = initialFiles.reduce((sum, f) => sum + gz(f), 0);
const exporterFile = readdirSync(join(dist, 'assets')).find((f) => /^exporter-.*\.js$/.test(f));
const exporter = exporterFile ? gz(`assets/${exporterFile}`) : 0;

const row = (label, size, budget) => {
  const ok = size <= budget;
  console.log(
    `${ok ? 'OK  ' : 'FAIL'} ${label.padEnd(26)} ${(size / KB).toFixed(1).padStart(7)} KB gzip (budget ${budget / KB} KB)`,
  );
  return ok;
};
console.log(`initial scripts: ${initialFiles.join(', ')}`);
const results = [
  row('initial JS', initial, budgets.initial),
  row('export chunk', exporter, budgets.exporter),
];
if (!exporterFile) {
  console.log('FAIL export chunk not found in dist/assets');
  results.push(false);
}
process.exit(results.every(Boolean) ? 0 : 1);
