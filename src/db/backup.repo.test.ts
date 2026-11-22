import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';
import { aLine } from '../../tests/builders';
import { DAY_MS } from '@/engine';
import { setClock } from './clock';
import {
  BACKUP_VERSION,
  backupFileName,
  createBackupDocument,
  currentLastChanged,
  inspectBackup,
  inspectBackupText,
  latestSafetyBackup,
  markBackedUp,
  migrateBackup,
  NEWER_VERSION,
  NOT_A_BACKUP,
  restoreBackup,
  undoLastRestore,
  UNSUPPORTED_VERSION,
} from './repo/backup';
import { createNotebook } from './repo/notebooks';
import { loadPages, updateLine } from './repo/pages';
import { dismissReminder, reminderInput, shouldShowReminder } from './repo/reminder';
import { getSettings } from './repo/settings';
import { db, resetDb } from './schema';

const FIXTURES = join(import.meta.dirname, '../../tests/fixtures/backups');
const fixture = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');
const VALID = fixture('v1/valid-3-notebooks-21-pages.json');

let nowMs = new Date('2026-11-22T10:00:00+05:30').getTime();
beforeEach(async () => {
  nowMs = new Date('2026-11-22T10:00:00+05:30').getTime();
  setClock(() => new Date(nowMs));
  await resetDb();
});

async function snapshot() {
  return {
    notebooks: await db.notebooks.orderBy('id').toArray(),
    pages: await db.pages.orderBy('id').toArray(),
    activity: (await db.activity.orderBy('id').toArray()).map(({ id: _id, ...a }) => a),
    settings: await getSettings(),
  };
}

async function restoreText(text: string) {
  const r = inspectBackupText(text);
  if (!r.ok) throw new Error(r.message);
  await restoreBackup(r.value.doc);
  return r.value;
}

async function someCurrentData() {
  const r = await createNotebook('Current notes', 'sky');
  if (!r.ok) throw new Error('create');
  const [p] = await loadPages(r.value.notebookId);
  await updateLine(p!.id, 0, aLine('999', 'Keep me'));
}

describe('OLD-01: the committed v1 fixture', () => {
  it('inspects to the documented summary', () => {
    const r = inspectBackupText(VALID);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.summary).toEqual({ notebooks: 3, pages: 21, lastChanged: '2026-11-03' });
      expect(r.value.notes).toEqual([]);
    }
  });

  it('restores in this release', async () => {
    await restoreText(VALID);
    expect(await db.notebooks.count()).toBe(3);
    expect(await db.pages.count()).toBe(21);
    expect((await getSettings()).font).toBe('merriweather');
  });
});

describe('round trip (exit criterion)', () => {
  it('backup → wipe → restore reproduces every notebook, page, colour and setting', async () => {
    await restoreText(VALID); // seed the full fixture
    await db.safetyBackups.clear();
    const before = await snapshot();
    expect(before.pages.some((p) => p.status === 'final' && p.reopenedOn.length > 0)).toBe(true);
    expect(before.pages.some((p) => p.totalUpdatedOn !== null)).toBe(true); // LIF-16
    expect(before.pages.some((p) => p.colour !== null)).toBe(true);

    nowMs += DAY_MS;
    const doc = await createBackupDocument('1.0.0');
    const text = JSON.stringify(doc);
    await resetDb(); // wipe
    expect(await db.notebooks.count()).toBe(0);

    await restoreText(text);
    const after = await snapshot();
    expect(after.notebooks).toEqual(before.notebooks);
    expect(after.pages).toEqual(before.pages);
    // Activity: everything as before, plus one "restore" entry at the end.
    expect(after.activity.slice(0, -1)).toEqual(before.activity);
    expect(after.activity.at(-1)?.kind).toBe('restore');
    // RES-15: lastBackupAt becomes the file's exportedAt; every other setting is identical.
    expect(after.settings).toEqual({
      ...before.settings,
      lastBackupAt: Date.parse(doc.exportedAt),
    });
  });

  it('BAK-05: safety backups are never inside a backup file', async () => {
    await someCurrentData();
    await restoreText(VALID);
    const doc = await createBackupDocument('1.0.0');
    expect(JSON.stringify(doc)).not.toContain('safetyBackups');
    expect(Object.keys(doc.data).sort()).toEqual(['activity', 'notebooks', 'pages', 'settings']);
    expect(doc).toMatchObject({
      format: 'note-add-backup',
      version: BACKUP_VERSION,
      appVersion: '1.0.0',
    });
  });

  it('file name: note-add-backup-<DD-MM-YYYY>.json', () => {
    expect(backupFileName('2026-11-22')).toBe('note-add-backup-22-11-2026.json');
  });

  it('BAK-02 / BAK-03: markBackedUp sets lastBackupAt and logs a backup entry', async () => {
    await markBackedUp(nowMs);
    expect((await getSettings()).lastBackupAt).toBe(nowMs);
    expect((await db.activity.toArray()).at(-1)?.text).toBe('Backup saved, 22/11/2026');
  });
});

