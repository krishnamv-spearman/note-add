import { useSyncExternalStore } from 'react';
import {
  canPromptInstall,
  currentEnv,
  isStandalone,
  promptInstall,
  subscribeInstall,
} from '@/platform/install';

/**
 * P7.5: "Install app" for Chromium browsers (Android, Windows, Mac, ChromeOS), from the
 * `beforeinstallprompt` event. Hidden once installed (PWA-07) and wherever the browser offers
 * no install (iPhone has its own hint on the library).
 */
export function InstallButton() {
  const canInstall = useSyncExternalStore(subscribeInstall, canPromptInstall, () => false);
  if (!canInstall || isStandalone(currentEnv())) return null;
  return (
    <p>
      <button type="button" className="button button-primary" onClick={() => void promptInstall()}>
        Install app
      </button>
    </p>
  );
}
