import { registerSW } from 'virtual:pwa-register';
import { markNeedRefresh, markOfflineReady, setUpdater } from '@/platform/pwa';

const HOUR = 60 * 60 * 1000;

/**
 * Registers the service worker (arch §10.1). Loaded lazily after the first paint, from a script
 * file so the CSP needs no inline script. Registration can fail (private mode, storage full,
 * blocked): the app then simply works online, with no message (PWA-10).
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  try {
    let lastCheck = Date.now();
    const update = registerSW({
      immediate: true,
      onNeedRefresh: markNeedRefresh,
      onOfflineReady: markOfflineReady,
      onRegisteredSW(_url, registration) {
        if (!registration) return;
        const check = () => {
          lastCheck = Date.now();
          registration.update().catch(() => undefined);
        };
        setInterval(check, HOUR);
        // An installed app is not "navigated", so also look for updates when it comes back.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && Date.now() - lastCheck > HOUR) check();
        });
      },
      onRegisterError: () => undefined, // PWA-10
    });
    setUpdater(update);
  } catch {
    // ignore: the app works without a service worker
  }
}
