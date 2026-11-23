import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { listenForInstallPrompt } from '@/platform/install';
import { App } from './App';

// The browser can offer installation before the UI exists; keep the event for Settings.
listenForInstallPrompt();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// Service worker: after the first paint, from a lazily loaded script file (arch §10.1).
if (import.meta.env.PROD) {
  const register = () =>
    void import('./features/pwa/register').then((m) => m.registerServiceWorker());
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
