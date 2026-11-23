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

/**
 * What Settings › About shows (P7.4, arch §10.3). Asks the browser whether storage is
 * persistent without prompting. Denied or unsupported is information only (STO-04).
 */
export async function getPersistenceStatus(
  storage: Pick<StorageManager, 'persisted'> | undefined = (
    globalThis.navigator as Navigator | undefined
  )?.storage,
): Promise<PersistenceStatus> {
  if (!storage || typeof storage.persisted !== 'function') return 'unsupported';
  try {
    return (await storage.persisted()) ? 'protected' : 'may-be-cleared';
  } catch {
    return 'may-be-cleared';
  }
}

export const PERSISTENCE_TEXT: Record<PersistenceStatus, string> = {
  unknown: 'Storage: checking…',
  protected: 'Storage: protected',
  'may-be-cleared': 'Storage: may be cleared by the browser — keep backups',
  unsupported: 'Storage: this browser cannot protect it — keep backups',
};

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
