import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { onDbEvent } from '@/db';
import { onTabMessage } from '@/platform/broadcast';
import { BottomNav } from '@/ui/bits';
import { useNewPage } from './features/newPage';

/** App chrome: brand, notices passed through navigation, update and reload banners. */
export function Layout() {
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;
  const [updated, setUpdated] = useState(false);
  const newPage = useNewPage();

  useEffect(() => onDbEvent(() => setUpdated(true)), []);
  // MTB-03: another tab restored a backup; reload (the editor flushes on pagehide).
  useEffect(
    () =>
      onTabMessage((m) => {
        if (m.type === 'reload') window.location.reload();
      }),
    [],
  );

  return (
    <div className="app">
      <header className="app-bar">
        <span className="brand">Note-Add</span>
      </header>
      {updated && (
        <div className="banner" role="alert">
          <span>Note-Add was updated — reload</span>
          <button type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )}
      {notice && (
        <p className="banner" role="status">
          {notice}
        </p>
      )}
      <main className="content">
        <Outlet />
      </main>
      <BottomNav onNewPage={() => void newPage()} />
    </div>
  );
}
