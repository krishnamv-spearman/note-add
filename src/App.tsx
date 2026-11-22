import { useEffect, useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { db, getSettings } from '@/db';
import { applySlipFont } from '@/theme/fonts';
import { hasIndexedDb } from '@/platform/storage';
import { routes } from './routes';
import './styles.css';

/** STO-01: shown instead of the app when the browser cannot store notes. */
export function NoStorage() {
  return (
    <main className="no-storage">
      <h1>Note-Add</h1>
      <p>This browser can’t store notes. Open Note-Add in a normal Chrome or Safari window.</p>
    </main>
  );
}

type Boot = 'opening' | 'ready' | 'failed';

export function App({ router }: { router?: ReturnType<typeof createBrowserRouter> }) {
  const [boot, setBoot] = useState<Boot>(hasIndexedDb() ? 'opening' : 'failed');
  const [appRouter] = useState(
    () => router ?? createBrowserRouter(routes, { basename: import.meta.env.BASE_URL }),
  );

  useEffect(() => {
    if (!hasIndexedDb()) return;
    db.open()
      .then(async () => {
        applySlipFont((await getSettings()).font); // P4.10: before the first slip is painted
        setBoot('ready');
      })
      .catch(() => setBoot('failed'));
  }, []);

  if (boot === 'failed') return <NoStorage />;
  if (boot === 'opening') return <p className="loading">Loading…</p>;
  return <RouterProvider router={appRouter} />;
}
