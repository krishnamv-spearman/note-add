import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canPromptInstall,
  type Env,
  IOS_HINT_TEXT,
  IOS_HINT_WITH_DATA_TEXT,
  isInAppBrowser,
  isIos,
  isIosSafari,
  isStandalone,
  listenForInstallPrompt,
  looksLikePrivateWindow,
  promptInstall,
  resetInstallForTests,
  shouldShowIosHint,
  subscribeInstall,
} from './install';

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1',
  iphoneFirefox:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15',
  iphoneInstagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.12.99 (iPhone14,5; iOS 17_5; en_IN; en; scale=3.00; 1170x2532; 600000000)',
  iphoneWebView:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  // iPadOS in "desktop website" mode: reports itself as a Mac.
  ipadAsMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  androidWebView:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36',
  androidFacebook:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.38.108;]',
  desktopChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

const env = (userAgent: string, extra: Partial<Env> = {}): Env => ({
  userAgent,
  platform: '',
  maxTouchPoints: 0,
  navigatorStandalone: false,
  displayModeStandalone: false,
  ...extra,
});

describe('platform detection', () => {
  it('PWA-08: iPhone and iPad are iOS; iPadOS posing as a Mac is found by touch support', () => {
    expect(isIos(env(UA.iphoneSafari))).toBe(true);
    expect(isIos(env(UA.ipadAsMac, { maxTouchPoints: 5 }))).toBe(true);
    expect(isIos(env(UA.macSafari, { maxTouchPoints: 0 }))).toBe(false); // a real Mac
    expect(isIos(env(UA.androidChrome, { maxTouchPoints: 5 }))).toBe(false);
    expect(isIos(env(UA.desktopChrome))).toBe(false);
  });

  it('iOS Safari only: not Chrome, Firefox or an in-app web view on iOS', () => {
    expect(isIosSafari(env(UA.iphoneSafari))).toBe(true);
    expect(isIosSafari(env(UA.ipadAsMac, { maxTouchPoints: 5 }))).toBe(true);
    for (const ua of [UA.iphoneChrome, UA.iphoneFirefox, UA.iphoneInstagram, UA.iphoneWebView]) {
      expect(isIosSafari(env(ua)), ua.slice(60, 120)).toBe(false);
    }
    expect(isIosSafari(env(UA.macSafari))).toBe(false);
    expect(isIosSafari(env(UA.androidChrome))).toBe(false);
  });

  it('PWA-07: installed (iOS navigator.standalone or display-mode) is detected', () => {
    expect(isStandalone(env(UA.iphoneSafari, { navigatorStandalone: true }))).toBe(true);
    expect(isStandalone(env(UA.androidChrome, { displayModeStandalone: true }))).toBe(true);
    expect(isStandalone(env(UA.iphoneSafari))).toBe(false);
  });

  it('SHR-07: in-app browsers are detected on Android and iOS; real browsers are not', () => {
    expect(isInAppBrowser(env(UA.iphoneInstagram))).toBe(true);
    expect(isInAppBrowser(env(UA.iphoneWebView))).toBe(true); // WKWebView: no "Safari/" token
    expect(isInAppBrowser(env(UA.androidWebView))).toBe(true);
    expect(isInAppBrowser(env(UA.androidFacebook))).toBe(true);
    for (const ua of [
      UA.iphoneSafari,
      UA.iphoneChrome,
      UA.androidChrome,
      UA.desktopChrome,
      UA.macSafari,
    ]) {
      expect(isInAppBrowser(env(ua)), ua.slice(60, 120)).toBe(false);
    }
  });
});

