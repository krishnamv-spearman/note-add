/**
 * Writes tests/fixtures/backups/ from the app's own code (P6.8). Run once with
 *   GENERATE_FIXTURES=1 npx vitest run tests/unit/generate-fixtures.test.ts
 * The v1 files are committed and must keep restoring in every later release (OLD-01).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';
import { aLine } from '../builders';
import {
  appendPage,
  createNotebook,
  finalisePage,
  loadPages,
  reopenPage,
  resetDb,
  setClock,
  updateLine,
  updatePageHeader,
  updateSettings,
} from '../../src/db';
import { createBackupDocument } from '../../src/db/repo/backup';

const DIR = join(import.meta.dirname, '../fixtures/backups');

it.skipIf(!process.env.GENERATE_FIXTURES)('generate backup fixtures', async () => {
  let t = new Date('2026-11-01T09:00:00+05:30').getTime();
  setClock(() => new Date(t));
  const tick = () => {
    t += 3_600_000;
  };
  await resetDb();

  const specs: [string, 'canary' | 'mint' | 'peach', number][] = [
    ['Pune trip claims', 'mint', 9],
    ['Office petty cash', 'canary', 7],
    ['Groceries', 'peach', 5],
  ];
  for (const [n, [name, colour, count]] of specs.entries()) {
    const r = await createNotebook(name, colour);
    if (!r.ok) throw new Error('create');
    const id = r.value.notebookId;
    for (let i = 1; i < count; i++) {
      tick();
      await appendPage(id);
    }
    const pages = await loadPages(id);
    for (const [i, p] of pages.entries()) {
      tick();
      await updateLine(p.id, 0, aLine(`${(n + 1) * 100 + i}.50`, `Item ${i + 1}`));
      await updateLine(
        p.id,
        1,
        aLine(i % 3 === 0 ? '-125.25' : '1,280.75', i % 3 === 0 ? 'Refund' : 'Hotel'),
      );
      if (i % 4 === 1) await updateLine(p.id, 2, aLine('12a', 'Unclear receipt'));
      if (i === 0) await updatePageHeader(p.id, { title: `${name} — start` });
      if (i === 2) await updatePageHeader(p.id, { colour: 'lavender' });
    }
    // Final and reopened pages (no invalid amounts on them).
    const [first, second, third] = await loadPages(id);
    tick();
    await finalisePage(first!.id);
    await finalisePage(third!.id);
    tick();
    await reopenPage(third!.id);
    await finalisePage(third!.id);
    // A Final page whose total was updated by an earlier page (totalUpdatedOn set).
    tick();
    await updateLine(second!.id, 3, aLine('10', 'Late tip'));
  }
  await updateSettings({ font: 'merriweather', lastBackupAt: null });

  const doc = await createBackupDocument('1.0.0');
  mkdirSync(join(DIR, 'v1'), { recursive: true });
  const valid = JSON.stringify(doc, null, 2);
  writeFileSync(join(DIR, 'v1', 'valid-3-notebooks-21-pages.json'), valid);

  const base = JSON.parse(valid) as typeof doc;
  const write = (name: string, value: unknown) =>
    writeFileSync(
      join(DIR, name),
      typeof value === 'string' ? value : JSON.stringify(value, null, 2),
    );
  const clone = () => JSON.parse(valid) as typeof doc;

  write('invalid-json.json', valid.slice(0, 200));
  write('wrong-format.json', { ...base, format: 'something-else' });
  write('future-version.json', { ...base, version: 2 });
  write('version-zero.json', { ...base, version: 0 });
  const tampered = clone();
  tampered.data.pages[3]!.totalPaise = (tampered.data.pages[3]!.totalPaise + 100) as never;
  write('tampered-totals.json', tampered);
  const missing = clone();
  missing.data.pages[0]!.notebookId = 'no-such-notebook';
  write('missing-notebook.json', missing);
  const decimal = clone();
  (decimal.data.pages[0]!.lines[0] as { amountPaise: unknown }).amountPaise = 450.5;
  write('decimal-amount.json', decimal);
  const str = clone();
  (str.data.pages[0]!.lines[0] as { amountPaise: unknown }).amountPaise = '45050';
  write('string-amount.json', str);
  const dup = clone();
  dup.data.pages[1]!.id = dup.data.pages[0]!.id;
  write('duplicate-ids.json', dup);
  const gap = clone();
  gap.data.pages.find((p) => p.number === 2)!.number = 99;
  write('page-number-gap.json', gap);
  const lines = clone();
  lines.data.pages[0]!.lines.pop();
  write('nine-lines.json', lines);
  const big = clone();
  big.data.pages[0]!.lines[5]!.description = 'x'.repeat(200_000);
  write('oversized-string.json', big);
  write('byte-order-mark.json', '﻿' + valid);
  const cosmetic = clone();
  (cosmetic.data.notebooks[0] as { colour: string }).colour = 'neon';
  (cosmetic.data.settings as { font: string }).font = 'comic-sans';
  (cosmetic.data.pages[0] as unknown as Record<string, unknown>).sparkles = true;
  write('unknown-cosmetic-fields.json', cosmetic);
  write(
    'proto-keys.json',
    valid.replace(
      '"format": "note-add-backup",',
      '"format": "note-add-backup", "__proto__": { "polluted": true },',
    ),
  );
  writeFileSync(join(DIR, 'empty.json'), '');
});
