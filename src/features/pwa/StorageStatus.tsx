import { useEffect, useState } from 'react';
import { getPersistenceStatus, PERSISTENCE_TEXT, type PersistenceStatus } from '@/platform/storage';

/** The storage status, or `undefined` while the browser is being asked. */
export function useStorageStatus(): PersistenceStatus | undefined {
  const [status, setStatus] = useState<PersistenceStatus>();
  useEffect(() => {
    let live = true;
    void getPersistenceStatus().then((s) => {
      if (live) setStatus(s);
    });
    return () => {
      live = false;
    };
  }, []);
  return status;
}

export function StorageStatusView({ status }: { status: PersistenceStatus }) {
  return (
    <p data-testid="storage-status" data-status={status}>
      {PERSISTENCE_TEXT[status]}
    </p>
  );
}

/** P7.4: whether the browser promised to keep the notes. Information only (STO-04). */
export function StorageStatus() {
  const status = useStorageStatus();
  return status === undefined ? null : <StorageStatusView status={status} />;
}
