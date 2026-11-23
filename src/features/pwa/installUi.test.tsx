import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aLine } from '../../../tests/builders';
import { createNotebook, getSettings, loadPages, resetDb, setClock, updateLine } from '@/db';
import { listenForInstallPrompt, resetInstallForTests } from '@/platform/install';
import { DataLossBanners } from './DataLossBanners';
import { InstallButton } from './InstallButton';
import { InstallHint } from './InstallHint';
import { StorageStatus } from './StorageStatus';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const INSTAGRAM =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0';

const userAgent = (ua: string) =>
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(ua);

beforeEach(async () => {
  setClock(() => new Date('2026-11-22T10:00:00+05:30'));
  await resetDb();
  resetInstallForTests();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function withNotes() {
  const r = await createNotebook('Safari notes');
  if (!r.ok) throw new Error('create');
  const [page] = await loadPages(r.value.notebookId);
  await updateLine(page!.id, 0, aLine('450', 'Taxi'));
}

describe('InstallHint (P7.5, STO-05)', () => {
  it('iPhone Safari before any data: "Install to keep your notes safe…", no backup button', async () => {
    userAgent(IPHONE);
    render(<InstallHint />);
    expect(
      await screen.findByText(
        'Install to keep your notes safe: tap Share, then Add to Home Screen.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back up now' })).toBeNull();
  });

  it('STO-05: when Safari already holds notes it says to back up first and offers the backup', async () => {
    userAgent(IPHONE);
    await withNotes();
    render(<InstallHint />);
    expect(
      await screen.findByText(/Back up first, then restore inside the installed app/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back up now' })).toBeInTheDocument();
  });

  it('dismissing hides it and stores the time; it is not shown again', async () => {
    userAgent(IPHONE);
    const user = userEvent.setup();
    const { unmount } = render(<InstallHint />);
    await user.click(await screen.findByRole('button', { name: 'Got it' }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Install Note-Add' })).toBeNull(),
    );
    expect((await getSettings()).installHintDismissedAt).toBe(
      new Date('2026-11-22T10:00:00+05:30').getTime(),
    );
    unmount();
    render(<InstallHint />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('region', { name: 'Install Note-Add' })).toBeNull();
  });

  it('PWA-07: not shown once installed to the home screen (navigator.standalone)', async () => {
    userAgent(IPHONE);
    Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true });
    try {
      render(<InstallHint />);
      await new Promise((r) => setTimeout(r, 50));
      expect(screen.queryByRole('region', { name: 'Install Note-Add' })).toBeNull();
    } finally {
      delete (window.navigator as { standalone?: boolean }).standalone;
    }
  });

  it('not shown outside iOS Safari', async () => {
    userAgent(ANDROID);
    render(<InstallHint />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('region', { name: 'Install Note-Add' })).toBeNull();
  });
});

describe('DataLossBanners (P7.5a)', () => {
  it('SHR-07: an in-app browser gets "Open in Chrome or Safari to keep your notes."; OK hides it', async () => {
    userAgent(INSTAGRAM);
    const user = userEvent.setup();
    render(<DataLossBanners />);
    expect(screen.getByText('Open in Chrome or Safari to keep your notes.')).toBeInTheDocument();
    expect(screen.getByText(/keeps its own storage and may block downloads/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByText('Open in Chrome or Safari to keep your notes.')).toBeNull();
  });

  it('STO-02: a private window (small quota) gets the deletion warning', async () => {
    userAgent(ANDROID);
    vi.stubGlobal('navigator', {
      ...window.navigator,
      userAgent: ANDROID,
      storage: { estimate: () => Promise.resolve({ quota: 40 * 1024 * 1024 }) },
    });
    render(<DataLossBanners />);
    expect(
      await screen.findByText('Notes in a private window are deleted when it closes.'),
    ).toBeInTheDocument();
  });

  it('a normal browser shows nothing', async () => {
    userAgent(ANDROID);
    vi.stubGlobal('navigator', {
      ...window.navigator,
      userAgent: ANDROID,
      storage: { estimate: () => Promise.resolve({ quota: 50 * 1024 * 1024 * 1024 }) },
    });
    const { container } = render(<DataLossBanners />);
    await new Promise((r) => setTimeout(r, 50));
    expect(container).toBeEmptyDOMElement();
  });
});

describe('InstallButton (P7.5, PWA-07)', () => {
  it('appears after beforeinstallprompt and starts the install prompt when tapped', async () => {
    const user = userEvent.setup();
    const off = listenForInstallPrompt(window);
    render(<InstallButton />);
    expect(screen.queryByRole('button', { name: 'Install app' })).toBeNull();

    const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    event.prompt = vi.fn(() => Promise.resolve());
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    act(() => {
      window.dispatchEvent(event);
    });
    await user.click(await screen.findByRole('button', { name: 'Install app' }));
    expect(event.prompt).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Install app' })).toBeNull());
    off();
  });

  it('PWA-07: hidden when the app is already installed', () => {
    const off = listenForInstallPrompt(window);
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('standalone') }));
    const event = new Event('beforeinstallprompt', { cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });
    const { container } = render(<InstallButton />);
    expect(container).toBeEmptyDOMElement();
    off();
  });
});

describe('StorageStatus (P7.4, STO-04)', () => {
  const stub = (storage: unknown) => vi.stubGlobal('navigator', { ...window.navigator, storage });

  it('protected', async () => {
    stub({ persisted: () => Promise.resolve(true) });
    render(<StorageStatus />);
    expect(await screen.findByText('Storage: protected')).toBeInTheDocument();
  });

  it('may be cleared: tells the user to keep backups, without nagging', async () => {
    stub({ persisted: () => Promise.resolve(false) });
    render(<StorageStatus />);
    expect(
      await screen.findByText('Storage: may be cleared by the browser — keep backups'),
    ).toBeInTheDocument();
  });

  it('unsupported browsers', async () => {
    stub(undefined);
    render(<StorageStatus />);
    expect(await screen.findByTestId('storage-status')).toHaveAttribute(
      'data-status',
      'unsupported',
    );
  });
});
