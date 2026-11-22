export type PersistenceStatus = 'unknown' | 'protected' | 'may-be-cleared' | 'unsupported';

let status: PersistenceStatus = 'unknown';
let requested: Promise<PersistenceStatus> | null = null;

/** P2.13 / arch §10.3: ask once, after the first save, for persistent storage. */
export function requestPersistenceOnce(): Promise<PersistenceStatus> {
  requested ??= (async () => {
    const storage = (globalThis.navigator as Navigator | undefined)?.storage;
    if (!storage || typeof storage.persist !== 'function') {
      status = 'unsupported';
      return status;
    }
    try {
      const already = typeof storage.persisted === 'function' && (await storage.persisted());
      status = already || (await storage.persist()) ? 'protected' : 'may-be-cleared';
    } catch {
      status = 'may-be-cleared';
    }
    return status;
  })();
  return requested;
}

export function persistenceStatus(): PersistenceStatus {
  return status;
}

/** Tests only. */
export function resetPersistenceForTests(): void {
  status = 'unknown';
  requested = null;
}

/** STO-01: IndexedDB missing or blocked (some private modes, locked-down browsers). */
export function hasIndexedDb(): boolean {
  try {
    return typeof globalThis.indexedDB !== 'undefined' && globalThis.indexedDB !== null;
  } catch {
    return false;
  }
}