describe('bad files are refused with their own message and change nothing', () => {
  const cases: [string, string, string | RegExp][] = [
    ['RES-01', 'invalid-json.json', NOT_A_BACKUP],
    ['RES-03', 'wrong-format.json', NOT_A_BACKUP],
    ['RES-04 / OLD-10', 'future-version.json', NEWER_VERSION],
    ['OLD-09', 'version-zero.json', UNSUPPORTED_VERSION],
    ['RES-06', 'tampered-totals.json', /do not add up/],
    ['RES-08', 'missing-notebook.json', /notebook is missing/],
    ['RES-07', 'decimal-amount.json', /invalid data \(data\.pages\.0\.lines\.0\.amountPaise\)/],
    ['RES-07', 'string-amount.json', /invalid data \(data\.pages\.0\.lines\.0\.amountPaise\)/],
    ['RES-08', 'duplicate-ids.json', /two pages with the same ID/],
    ['RES-08', 'page-number-gap.json', /not numbered 1, 2, 3/],
    ['RES-08', 'nine-lines.json', /invalid data \(data\.pages\.0\.lines\)/],
    ['RES-10', 'oversized-string.json', /invalid data \(data\.pages\.0\.lines\.5\.description\)/],
  ];

  it.each(cases)('%s: %s', async (_id, file, message) => {
    await someCurrentData();
    const before = await snapshot();
    const r = await inspectBackup(new Blob([fixture(file)]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(message);
    expect(await snapshot()).toEqual(before);
  });

  it('RES-01: a 0-byte file and a file over 20 MB are refused before reading', async () => {
    expect(await inspectBackup(new Blob([]))).toEqual({ ok: false, message: NOT_A_BACKUP });
    const huge = {
      size: 20 * 1024 * 1024 + 1,
      text: () => Promise.reject(new Error('read')),
    } as Blob;
    const r = await inspectBackup(huge);
    expect(r.ok === false && r.message).toMatch(/over 20 MB/);
  });

  it('RES-01: a photo or PDF is "not a Note-Add backup"', async () => {
    expect(await inspectBackup(new Blob(['%PDF-1.7 ...']))).toEqual({
      ok: false,
      message: NOT_A_BACKUP,
    });
    expect(inspectBackupText('[1,2,3]')).toEqual({ ok: false, message: NOT_A_BACKUP });
    expect(inspectBackupText('null')).toEqual({ ok: false, message: NOT_A_BACKUP });
  });

  it('RES-02: a byte-order mark is stripped', () => {
    expect(inspectBackupText(fixture('byte-order-mark.json')).ok).toBe(true);
  });

  it('RES-09: unknown colour, font and extra fields fall back with notes', () => {
    const r = inspectBackupText(fixture('unknown-cosmetic-fields.json'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.notes).toEqual([
      'Unknown fields in the file were ignored.',
      'Some colours were not recognised and use the default colour.',
      'The font was not recognised; the default font is used.',
    ]);
    expect(r.value.doc.data.notebooks[0]?.colour).toBe('canary');
    expect(r.value.doc.data.settings.font).toBe('carlito');
    expect('sparkles' in (r.value.doc.data.pages[0] as object)).toBe(false);
  });

  it('RES-11: __proto__ keys are ignored and pollute nothing', () => {
    const r = inspectBackupText(fixture('proto-keys.json'));
    expect(r.ok).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    if (r.ok) expect(Object.getPrototypeOf(r.value.doc)).toBe(Object.prototype);
  });

  it('a restore over the money limit is refused', () => {
    const doc = JSON.parse(VALID);
    doc.data.pages[0].lines[0].amountPaise = 100_000_000_000;
    expect(inspectBackupText(JSON.stringify(doc)).ok).toBe(false);
  });

  it('empty.json (0 bytes) is refused', async () => {
    expect((await inspectBackup(new Blob([fixture('empty.json')]))).ok).toBe(false);
  });
});

describe('restore safety', () => {
  it('RES-12: a restore that fails midway leaves current data untouched', async () => {
    await someCurrentData();
    const before = await snapshot();
    const r = inspectBackupText(VALID);
    if (!r.ok) throw new Error();
    await expect(restoreBackup(r.value.doc, { failAfterClear: true })).rejects.toThrow(
      'forced failure',
    );
    expect(await snapshot()).toEqual(before);
    expect(await db.safetyBackups.count()).toBe(0); // rolled back with everything else
  });

  it('exit criterion: a mistaken restore can be undone — original data back exactly', async () => {
    await someCurrentData();
    const before = await snapshot();
    await restoreText(VALID);
    expect(await db.notebooks.count()).toBe(3);
    const undo = await undoLastRestore();
    expect(undo.ok).toBe(true);
    const after = await snapshot();
    expect(after.notebooks).toEqual(before.notebooks);
    expect(after.pages).toEqual(before.pages);
    expect(after.activity.slice(0, before.activity.length)).toEqual(before.activity);
    expect(after.activity.at(-1)?.text).toBe('Last restore undone, 22/11/2026');
  });

  it('RES-14: the undo can itself be undone', async () => {
    await someCurrentData();
    await restoreText(VALID);
    await undoLastRestore();
    expect(await db.notebooks.count()).toBe(1);
    await undoLastRestore();
    expect(await db.notebooks.count()).toBe(3);
  });

  it('RES-13 / RES-16 / P6.4: empty data still gets a safety backup; latest 3 kept', async () => {
    for (let i = 0; i < 5; i++) await restoreText(VALID); // same file restored repeatedly
    expect(await db.safetyBackups.count()).toBe(3);
    expect(await latestSafetyBackup()).not.toBeNull();
    await resetDb();
    await restoreText(VALID);
    expect(await db.safetyBackups.count()).toBe(1);
  });

  it('nothing to undo', async () => {
    expect(await undoLastRestore()).toEqual({ ok: false, message: 'There is no restore to undo.' });
  });

  it('OLD-12: current data last changed', async () => {
    expect(await currentLastChanged()).toBeNull();
    await someCurrentData();
    expect(await currentLastChanged()).toBe('2026-11-22');
  });
});

describe('old backups (arch §9.4)', () => {
  it('OLD-06: fields missing from an early v1 file get defaults from the migration', () => {
    const doc = JSON.parse(VALID);
    for (const p of doc.data.pages) {
      delete p.reopenedOn;
      delete p.totalUpdatedOn;
    }
    const r = inspectBackupText(JSON.stringify(doc));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.doc.data.pages.every((p) => Array.isArray(p.reopenedOn))).toBe(true);
      expect(r.value.doc.data.pages.every((p) => p.totalUpdatedOn === null)).toBe(true);
    }
  });

  it('OLD-02: a v1 file from a later app version (1.3) restores through the v1 path', () => {
    const doc = JSON.parse(VALID);
    doc.appVersion = '1.3.0';
    expect(inspectBackupText(JSON.stringify(doc)).ok).toBe(true);
  });

  it('OLD-04: migration never changes an amount, line, page number or status', () => {
    type Doc = { data: { pages: Record<string, unknown>[] } } & Record<string, unknown>;
    const base = JSON.parse(VALID) as Doc;
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 21, maxLength: 21 }), (dropFields) => {
        const doc = structuredClone(base);
        doc.data.pages.forEach((p: Record<string, unknown>, i: number) => {
          if (dropFields[i]) delete p.reopenedOn;
        });
        const migrated = migrateBackup(
          doc as Parameters<typeof migrateBackup>[0],
        ) as unknown as Doc;
        migrated.data.pages.forEach((p: Record<string, unknown>, i: number) => {
          const o = base.data.pages[i]!;
          expect(p.lines).toEqual(o.lines);
          expect([p.number, p.status, p.totalPaise, p.broughtForwardPaise]).toEqual([
            o.number,
            o.status,
            o.totalPaise,
            o.broughtForwardPaise,
          ]);
        });
      }),
    );
  });

  it('OLD-05 / OLD-13: an old safety backup goes through the same validation', async () => {
    await db.safetyBackups.add({ createdAt: nowMs, json: fixture('tampered-totals.json') });
    const r = await undoLastRestore();
    expect(r.ok === false && r.message).toMatch(/do not add up/);
  });
});

