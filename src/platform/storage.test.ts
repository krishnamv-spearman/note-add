import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPersistenceStatus,
  hasIndexedDb,
  PERSISTENCE_TEXT,
  persistenceStatus,
  requestPersistenceOnce,
  resetPersistenceForTests,
} from './storage';

beforeEach(() => {
  resetPersistenceForTests();
  vi.unstubAllGlobals();
});

const withStorage = (storage: unknown) => vi.stubGlobal('navigator', { storage });

describe('storage persistence (P2.13, P7.4, STO-04)', () => {
  it('asks for persistent storage once; the result is remembered', async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    withStorage({ persist, persisted: () => Promise.resolve(false) });
    expect(await requestPersistenceOnce()).toBe('protected');
    expect(await requestPersistenceOnce()).toBe('protected');
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persistenceStatus()).toBe('protected');
  });

  it('STO-04: denied is information only — no retry, no nagging', async () => {
    const persist = vi.fn(() => Promise.resolve(false));
    withStorage({ persist, persisted: () => Promise.resolve(false) });
    expect(await requestPersistenceOnce()).toBe('may-be-cleared');
    await requestPersistenceOnce();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('already persistent: protected without asking', async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    withStorage({ persist, persisted: () => Promise.resolve(true) });
    expect(await requestPersistenceOnce()).toBe('protected');
    expect(persist).not.toHaveBeenCalled();
  });

  it('STO-04: unsupported and throwing browsers', async () => {
    withStorage(undefined);
    expect(await requestPersistenceOnce()).toBe('unsupported');
    resetPersistenceForTests();
    withStorage({ persist: () => Promise.reject(new Error('blocked')) });
    expect(await requestPersistenceOnce()).toBe('may-be-cleared');
  });

  it('Settings › About: status without prompting', async () => {
    expect(await getPersistenceStatus({ persisted: () => Promise.resolve(true) })).toBe(
      'protected',
    );
    expect(await getPersistenceStatus({ persisted: () => Promise.resolve(false) })).toBe(
      'may-be-cleared',
    );
    expect(await getPersistenceStatus({ persisted: () => Promise.reject(new Error('x')) })).toBe(
      'may-be-cleared',
    );
    withStorage(undefined);
    expect(await getPersistenceStatus()).toBe('unsupported');
    expect(await getPersistenceStatus({} as never)).toBe('unsupported');
  });

  it('the About texts say what to do', () => {
    expect(PERSISTENCE_TEXT.protected).toBe('Storage: protected');
    expect(PERSISTENCE_TEXT['may-be-cleared']).toBe(
      'Storage: may be cleared by the browser — keep backups',
    );
    expect(PERSISTENCE_TEXT.unsupported).toContain('keep backups');
  });

  it('STO-01: hasIndexedDb', () => {
    expect(hasIndexedDb()).toBe(true);
    vi.stubGlobal('indexedDB', undefined);
    expect(hasIndexedDb()).toBe(false);
  });
});
