import { toDisplay } from '@/engine';
import { today } from '@/db';
import { download, shareAgain, shareOrDownload, type ShareOutcome } from '@/platform/share';

/** The backup module (with Zod) is loaded only when needed, keeping it out of the first load. */
export const backupModule = () => import('@/db/repo/backup');

export interface BackupRun {
  outcome: ShareOutcome;
  file: File;
}

async function backupFile(): Promise<File> {
  const b = await backupModule();
  const doc = await b.createBackupDocument(__APP_VERSION__);
  return new File([JSON.stringify(doc, null, 2)], b.backupFileName(), { type: 'application/json' });
}

async function record(outcome: ShareOutcome): Promise<void> {
  // BAK-02: a cancelled share is not a backup. BAK-03: a started download counts.
  if (outcome === 'shared' || outcome === 'downloaded') await (await backupModule()).markBackedUp();
}

/** P6.2: share menu (Drive, OneDrive, email…) or download; records the backup on success. */
export async function runBackup(): Promise<BackupRun> {
  const file = await backupFile();
  const outcome = await shareOrDownload(file);
  await record(outcome);
  return { outcome, file };
}

/** Second tap after "Your file is ready". */
export async function shareBackupAgain(file: File): Promise<ShareOutcome> {
  const outcome = await shareAgain(file);
  await record(outcome);
  return outcome;
}

/** P6.5: "Download this safety copy". */
export async function downloadSafetyCopy(): Promise<boolean> {
  const safety = await (await backupModule()).latestSafetyBackup();
  if (!safety) return false;
  const name = `note-add-safety-copy-${toDisplay(today()).replaceAll('/', '-')}.json`;
  download(new File([safety.json], name, { type: 'application/json' }));
  return true;
}
