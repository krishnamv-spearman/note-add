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

export interface InstallHintData {
  visible: boolean;
  /** Safari already holds notes (STO-05). */
  hasData: boolean;
}

/**
 * P7.5 / arch §10.4: should the iPhone hint be shown? `undefined` while the answer is still
 * being read from storage, so a screen can wait and show everything at once (a banner that
 * appears late pushes the page down under the user's finger).
 */
export function useInstallHint(): InstallHintData | undefined {
  const env = useMemo(() => currentEnv(), []);
  return useLiveQuery(async () => {
    const [settings, input] = await Promise.all([getSettings(), reminderInput(now())]);
    return {
      visible: shouldShowIosHint({ env, dismissedAt: settings.installHintDismissedAt, now: now() }),
      hasData: input.hasData,
    };
  }, [env]);
}

export function InstallHintView({ hasData }: { hasData: boolean }) {
  return (
    <section className="banner install-hint" aria-label="Install Note-Add">
      <p>{hasData ? IOS_HINT_WITH_DATA_TEXT : IOS_HINT_TEXT}</p>
      <div className="toolbar">
        {hasData && <BackupButton label="Back up now" />}
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

/**
 * On iPhone and iPad Safari, not installed. iPhone gives the installed app its own storage, so
 * notes typed in Safari do not appear in it: when Safari already holds notes, the hint says to
 * back up first and restore inside the installed app (STO-05).
 */
export function InstallHint() {
  const data = useInstallHint();
  return data?.visible ? <InstallHintView hasData={data.hasData} /> : null;
}
