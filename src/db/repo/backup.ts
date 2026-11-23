import { z } from 'zod';
import {
  epochToDisplay,
  isSupportedText,
  isoFromDate,
  isValidIso,
  isWithinLimit,
  LINES_PER_PAGE,
  recalculateChain,
  toDisplay,
} from '@/engine';
import { now, today } from '../clock';
import { db } from '../schema';
import {
  type ActivityEntry,
  COLOUR_IDS,
  DEFAULT_COLOUR,
  DEFAULT_SETTINGS,
  DESCRIPTION_MAX,
  type Epoch,
  FONT_IDS,
  type Notebook,
  NOTEBOOK_NAME_MAX,
  type Page,
  type Settings,
  TITLE_MAX,
} from '../types';
import { appendActivity } from './activity';

// SEC-03: Zod 4 compiles validators with `new Function` unless jitless; the CSP forbids eval.
z.config({ jitless: true });

export const BACKUP_FORMAT = 'note-add-backup';
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
export const SAFETY_KEEP = 3;

export interface BackupSummary {
  notebooks: number;
  pages: number;
  /** ISO local date of the latest change, or null when empty. */
  lastChanged: string | null;
}

export interface BackupData {
  notebooks: Notebook[];
  pages: Page[];
  activity: ActivityEntry[];
  settings: Settings;
}

export interface BackupDocument {
  format: typeof BACKUP_FORMAT;
  version: number;
  appVersion: string;
  exportedAt: string;
  summary: BackupSummary;
  data: BackupData;
}

export const NOT_A_BACKUP = 'This is not a Note-Add backup file.';
export const NEWER_VERSION =
  'This backup was made by a newer version of Note-Add. Update the app and try again.';
export const UNSUPPORTED_VERSION = 'This file is not a supported Note-Add backup.';
export const UNSUPPORTED_TEXT = (where: string): string =>
  `This backup contains text Note-Add can't show yet (${where}). Only English text is supported for now, so nothing was restored.`;

function summarise(data: Pick<BackupData, 'notebooks' | 'pages'>): BackupSummary {
  const latest = Math.max(
    -Infinity,
    ...data.notebooks.map((n) => n.updatedAt),
    ...data.pages.map((p) => p.updatedAt),
  );
  return {
    notebooks: data.notebooks.length,
    pages: data.pages.length,
    lastChanged: Number.isFinite(latest) ? isoFromDate(new Date(latest)) : null,
  };
}

async function readAll(): Promise<BackupData> {
  // Safety backups are never part of a backup (BAK-05).
  return db.transaction('r', db.notebooks, db.pages, db.activity, db.settings, async () => {
    const [notebooks, pages, activity, row] = await Promise.all([
      db.notebooks.toArray(),
      db.pages.toArray(),
      db.activity.orderBy('id').toArray(),
      db.settings.get('settings'),
    ]);
    const { key: _key, ...settings } = row ?? { ...DEFAULT_SETTINGS, key: 'settings' as const };
    return { notebooks, pages, activity, settings: { ...DEFAULT_SETTINGS, ...settings } };
  });
}

/** P6.2: the whole database (except safety backups) as one JSON document. */
export async function createBackupDocument(appVersion: string): Promise<BackupDocument> {
  const data = await readAll();
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    appVersion,
    exportedAt: new Date(now()).toISOString(),
    summary: summarise(data),
    data,
  };
}

export const backupFileName = (isoDay: string = today()): string =>
  `note-add-backup-${toDisplay(isoDay).replaceAll('/', '-')}.json`;

/** BAK-02 / BAK-03: call only after the file was shared or its download started. */
export async function markBackedUp(at: Epoch = now()): Promise<void> {
  await db.transaction('rw', db.settings, db.activity, async () => {
    const row = await db.settings.get('settings');
    await db.settings.put({ ...DEFAULT_SETTINGS, ...row, lastBackupAt: at, key: 'settings' });
    await appendActivity(
      [
        {
          kind: 'backup',
          notebookId: null,
          pageId: null,
          text: `Backup saved, ${epochToDisplay(at)}`,
        },
      ],
      at,
    );
  });
}

// ---------------------------------------------------------------------------------------------
// Validation (arch §9.2 step 4): money strict, cosmetic forgiving.

const paise = z
  .number()
  .refine((n) => Number.isSafeInteger(n) && isWithinLimit(n), 'not a whole number of paise');
const isoDate = z.string().refine(isValidIso, 'not a date');
const epoch = z.number().finite();

const lineSchema = z.object({
  description: z.string().max(DESCRIPTION_MAX),
  amountText: z.string().max(1000),
  amountPaise: paise.nullable(),
});

const notebookSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(NOTEBOOK_NAME_MAX),
  colour: z.string().max(40),
  createdAt: epoch,
  updatedAt: epoch,
});

const pageSchema = z.object({
  id: z.string().min(1).max(100),
  notebookId: z.string().min(1).max(100),
  number: z.number().int().min(1),
  date: isoDate,
  title: z.string().max(TITLE_MAX).nullable(),
  colour: z.string().max(40).nullable(),
  lines: z.array(lineSchema).length(LINES_PER_PAGE),
  status: z.enum(['draft', 'final']),
  finalisedOn: isoDate.nullable(),
  reopenedOn: z.array(isoDate).max(1000),
  totalUpdatedOn: isoDate.nullable(),
  broughtForwardPaise: paise,
  totalPaise: paise,
  createdAt: epoch,
  updatedAt: epoch,
});

const activitySchema = z.object({
  id: z.number().int().optional(),
  at: epoch,
  kind: z.enum([
    'notebook-created',
    'notebook-renamed',
    'page-created',
    'page-finalised',
    'page-reopened',
    'page-deleted',
    'restore',
    'backup',
  ]),
  notebookId: z.string().max(100).nullable(),
  pageId: z.string().max(100).nullable(),
  text: z.string().max(500),
});

const settingsSchema = z.object({
  font: z.string().max(40).optional(),
  lastBackupAt: epoch.nullable().optional(),
  backupReminderDismissedAt: epoch.nullable().optional(),
  installHintDismissedAt: epoch.nullable().optional(),
  lastOpenedNotebookId: z.string().max(100).nullable().optional(),
});

const documentSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number(),
  appVersion: z.string().max(40),
  exportedAt: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'not a time'),
  data: z.object({
    notebooks: z.array(notebookSchema).max(10_000),
    pages: z.array(pageSchema).max(200_000),
    activity: z.array(z.unknown()).max(10_000).optional(),
    settings: settingsSchema.optional(),
  }),
});

type RawDocument = { version: unknown; data?: { pages?: unknown } } & Record<string, unknown>;

/**
 * Arch §9.4: a chain of pure steps v1 → … → current. A step may add fields with defaults or
 * reshape data but never change an amount, line, page number or status (OLD-04).
 * v1 is current; its step fills fields that very early v1 files could miss (OLD-06).
 */
export function migrateBackup(raw: RawDocument): RawDocument {
  if (raw.version === 1) {
    const pages = Array.isArray(raw.data?.pages)
      ? (raw.data.pages as Record<string, unknown>[])
      : null;
    if (!pages) return raw;
    return {
      ...raw,
      data: {
        ...raw.data,
        pages: pages.map((p) => ({
          ...p,
          reopenedOn: p.reopenedOn ?? [],
          totalUpdatedOn: p.totalUpdatedOn ?? null,
          finalisedOn: p.finalisedOn ?? null,
          colour: p.colour ?? null,
          title: p.title ?? null,
        })),
      },
    };
  }
  return raw;
}

export interface Inspection {
  doc: BackupDocument;
  summary: BackupSummary;
  /** RES-09 / OLD-07: cosmetic fallbacks applied. */
  notes: string[];
}

export type InspectResult = { ok: true; value: Inspection } | { ok: false; message: string };

const fail = (message: string): InspectResult => ({ ok: false, message });

function issuesText(error: z.ZodError): string {
  const first = error.issues[0];
  const where = first?.path.join('.') ?? '';
  return `This backup has invalid data${where ? ` (${where})` : ''}, so nothing was restored.`;
}

const KNOWN_PAGE_KEYS = new Set(Object.keys(pageSchema.shape));
const KNOWN_NOTEBOOK_KEYS = new Set(Object.keys(notebookSchema.shape));

