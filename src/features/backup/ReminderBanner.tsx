import { useLiveQuery } from 'dexie-react-hooks';
import { dismissReminder, now, reminderInput, shouldShowReminder } from '@/db';
import { BackupButton } from './BackupButton';

/** Should the 30-day reminder show? `undefined` while it is still being read from storage. */
export function useReminder(): boolean | undefined {
  return useLiveQuery(async () => shouldShowReminder(await reminderInput(now())), []);
}

export function ReminderView() {
  return (
    <section className="banner reminder" aria-label="Backup reminder">
      <p>It’s been a while since your last backup. Back up to keep your notes safe.</p>
      <div className="toolbar">
        <BackupButton label="Back up now" />
        <button type="button" className="button" onClick={() => void dismissReminder(now())}>
          Not now
        </button>
      </div>
    </section>
  );
}

/** P6.7 / arch §9.5: a gentle, dismissible 30-day backup reminder on the library. */
export function ReminderBanner() {
  return useReminder() ? <ReminderView /> : null;
}
