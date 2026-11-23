import { useEffect, useState } from 'react';
import { getPersistenceStatus, PERSISTENCE_TEXT, type PersistenceStatus } from '@/platform/storage';

/** P7.4: whether the browser promised to keep the notes. Information only (STO-04). */
export function StorageStatus() {
  const [status, setStatus] = useState<PersistenceStatus>('unknown');
  useEffect(() => {
    let live = true;
    void getPersistenceStatus().then((s) => {
      if (live) setStatus(s);
    });
    return () => {
      live = false;
    };
  }, []);
  return (
    <p data-testid="storage-status" data-status={status}>
      {PERSISTENCE_TEXT[status]}
    </p>
  );
}