/** Arch §9.2 steps 2–5 on the text of a file (BOM stripped, RES-02). */
export function inspectBackupText(text: string): InspectResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    return fail(NOT_A_BACKUP);
  }
  if (
    !raw ||
    typeof raw !== 'object' ||
    (raw as Record<string, unknown>).format !== BACKUP_FORMAT
  ) {
    return fail(NOT_A_BACKUP); // RES-01, RES-03
  }
  const version = (raw as RawDocument).version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return fail(UNSUPPORTED_VERSION); // OLD-09
  }
  if (version > BACKUP_VERSION) return fail(NEWER_VERSION); // RES-04
  const migrated = migrateBackup(raw as RawDocument);

  const parsed = documentSchema.safeParse(migrated);
  if (!parsed.success) return fail(issuesText(parsed.error)); // RES-07, RES-08, RES-10
  const input = parsed.data;
  const notes: string[] = [];

  const rawPages = (migrated.data?.pages ?? []) as Record<string, unknown>[];
  const rawNotebooks = ((migrated.data as Record<string, unknown>).notebooks ?? []) as Record<
    string,
    unknown
  >[];
  const extra =
    rawPages.some((p) => Object.keys(p).some((k) => !KNOWN_PAGE_KEYS.has(k))) ||
    rawNotebooks.some((n) => Object.keys(n).some((k) => !KNOWN_NOTEBOOK_KEYS.has(k)));
  if (extra) notes.push('Unknown fields in the file were ignored.');

  // TXT-05 (decided 23/11/2026): text fields are strict, like money. One bad name, title or
  // description refuses the whole file.
  for (const n of input.data.notebooks) {
    if (!isSupportedText(n.name)) return fail(UNSUPPORTED_TEXT(`notebook name “${n.name}”`));
  }
  for (const p of input.data.pages) {
    const nbName = input.data.notebooks.find((n) => n.id === p.notebookId)?.name ?? 'a notebook';
    if (p.title !== null && !isSupportedText(p.title)) {
      return fail(UNSUPPORTED_TEXT(`title of page ${p.number} in “${nbName}”`));
    }
    const line = p.lines.findIndex((l) => !isSupportedText(l.description));
    if (line !== -1) {
      return fail(UNSUPPORTED_TEXT(`line ${line + 1} of page ${p.number} in “${nbName}”`));
    }
  }

  // Duplicate IDs (RES-08)
  const nbIds = new Set<string>();
  for (const n of input.data.notebooks) {
    if (nbIds.has(n.id))
      return fail(`This backup has two notebooks with the same ID, so nothing was restored.`);
    nbIds.add(n.id);
  }
  const pageIds = new Set<string>();
  for (const p of input.data.pages) {
    if (pageIds.has(p.id))
      return fail(`This backup has two pages with the same ID, so nothing was restored.`);
    pageIds.add(p.id);
    if (!nbIds.has(p.notebookId)) {
      return fail('This backup has a page whose notebook is missing, so nothing was restored.');
    }
  }

  // Cosmetic fields: unknown colours and fonts fall back (RES-09, OLD-07).
  let colourFallback = false;
  const notebooks: Notebook[] = input.data.notebooks.map((n) => {
    const known = (COLOUR_IDS as readonly string[]).includes(n.colour);
    colourFallback ||= !known;
    return { ...n, colour: known ? (n.colour as Notebook['colour']) : DEFAULT_COLOUR };
  });
  const pages: Page[] = input.data.pages.map((p) => {
    const known = p.colour === null || (COLOUR_IDS as readonly string[]).includes(p.colour);
    colourFallback ||= !known;
    return {
      ...p,
      colour: known ? (p.colour as Page['colour']) : null,
      lines: p.lines.map((l) => ({ ...l })),
    } as Page;
  });
  if (colourFallback) notes.push('Some colours were not recognised and use the default colour.');

  const s = input.data.settings ?? {};
  const fontKnown = s.font === undefined || (FONT_IDS as readonly string[]).includes(s.font);
  if (!fontKnown) notes.push('The font was not recognised; the default font is used.');
  const settings: Settings = {
    font: fontKnown && s.font ? (s.font as Settings['font']) : DEFAULT_SETTINGS.font,
    lastBackupAt: s.lastBackupAt ?? null,
    backupReminderDismissedAt: s.backupReminderDismissedAt ?? null,
    installHintDismissedAt: s.installHintDismissedAt ?? null,
    lastOpenedNotebookId:
      s.lastOpenedNotebookId && nbIds.has(s.lastOpenedNotebookId) ? s.lastOpenedNotebookId : null,
  };

  const activity: ActivityEntry[] = [];
  let droppedActivity = false;
  for (const a of input.data.activity ?? []) {
    const r = activitySchema.safeParse(a);
    // Activity text is cosmetic: entries with unsupported text are left out, with a note.
    if (r.success && isSupportedText(r.data.text)) {
      const { id: _id, ...entry } = r.data;
      activity.push(entry);
    } else droppedActivity = true;
  }
  if (droppedActivity)
    notes.push('Some recent-activity entries could not be read and were left out.');

  // Contiguous page numbers per notebook, then recompute every chain (arch §9.2 step 5).
  for (const nb of notebooks) {
    const own = pages.filter((p) => p.notebookId === nb.id).sort((a, b) => a.number - b.number);
    if (own.length === 0) {
      return fail(`Notebook “${nb.name}” in this backup has no pages, so nothing was restored.`);
    }
    if (own.some((p, i) => p.number !== i + 1)) {
      return fail(`The pages of “${nb.name}” are not numbered 1, 2, 3…, so nothing was restored.`);
    }
    const chain = recalculateChain(own, today());
    if (chain.error) {
      return fail(`A total in “${nb.name}” is over ₹99.99 crore, so nothing was restored.`);
    }
    const mismatch = chain.pages.some(
      (p, i) =>
        p.broughtForwardPaise !== own[i]?.broughtForwardPaise ||
        p.totalPaise !== own[i]?.totalPaise,
    );
    if (mismatch) {
      // RES-06: never silently "fix" someone's money.
      return fail(
        `The totals in “${nb.name}” do not add up. The file may have been edited or damaged, so nothing was restored.`,
      );
    }
  }

  const data: BackupData = { notebooks, pages, activity, settings };
  const doc: BackupDocument = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    appVersion: input.appVersion,
    exportedAt: input.exportedAt,
    summary: summarise(data), // recomputed, never trusted
    data,
  };
  return { ok: true, value: { doc, summary: doc.summary, notes } };
}

