import Dexie, { type EntityTable } from 'dexie';
import type { ActivityEntry, Notebook, Page, SafetyBackup, SettingsRow } from './types';

export const DB_NAME = 'note-add';

export class NoteAddDb extends Dexie {
  notebooks!: EntityTable<Notebook, 'id'>;
  pages!: EntityTable<Page, 'id'>;
  activity!: EntityTable<ActivityEntry, 'id'>;
  settings!: EntityTable<SettingsRow, 'key'>;
  safetyBackups!: EntityTable<SafetyBackup, 'id'>;

  constructor(name = DB_NAME) {
    super(name);
    // Version 1 exactly as arch §4.2. Never edit an old version; add db.version(n) instead.
    this.version(1).stores({
      notebooks: 'id, updatedAt',
      pages: 'id, notebookId, [notebookId+number], status, updatedAt',
      activity: '++id, at',
      settings: 'key',
      safetyBackups: '++id, createdAt',
    });
  }
}

export const db = new NoteAddDb();

type DbEvent = 'version-change';
const listeners = new Set<(e: DbEvent) => void>();

/** Subscribe to database events (MTB-04: a newer version upgraded the schema). */
export function onDbEvent(fn: (e: DbEvent) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// MTB-04: a newer app version wants to upgrade the schema. Close so it is never blocked.
db.on('versionchange', () => {
  db.close();
  listeners.forEach((fn) => fn('version-change'));
  return false;
});

/** Tests only: wipe every table. */
export async function resetDb(): Promise<void> {
  await db.open();
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}
