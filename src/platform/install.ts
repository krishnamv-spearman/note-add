/**
 * Install and "where am I running" detection (arch §10.4, §10.5): the iPhone install hint,
 * the Chromium "Install app" button, and the data-loss banners for in-app browsers and private
 * windows. Pure functions over an `Env` snapshot, so each rule is unit-testable.
 */

export interface Env {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  /** iOS Safari's `navigator.standalone`. */
  navigatorStandalone: boolean;
  /** The `display-mode` media query: the installed app on Android and desktop. */
  displayModeStandalone: boolean;
}

export function currentEnv(): Env {
  const nav = navigator as Navigator & { standalone?: boolean };
  const matches = (q: string): boolean => typeof matchMedia === 'function' && matchMedia(q).matches;
  return {
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints,
    navigatorStandalone: nav.standalone === true,
    displayModeStandalone:
      matches('(display-mode: standalone)') ||
      matches('(display-mode: fullscreen)') ||
      matches('(display-mode: minimal-ui)'),
  };
}

/** iPhone, iPod, iPad, and iPadOS pretending to be a Mac (PWA-08). */
export function isIos(env: Env): boolean {
  return (
    /iPhone|iPad|iPod/.test(env.userAgent) ||
    (/Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1)
  );
}

export function isStandalone(env: Env): boolean {
  return env.navigatorStandalone || env.displayModeStandalone;
}

const IN_APP_TOKENS =
  /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|Snapchat|MicroMessenger|Twitter|LinkedInApp|Pinterest|TikTok|musical_ly|BytedanceWebview|Messenger|WhatsApp|GSA\/|; wv\)/;

/**
 * A browser inside another app (WhatsApp, Instagram, Facebook, Gmail link preview…): its
 * storage is separate from Chrome and Safari, and downloads often fail (SHR-07). On iOS, a
 * WKWebView of a native app has no "Safari/" token in its user agent.
 */
export function isInAppBrowser(env: Env): boolean {
  if (IN_APP_TOKENS.test(env.userAgent)) return true;
  return isIos(env) && !/Safari\//.test(env.userAgent);
}

export function isIosSafari(env: Env): boolean {
  return (
    isIos(env) &&
    /Safari\//.test(env.userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|GSA\//.test(env.userAgent) &&
    !isInAppBrowser(env)
  );
}

export const INSTALL_HINT_HIDDEN_DAYS = 30;
const DAY_MS = 86_400_000;

export interface HintInput {
  env: Env;
  dismissedAt: number | null;
  now: number;
}

/** Arch §10.4: iOS Safari, not installed, not dismissed in the last 30 days (STO-05, PWA-07). */
export function shouldShowIosHint({ env, dismissedAt, now }: HintInput): boolean {
  if (!isIosSafari(env) || isStandalone(env)) return false;
  if (dismissedAt === null) return true;
  // A clock moved backwards (negative gap) keeps it hidden, like the backup reminder (DAT-05).
  return now - dismissedAt >= INSTALL_HINT_HIDDEN_DAYS * DAY_MS;
}

export const IOS_HINT_TEXT = 'Install to keep your notes safe: tap Share, then Add to Home Screen.';
export const IOS_HINT_WITH_DATA_TEXT =
  'Install to keep your notes safe: tap Share, then Add to Home Screen. Back up first, then restore inside the installed app: the installed app starts with its own empty storage.';

export const IN_APP_BANNER = 'Open in Chrome or Safari to keep your notes.';
export const IN_APP_DETAIL =
  'This browser inside another app keeps its own storage and may block downloads.';
export const PRIVATE_BANNER = 'Notes in a private window are deleted when it closes.';

/**
 * STO-02, best effort: private windows get a small storage quota (Chromium incognito reports
 * well under 120 MB, a normal profile far more). No method works in every browser.
 */
export async function looksLikePrivateWindow(
  storage: Pick<StorageManager, 'estimate'> | undefined = (navigator as Navigator | undefined)
    ?.storage,
): Promise<boolean> {
  if (!storage || typeof storage.estimate !== 'function') return false;
  try {
    const { quota } = await storage.estimate();
    return typeof quota === 'number' && quota > 0 && quota < 120 * 1024 * 1024;
  } catch {
    return false;
  }
}

// ---- Chromium "Install app" (beforeinstallprompt)

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = (): void => listeners.forEach((fn) => fn());

/** Call once at start-up: the event can fire before the UI exists. */
export function listenForInstallPrompt(target: Window = window): () => void {
  const onPrompt = (e: Event): void => {
    e.preventDefault(); // keep it for our own button
    deferred = e as BeforeInstallPromptEvent;
    notify();
  };
  const onInstalled = (): void => {
    deferred = null;
    notify();
  };
  target.addEventListener('beforeinstallprompt', onPrompt);
  target.addEventListener('appinstalled', onInstalled);
  return () => {
    target.removeEventListener('beforeinstallprompt', onPrompt);
    target.removeEventListener('appinstalled', onInstalled);
  };
}

export const subscribeInstall = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const canPromptInstall = (): boolean => deferred !== null;

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferred;
  if (!event) return 'unavailable';
  deferred = null; // an event can be used once
  notify();
  await event.prompt();
  return (await event.userChoice).outcome;
}

/** Tests only. */
export function resetInstallForTests(): void {
  deferred = null;
  listeners.clear();
}
