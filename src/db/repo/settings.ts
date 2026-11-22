import { db } from '../schema';
import { DEFAULT_SETTINGS, FONT_IDS, type Settings } from '../types';

/** Reads the single settings row; cosmetic fields fall back to defaults. */
export async function getSettings(): Promise<Settings> {
  const row = await db.settings.get('settings');
  if (!row) return { ...DEFAULT_SETTINGS };
  const { key: _key, ...rest } = row;
  return {
    ...DEFAULT_SETTINGS,
    ...rest,
    font: FONT_IDS.includes(rest.font) ? rest.font : DEFAULT_SETTINGS.font,
  };
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = await getSettings();
    await db.settings.put({ ...current, ...patch, key: 'settings' });
  });
}

/**
 * Target of the bottom-nav "New page": the last opened notebook; if it was deleted, the most
 * recently updated one (NB-06); null when there are no notebooks.
 */
export async function newPageTarget(): Promise<string | null> {
  const { lastOpenedNotebookId } = await getSettings();
  if (lastOpenedNotebookId && (await db.notebooks.get(lastOpenedNotebookId))) {
    return lastOpenedNotebookId;
  }
  return (await db.notebooks.orderBy('updatedAt').last())?.id ?? null;
}