describe('iPhone install hint (STO-05, PWA-07)', () => {
  const DAY = 86_400_000;
  const now = 100 * DAY;

  it('is shown in iOS Safari when not installed and never dismissed', () => {
    expect(shouldShowIosHint({ env: env(UA.iphoneSafari), dismissedAt: null, now })).toBe(true);
  });

  it('is not shown when installed, or outside iOS Safari', () => {
    expect(
      shouldShowIosHint({
        env: env(UA.iphoneSafari, { navigatorStandalone: true }),
        dismissedAt: null,
        now,
      }),
    ).toBe(false);
    for (const ua of [UA.androidChrome, UA.desktopChrome, UA.iphoneChrome, UA.iphoneInstagram]) {
      expect(shouldShowIosHint({ env: env(ua), dismissedAt: null, now })).toBe(false);
    }
  });

  it('is hidden for 30 days after dismissal, then comes back; a clock moved back keeps it hidden', () => {
    const e = env(UA.iphoneSafari);
    expect(shouldShowIosHint({ env: e, dismissedAt: now - DAY, now })).toBe(false);
    expect(shouldShowIosHint({ env: e, dismissedAt: now - 29 * DAY, now })).toBe(false);
    expect(shouldShowIosHint({ env: e, dismissedAt: now - 30 * DAY, now })).toBe(true);
    expect(shouldShowIosHint({ env: e, dismissedAt: now + 5 * DAY, now })).toBe(false);
  });

  it('has a plain text and a "back up first" text for when Safari already holds notes', () => {
    expect(IOS_HINT_TEXT).toBe(
      'Install to keep your notes safe: tap Share, then Add to Home Screen.',
    );
    expect(IOS_HINT_WITH_DATA_TEXT).toContain(
      'Back up first, then restore inside the installed app',
    );
    expect(IOS_HINT_WITH_DATA_TEXT.startsWith(IOS_HINT_TEXT)).toBe(true);
  });
});

describe('private window (STO-02, best effort)', () => {
  const quota = (n: number | undefined) => ({
    estimate: () => Promise.resolve(n === undefined ? {} : { quota: n }),
  });

  it('a small storage quota looks like a private window; a normal profile does not', async () => {
    expect(await looksLikePrivateWindow(quota(50 * 1024 * 1024))).toBe(true);
    expect(await looksLikePrivateWindow(quota(100 * 1024 * 1024 * 1024))).toBe(false);
    expect(await looksLikePrivateWindow(quota(0))).toBe(false);
    expect(await looksLikePrivateWindow(quota(undefined))).toBe(false);
  });

  it('unsupported or failing estimate never claims a private window', async () => {
    expect(await looksLikePrivateWindow(undefined)).toBe(false);
    expect(await looksLikePrivateWindow({ estimate: () => Promise.reject(new Error('x')) })).toBe(
      false,
    );
  });
});

describe('"Install app" for Chromium (beforeinstallprompt)', () => {
  afterEach(() => resetInstallForTests());

  function fakePrompt(outcome: 'accepted' | 'dismissed') {
    const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    event.prompt = vi.fn(() => Promise.resolve());
    event.userChoice = Promise.resolve({ outcome });
    return event;
  }

  it('keeps the event for our own button, then uses it once', async () => {
    const off = listenForInstallPrompt(window);
    const changes = vi.fn();
    subscribeInstall(changes);
    expect(canPromptInstall()).toBe(false);
    expect(await promptInstall()).toBe('unavailable');

    const event = fakePrompt('accepted');
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true); // the browser's own mini-infobar is suppressed
    expect(canPromptInstall()).toBe(true);
    expect(changes).toHaveBeenCalled();

    expect(await promptInstall()).toBe('accepted');
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(canPromptInstall()).toBe(false);
    expect(await promptInstall()).toBe('unavailable'); // an event is single-use
    off();
  });

  it('a dismissed prompt reports it; appinstalled clears a waiting event', async () => {
    const off = listenForInstallPrompt(window);
    window.dispatchEvent(fakePrompt('dismissed'));
    expect(await promptInstall()).toBe('dismissed');
    window.dispatchEvent(fakePrompt('accepted'));
    expect(canPromptInstall()).toBe(true);
    window.dispatchEvent(new Event('appinstalled'));
    expect(canPromptInstall()).toBe(false);
    off();
    window.dispatchEvent(fakePrompt('accepted')); // listener removed
    expect(canPromptInstall()).toBe(false);
  });
});
