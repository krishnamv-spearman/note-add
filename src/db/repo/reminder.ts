import { DAY_MS, isPageEmpty } from '@/engine';
import { db } from '../schema';
import type { Epoch } from '../types';
import { getSettings, updateSettings } from './settings';

export const REMINDER_AFTER_DAYS = 30;

export interface ReminderInput {
  /** REM-02: at least one line with content (an empty notebook does not count). */
  hasData: boolean;
  firstDataAt: Epoch | null;
  lastBackupAt: Epoch | null;
  dismissedAt: Epoch | null;
  now: Epoch;
}

/** Arch §9.5. DAT-05: a clock moved backwards (negative gap) never shows the banner. */
export function shouldShowReminder(r: ReminderInput): boolean {
  if (!r.hasData) return false;
  const since = r.lastBackupAt ?? r.firstDataAt;
  if (since === null) return false;
  const limit = REMINDER_AFTER_DAYS * DAY_MS;
  if (r.now - since <= limit) return false;
  if (r.dismissedAt !== null && r.now - r.dismissedAt >= 0 && r.now - r.dismissedAt < limit) {
    return false;
  }
  return true;
}

export async function reminderInput(now: Epoch): Promise<ReminderInput> {
  const [settings, pages] = await Promise.all([getSettings(), db.pages.toArray()]);
  const withData = pages.filter((p) => !isPageEmpty(p.lines));
  return {
    hasData: withData.length > 0,
    firstDataAt: withData.length ? Math.min(...withData.map((p) => p.createdAt)) : null,
    lastBackupAt: settings.lastBackupAt,
    dismissedAt: settings.backupReminderDismissedAt,
    now,
  };
}

export async function dismissReminder(at: Epoch): Promise<void> {
  await updateSettings({ backupReminderDismissedAt: at });
}
