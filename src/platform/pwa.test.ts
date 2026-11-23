import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyUpdate,
  beginBusy,
  getPwaState,
  isBusy,
  markNeedRefresh,
  markOfflineReady,
  registerFlush,
  resetPwaForTests,
  setUpdater,
  subscribe,
} from './pwa';

beforeEach(() => resetPwaForTests());

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('update flow (P7.2, PWA-03, PWA-04)', () => {
  it('a new version only sets a flag — nothing reloads by itself', async () => {
    const updater = vi.fn(() => Promise.resolve());
    setUpdater(updater);
    markNeedRefresh();
    await tick();
    expect(getPwaState()).toMatchObject({ needRefresh: true, phase: 'idle' });
    expect(updater).not.toHaveBeenCalled();
  });

  it('PWA-03: Reload saves pending typing first, then reloads', async () => {
    const order: string[] = [];
    registerFlush(() => {
      order.push('flush');
      return Promise.resolve(true);
    });
    setUpdater((reload) => {
      order.push(`update(${String(reload)})`);
      return Promise.resolve();
    });
    markNeedRefresh();
    await applyUpdate();
    expect(order).toEqual(['flush', 'update(true)']);
    expect(getPwaState().phase).toBe('reloading');
  });

  it('PWA-04: Reload waits for an export or restore in progress, saves again, then reloads', async () => {
    const order: string[] = [];
    registerFlush(() => {
      order.push('flush');
      return Promise.resolve();
    });
    setUpdater(() => {
      order.push('update');
      return Promise.resolve();
    });
    const done = beginBusy();
    expect(isBusy()).toBe(true);
    const pending = applyUpdate();
    await tick();
    expect(getPwaState().phase).toBe('waiting');
    expect(order).toEqual(['flush']); // not reloaded while busy
    done();
    await pending;
    expect(order).toEqual(['flush', 'flush', 'update']);
    expect(isBusy()).toBe(false);
  });

  it('several busy operations: waits for all of them; release is idempotent', async () => {
    setUpdater(() => Promise.resolve());
    const a = beginBusy();
    const b = beginBusy();
    const pending = applyUpdate();
    a();
    a(); // a second release must not count twice
    await tick();
    expect(getPwaState().phase).toBe('waiting');
    b();
    await pending;
    expect(getPwaState().phase).toBe('reloading');
  });

  it('a failing flush does not block the update', async () => {
    registerFlush(() => Promise.reject(new Error('db closed')));
    const updater = vi.fn(() => Promise.resolve());
    setUpdater(updater);
    await applyUpdate();
    expect(updater).toHaveBeenCalledWith(true);
  });

  it('a second tap while applying does nothing; an updater error returns to idle', async () => {
    let calls = 0;
    setUpdater(() => {
      calls++;
      return Promise.reject(new Error('no'));
    });
    const first = applyUpdate();
    await applyUpdate(); // ignored: phase is not idle
    await first;
    expect(calls).toBe(1);
    expect(getPwaState().phase).toBe('idle');
  });

  it('unregistering a flush removes it; with no updater nothing throws', async () => {
    const flush = vi.fn(() => Promise.resolve());
    const off = registerFlush(flush);
    off();
    await applyUpdate();
    expect(flush).not.toHaveBeenCalled();
  });

  it('subscribers are told about changes; offline-ready is separate', () => {
    const fn = vi.fn();
    const off = subscribe(fn);
    markOfflineReady();
    expect(getPwaState().offlineReady).toBe(true);
    expect(fn).toHaveBeenCalled();
    off();
    fn.mockClear();
    markNeedRefresh();
    expect(fn).not.toHaveBeenCalled();
  });
});
