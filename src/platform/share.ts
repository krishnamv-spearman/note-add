/** Arch §8.3: the device share menu when it can take the file, otherwise a download. */
export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled' | 'needs-tap';

interface ShareNavigator {
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
}

const errorName = (e: unknown): string =>
  e && typeof e === 'object' && 'name' in e ? String(e.name) : '';

/** Starts a download with a temporary <a download>. */
export function download(file: File, doc: Document = document): 'downloaded' {
  const url = URL.createObjectURL(file);
  const a = doc.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  a.style.display = 'none';
  doc.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}

function canShareFile(nav: ShareNavigator, file: File): boolean {
  try {
    return typeof nav.share === 'function' && nav.canShare?.({ files: [file] }) === true;
  } catch {
    return false;
  }
}

/**
 * 1. canShare(files) → share. AbortError (sheet closed) → 'cancelled', silently (SHR-01).
 *    NotAllowedError (the tap's permission expired while the file was built, iPhone) →
 *    'needs-tap': the caller shows "Your file is ready" with a Share button (SHR-02).
 * 2. Otherwise (no share, or not for this type: SHR-03/04) → download.
 */
export async function shareOrDownload(
  file: File,
  nav: ShareNavigator = globalThis.navigator,
  doc: Document = document,
): Promise<ShareOutcome> {
  if (!canShareFile(nav, file)) return download(file, doc);
  try {
    await (nav.share as NonNullable<ShareNavigator['share']>)({ files: [file], title: file.name });
    return 'shared';
  } catch (e) {
    const name = errorName(e);
    if (name === 'AbortError') return 'cancelled';
    if (name === 'NotAllowedError') return 'needs-tap';
    return download(file, doc);
  }
}

/** The second tap after 'needs-tap': share again within a fresh gesture; else download. */
export async function shareAgain(
  file: File,
  nav: ShareNavigator = globalThis.navigator,
  doc: Document = document,
): Promise<ShareOutcome> {
  const outcome = await shareOrDownload(file, nav, doc);
  return outcome === 'needs-tap' ? download(file, doc) : outcome;
}
