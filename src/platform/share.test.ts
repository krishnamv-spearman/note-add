import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareAgain, shareOrDownload } from './share';

const file = () =>
  new File(['%PDF-1.7'], 'Trip-Page 1-20-11-2026.pdf', { type: 'application/pdf' });
const err = (name: string) => Object.assign(new Error(name), { name });

function watchDownloads() {
  const clicks: string[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicks.push(this.download);
  });
  vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() });
  return clicks;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('shareOrDownload (P5.7)', () => {
  it('shares the file through the share menu when the browser can share it', async () => {
    const share = vi.fn(() => Promise.resolve());
    const nav = { canShare: () => true, share };
    expect(await shareOrDownload(file(), nav)).toBe('shared');
    expect(share).toHaveBeenCalledWith({
      files: [expect.any(File)],
      title: 'Trip-Page 1-20-11-2026.pdf',
    });
  });

  it('SHR-01: closing the sheet is a silent cancel (no download)', async () => {
    const clicks = watchDownloads();
    const nav = { canShare: () => true, share: () => Promise.reject(err('AbortError')) };
    expect(await shareOrDownload(file(), nav)).toBe('cancelled');
    expect(clicks).toEqual([]);
  });

  it('SHR-02: NotAllowedError asks for a second tap; that tap shares again', async () => {
    const share = vi
      .fn()
      .mockRejectedValueOnce(err('NotAllowedError'))
      .mockResolvedValueOnce(undefined);
    const nav = { canShare: () => true, share };
    expect(await shareOrDownload(file(), nav)).toBe('needs-tap');
    expect(await shareAgain(file(), nav)).toBe('shared');
    expect(share).toHaveBeenCalledTimes(2);
  });

  it('SHR-02: if the second tap is also refused, it downloads', async () => {
    const clicks = watchDownloads();
    const nav = { canShare: () => true, share: () => Promise.reject(err('NotAllowedError')) };
    expect(await shareAgain(file(), nav)).toBe('downloaded');
    expect(clicks).toEqual(['Trip-Page 1-20-11-2026.pdf']);
  });

  it('SHR-03: share exists but not for this file type → download', async () => {
    const clicks = watchDownloads();
    const share = vi.fn();
    expect(await shareOrDownload(file(), { canShare: () => false, share })).toBe('downloaded');
    expect(share).not.toHaveBeenCalled();
    expect(clicks).toEqual(['Trip-Page 1-20-11-2026.pdf']);
  });

  it('SHR-04: no Web Share API at all (desktop Firefox) → download', async () => {
    const clicks = watchDownloads();
    expect(await shareOrDownload(file(), {})).toBe('downloaded');
    expect(
      await shareOrDownload(file(), {
        canShare: () => {
          throw new Error('x');
        },
        share: vi.fn(),
      }),
    ).toBe('downloaded');
    expect(clicks).toHaveLength(2);
  });

  it('any other share error falls back to a download', async () => {
    const clicks = watchDownloads();
    const nav = { canShare: () => true, share: () => Promise.reject(err('DataError')) };
    expect(await shareOrDownload(file(), nav)).toBe('downloaded');
    expect(clicks).toHaveLength(1);
  });
});