describe('backup reminder (arch §9.5)', () => {
  const base = { hasData: true, firstDataAt: 0, lastBackupAt: null, dismissedAt: null, now: 0 };

  it('REM-01: has data, never backed up → after 30 days from the first data', () => {
    expect(shouldShowReminder({ ...base, now: 30 * DAY_MS })).toBe(false);
    expect(shouldShowReminder({ ...base, now: 31 * DAY_MS })).toBe(true);
  });

  it('backed up recently → hidden; 31 days after the last backup → shown', () => {
    expect(shouldShowReminder({ ...base, lastBackupAt: 20 * DAY_MS, now: 40 * DAY_MS })).toBe(
      false,
    );
    expect(shouldShowReminder({ ...base, lastBackupAt: 9 * DAY_MS, now: 40 * DAY_MS })).toBe(true);
  });

  it('REM-03: dismissed → hidden for 30 days', () => {
    const now = 60 * DAY_MS;
    expect(shouldShowReminder({ ...base, dismissedAt: now - DAY_MS, now })).toBe(false);
    expect(shouldShowReminder({ ...base, dismissedAt: now - 31 * DAY_MS, now })).toBe(true);
  });

  it('REM-02 / DAT-05: no data, or a clock moved backwards → no banner', () => {
    expect(shouldShowReminder({ ...base, hasData: false, now: 99 * DAY_MS })).toBe(false);
    expect(shouldShowReminder({ ...base, firstDataAt: 50 * DAY_MS, now: 10 * DAY_MS })).toBe(false);
    expect(shouldShowReminder({ ...base, firstDataAt: null, now: 99 * DAY_MS })).toBe(false);
    expect(shouldShowReminder({ ...base, dismissedAt: 99 * DAY_MS, now: 40 * DAY_MS })).toBe(true);
  });

  it('REM-02: an empty notebook is not data; a line with content is', async () => {
    await createNotebook('Empty');
    expect((await reminderInput(nowMs)).hasData).toBe(false);
    await someCurrentData();
    const input = await reminderInput(nowMs + 31 * DAY_MS);
    expect(input.hasData).toBe(true);
    expect(shouldShowReminder(input)).toBe(true);
    await dismissReminder(nowMs + 31 * DAY_MS);
    expect(shouldShowReminder(await reminderInput(nowMs + 32 * DAY_MS))).toBe(false);
  });
});
