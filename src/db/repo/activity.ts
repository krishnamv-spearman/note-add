import { db } from '../schema';
import type { ActivityEntry, Epoch } from '../types';

export const ACTIVITY_KEEP = 200;

/**
 * Appends entries; call inside the same transaction as the change (arch §6.3). Trims the
 * table to the latest 200 entries.
 */
export async function appendActivity(
  entries: readonly Omit<ActivityEntry, 'id' | 'at'>[],
  at: Epoch,
): Promise<void> {
  await db.activity.bulkAdd(entries.map((e) => ({ ...e, at })));
  const count = await db.activity.count();
  if (count > ACTIVITY_KEEP) {
    const oldest = await db.activity
      .orderBy('id')
      .limit(count - ACTIVITY_KEEP)
      .primaryKeys();
    await db.activity.bulkDelete(oldest);
  }
}

/** Latest entries, newest first. */
export async function recentActivity(limit = 5): Promise<ActivityEntry[]> {
  return db.activity.orderBy('id').reverse().limit(limit).toArray();
}