/** RES-01: size checks before reading; then the text pipeline. */
export async function inspectBackup(file: Blob): Promise<InspectResult> {
  if (file.size === 0) return fail(NOT_A_BACKUP);
  if (file.size > MAX_BACKUP_BYTES)
    return fail('This file is too large to be a Note-Add backup (over 20 MB).');
  return inspectBackupText(await file.text());
}

export interface RestoreOptions {
  /** Text of the restore activity entry. */
  label?: string;
  /** Tests only: throw after clearing, to prove the transaction rolls back (RES-12). */
  failAfterClear?: boolean;
}

/**
 * P6.4: in one transaction, save the current data as a safety backup (latest 3 kept), clear
 * the tables and insert the backup. If anything fails, nothing changes. `lastBackupAt` is set
 * to the file's `exportedAt` (RES-15).
 */
export async function restoreBackup(
  doc: BackupDocument,
  options: RestoreOptions = {},
): Promise<void> {
  const current = JSON.stringify(await createBackupDocument('safety'));
  const t = now();
  await db.transaction(
    'rw',
    [db.notebooks, db.pages, db.activity, db.settings, db.safetyBackups],
    async () => {
      await db.safetyBackups.add({ createdAt: t, json: current });
      const ids = await db.safetyBackups.orderBy('id').primaryKeys();
      if (ids.length > SAFETY_KEEP)
        await db.safetyBackups.bulkDelete(ids.slice(0, ids.length - SAFETY_KEEP));

      await Promise.all([
        db.notebooks.clear(),
        db.pages.clear(),
        db.activity.clear(),
        db.settings.clear(),
      ]);
      if (options.failAfterClear) throw new Error('forced failure');
      await db.notebooks.bulkAdd(doc.data.notebooks);
      await db.pages.bulkAdd(doc.data.pages);
      await db.activity.bulkAdd(doc.data.activity.map(({ id: _id, ...a }) => a));
      const exported = Date.parse(doc.exportedAt);
      await db.settings.put({
        ...doc.data.settings,
        lastBackupAt: Number.isNaN(exported) ? doc.data.settings.lastBackupAt : exported,
        key: 'settings',
      });
      await appendActivity(
        [
          {
            kind: 'restore',
            notebookId: null,
            pageId: null,
            text:
              options.label ??
              `Backup from ${epochToDisplay(exported)} restored, ${epochToDisplay(t)}`,
          },
        ],
        t,
      );
    },
  );
}

export async function latestSafetyBackup(): Promise<{
  id: number;
  createdAt: Epoch;
  json: string;
} | null> {
  const last = await db.safetyBackups.orderBy('id').last();
  return last?.id === undefined
    ? null
    : { id: last.id, createdAt: last.createdAt, json: last.json };
}

/**
 * P6.5 / RES-14: restores the latest safety backup through the same pipeline (so old safety
 * copies migrate too, OLD-13). The restore itself saves the current data first, so an undo can
 * be undone.
 */
export async function undoLastRestore(): Promise<InspectResult> {
  const safety = await latestSafetyBackup();
  if (!safety) return fail('There is no restore to undo.');
  const inspected = inspectBackupText(safety.json);
  if (!inspected.ok) return inspected;
  await restoreBackup(inspected.value.doc, {
    label: `Last restore undone, ${epochToDisplay(now())}`,
  });
  await db.safetyBackups.delete(safety.id);
  return inspected;
}

/** OLD-12: the backup's last change is older than the current data's last change. */
export async function currentLastChanged(): Promise<string | null> {
  const nb = await db.notebooks.orderBy('updatedAt').last();
  return nb ? isoFromDate(new Date(nb.updatedAt)) : null;
}
