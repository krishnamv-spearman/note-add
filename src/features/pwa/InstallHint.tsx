import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { getSettings, now, reminderInput, updateSettings } from '@/db';
import {
  currentEnv,
  IOS_HINT_TEXT,
  IOS_HINT_WITH_DATA_TEXT,
  shouldShowIosHint,
} from '@/platform/install';
import { BackupButton } from '../backup/BackupButton';

/**
 * P7.5 / arch §10.4: on iPhone and iPad Safari, not installed. iPhone gives the installed app
 * its own storage, so notes typed in Safari do not appear in it: when Safari already holds
 * notes, the hint says to back up first and restore inside the installed app (STO-05).
 */
export function InstallHint() {
  const env = useMemo(() => currentEnv(), []);
  const data = useLiveQuery(async () => {
    const [settings, input] = await Promise.all([getSettings(), reminderInput(now())]);
    return { dismissedAt: settings.installHintDismissedAt, hasData: input.hasData };
  }, []);
  if (!data || !shouldShowIosHint({ env, dismissedAt: data.dismissedAt, now: now() })) return null;

  return (
    <section className="banner install-hint" aria-label="Install Note-Add">
      <p>{data.hasData ? IOS_HINT_WITH_DATA_TEXT : IOS_HINT_TEXT}</p>
      <div className="toolbar">
        {data.hasData && <BackupButton label="Back up now" />}
        <button
          type="button"
          className="button"
          onClick={() => void updateSettings({ installHintDismissedAt: now() })}
        >
          Got it
        </button>
      </div>
    </section>
  );
}
