import { useSyncExternalStore } from 'react';
import {
  applyUpdate,
  dismissOfflineReady,
  getPwaState,
  subscribe,
  type UpdatePhase,
} from '@/platform/pwa';

const PHASE_TEXT: Record<UpdatePhase, string> = {
  idle: 'New version available —',
  saving: 'Saving your notes…',
  waiting: 'Finishing what is running…',
  reloading: 'Reloading…',
};

/** P7.2: a toast, never an automatic reload. */
export function UpdatePrompt() {
  const s = useSyncExternalStore(subscribe, getPwaState, getPwaState);
  if (s.needRefresh) {
    return (
      <div className="banner update-banner" role="status">
        <span>{PHASE_TEXT[s.phase]}</span>
        <button type="button" disabled={s.phase !== 'idle'} onClick={() => void applyUpdate()}>
          Reload
        </button>
      </div>
    );
  }
  if (s.offlineReady) {
    return (
      <div className="banner" role="status">
        <span>Note-Add is ready to work offline.</span>
        <button type="button" onClick={dismissOfflineReady}>
          OK
        </button>
      </div>
    );
  }
  return null;
}
