import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useRef, useState } from 'react';
import { epochToDisplay, toDisplay } from '@/engine';
import { db, getSettings } from '@/db';
import type { Inspection } from '@/db/repo/backup';
import { postToOtherTabs } from '@/platform/broadcast';
import { ConfirmDialog } from '@/ui/Dialog';
import { backupModule, downloadSafetyCopy } from './backupActions';
import { BackupButton } from './BackupButton';

export function summaryText(i: Pick<Inspection, 'summary'>): string {
  const { notebooks, pages, lastChanged } = i.summary;
  const n = `${notebooks} ${notebooks === 1 ? 'notebook' : 'notebooks'}`;
  const p = `${pages} ${pages === 1 ? 'page' : 'pages'}`;
  return lastChanged ? `${n}, ${p}, last changed ${toDisplay(lastChanged)}` : `${n}, ${p}`;
}

interface Pending {
  inspection: Inspection;
  /** OLD-12: current notes changed after the backup was made. */
  currentLastChanged: string | null;
}

/** P6.6: Backup, Restore (file → summary → confirm → done) and Undo last restore. */
export function BackupSection() {
  const inputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const data = useLiveQuery(async () => {
    const [settings, notebooks, safety] = await Promise.all([
      getSettings(),
      db.notebooks.count(),
      db.safetyBackups.count(),
    ]);
    return { lastBackupAt: settings.lastBackupAt, notebooks, safety };
  }, []);
  const [pending, setPending] = useState<Pending | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [confirmUndo, setConfirmUndo] = useState(false);

  const pick = async (file: File | undefined) => {
    setMessage(null);
    if (!file) return;
    const b = await backupModule();
    const r = await b.inspectBackup(file);
    if (fileInput.current) fileInput.current.value = '';
    if (!r.ok) {
      setMessage({ kind: 'error', text: r.message });
      return;
    }
    setPending({ inspection: r.value, currentLastChanged: await b.currentLastChanged() });
  };

  const restore = async () => {
    if (!pending) return;
    const { doc } = pending.inspection;
    setPending(null);
    try {
      await (await backupModule()).restoreBackup(doc);
      postToOtherTabs({ type: 'reload', reason: 'restore' }); // MTB-03 / RES-17
      setMessage({
        kind: 'ok',
        text: `Backup restored: ${summaryText({ summary: doc.summary })}.`,
      });
    } catch {
      setMessage({
        kind: 'error',
        text: 'The restore failed. Your current notes were not changed.',
      });
    }
  };

  const undo = async () => {
    setConfirmUndo(false);
    const r = await (await backupModule()).undoLastRestore();
    if (r.ok) {
      postToOtherTabs({ type: 'reload', reason: 'undo-restore' });
      setMessage({ kind: 'ok', text: 'The last restore was undone.' });
    } else setMessage({ kind: 'error', text: r.message });
  };

  const older =
    pending?.inspection.summary.lastChanged &&
    pending.currentLastChanged &&
    pending.inspection.summary.lastChanged < pending.currentLastChanged
      ? pending.currentLastChanged
      : null;
  const empty = data?.notebooks === 0;

  return (
    <section aria-labelledby="backup-heading">
      <h2 id="backup-heading">Backup and restore</h2>
      <p>
        Last backup:{' '}
        <strong data-testid="last-backup">
          {data?.lastBackupAt ? epochToDisplay(data.lastBackupAt) : 'Never'}
        </strong>
      </p>
      <BackupButton label="Back up" disabled={empty} />
      {empty && <p className="hint">Nothing to back up yet.</p>}

      <div className="restore">
        <label htmlFor={inputId} className="button file-button">
          Restore from a backup file
        </label>
        <input
          ref={fileInput}
          id={inputId}
          type="file"
          accept="application/json,.json"
          className="visually-hidden-file"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
      </div>

      {data && data.safety > 0 && (
        <div className="toolbar">
          <button type="button" className="button" onClick={() => setConfirmUndo(true)}>
            Undo last restore
          </button>
          <button type="button" className="button" onClick={() => void downloadSafetyCopy()}>
            Download this safety copy
          </button>
        </div>
      )}

      {message && (
        <p
          className={message.kind === 'error' ? 'banner banner-error' : 'banner'}
          role={message.kind === 'error' ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      )}

      <ConfirmDialog
        open={pending !== null}
        title="Restore this backup?"
        confirmLabel="Replace my notes"
        destructive
        onCancel={() => setPending(null)}
        onConfirm={() => void restore()}
      >
        {pending && (
          <>
            <p data-testid="restore-summary">{summaryText(pending.inspection)}</p>
            {older && (
              <p className="field-message">
                This backup is older than your current notes (last changed {toDisplay(older)}).
              </p>
            )}
            {pending.inspection.notes.map((n) => (
              <p key={n} className="hint">
                {n}
              </p>
            ))}
            <p>
              Restoring replaces all your current notes. A safety copy is kept so you can undo it.
            </p>
          </>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmUndo}
        title="Undo the last restore?"
        confirmLabel="Undo restore"
        onCancel={() => setConfirmUndo(false)}
        onConfirm={() => void undo()}
      >
        <p>
          Your notes go back to how they were before the last restore. The current notes are kept as
          a safety copy.
        </p>
      </ConfirmDialog>
    </section>
  );
}
