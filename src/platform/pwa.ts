/**
 * Service-worker update state and the "do not interrupt the user" rules (arch §10.1, PWA-03,
 * PWA-04). The app never reloads by itself: a new version only shows a prompt. When the user
 * taps Reload, pending saves are flushed first and an export or restore in progress finishes.
 */

export type UpdatePhase = 'idle' | 'saving' | 'waiting' | 'reloading';

export interface PwaState {
  /** A new version is installed and waiting. */
  needRefresh: boolean;
  /** The app has been cached for offline use (first install). */
  offlineReady: boolean;
  phase: UpdatePhase;
}

let state: PwaState = { needRefresh: false, offlineReady: false, phase: 'idle' };
const listeners = new Set<() => void>();
let updater: ((reload?: boolean) => Promise<void>) | null = null;

const set = (patch: Partial<PwaState>): void => {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
};

export const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const getPwaState = (): PwaState => state;

export const setUpdater = (fn: (reload?: boolean) => Promise<void>): void => {
  updater = fn;
};
export const markNeedRefresh = (): void => set({ needRefresh: true });
export const markOfflineReady = (): void => set({ offlineReady: true });
export const dismissOfflineReady = (): void => set({ offlineReady: false });

// ---- Pending work: flush callbacks (editors) and busy markers (export, backup, restore)

const flushers = new Set<() => Promise<unknown>>();
let busy = 0;
let idleWaiters: (() => void)[] = [];

/** An open editor registers its flush so an update can save the last keystrokes first. */
export function registerFlush(fn: () => Promise<unknown>): () => void {
  flushers.add(fn);
  return () => flushers.delete(fn);
}

/** Mark a long operation (export, backup, restore) as running; call the result when done. */
export function beginBusy(): () => void {
  busy++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    busy--;
    if (busy === 0) {
      const waiting = idleWaiters;
      idleWaiters = [];
      waiting.forEach((resolve) => resolve());
    }
  };
}

export const isBusy = (): boolean => busy > 0;
const whenIdle = (): Promise<void> =>
  busy === 0 ? Promise.resolve() : new Promise((resolve) => idleWaiters.push(resolve));

async function flushAll(): Promise<void> {
  await Promise.allSettled([...flushers].map((fn) => fn()));
}

/** PWA-03 / PWA-04: save, wait for running work, save again, then reload into the new version. */
export async function applyUpdate(): Promise<void> {
  if (state.phase !== 'idle') return;
  set({ phase: 'saving' });
  await flushAll();
  if (busy > 0) {
    set({ phase: 'waiting' });
    await whenIdle();
    await flushAll();
  }
  set({ phase: 'reloading' });
  try {
    await updater?.(true);
  } catch {
    set({ phase: 'idle' });
  }
}

/** Tests only. */
export function resetPwaForTests(): void {
  state = { needRefresh: false, offlineReady: false, phase: 'idle' };
  updater = null;
  flushers.clear();
  busy = 0;
  idleWaiters = [];
  listeners.clear();
}
