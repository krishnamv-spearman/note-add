import { useEffect, useMemo, useState } from 'react';
import {
  currentEnv,
  IN_APP_BANNER,
  IN_APP_DETAIL,
  isInAppBrowser,
  looksLikePrivateWindow,
  PRIVATE_BANNER,
} from '@/platform/install';

// Dismissed for this page visit only; they come back after a reload, because the risk remains.
const dismissed = { inApp: false, priv: false };

/**
 * P7.5a / arch §10.5: places where notes are lost, which look like normal browsers. An in-app
 * browser (opened from WhatsApp, Instagram, Gmail…) has its own storage and often blocks
 * downloads (SHR-07). A private window deletes everything when it closes (STO-02, best effort).
 */
export function DataLossBanners() {
  const inApp = useMemo(() => isInAppBrowser(currentEnv()), []);
  const [priv, setPriv] = useState(false);
  const [, rerender] = useState(0);

  useEffect(() => {
    let live = true;
    void looksLikePrivateWindow().then((v) => {
      if (live) setPriv(v);
    });
    return () => {
      live = false;
    };
  }, []);

  const hide = (key: keyof typeof dismissed) => {
    dismissed[key] = true;
    rerender((n) => n + 1);
  };

  return (
    <>
      {inApp && !dismissed.inApp && (
        <div className="banner banner-warning" role="status">
          <span>
            <strong>{IN_APP_BANNER}</strong> {IN_APP_DETAIL}
          </span>
          <button type="button" onClick={() => hide('inApp')}>
            OK
          </button>
        </div>
      )}
      {priv && !dismissed.priv && (
        <div className="banner banner-warning" role="status">
          <span>{PRIVATE_BANNER}</span>
          <button type="button" onClick={() => hide('priv')}>
            OK
          </button>
        </div>
      )}
    </>
  );
}
