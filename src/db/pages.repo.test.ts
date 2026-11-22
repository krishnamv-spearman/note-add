import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aLine, linesOf } from '../../tests/builders';
import { newId, setClock } from './clock';
import { ACTIVITY_KEEP, appendActivity, recentActivity } from './repo/activity';
import { createNotebook } from './repo/notebooks';
import {
  appendPage,
  loadPages,
  mutatePages,
  normalisePage,
  updateLine,
  updateLines,
  updatePageHeader,
  verifyNotebook,
} from './repo/pages';
import { DB_NAME, db, onDbEvent, resetDb } from './schema';
import type { Page } from './types';

let nowMs = new Date(2026, 10, 22, 10, 0).getTime();
beforeEach(async () => {
  nowMs = new Date(2026, 10, 22, 10, 0).getTime();
  setClock(() => new Date(nowMs));
  await resetDb();
});
afterEach(() => vi.restoreAllMocks());

async function notebookWith(pageCount: number, amounts: string[] = ['100']): Promise<string> {
  const r = await createNotebook('Test');
  if (!r.ok) throw new Error('create failed');
  const id = r.value.notebookId;
  for (let i = 1; i < pageCount; i++) await appendPage(id);
  const pages = await loadPages(id);
  for (const p of pages)
    await updateLines(
      p.id,
      amounts.map((a, index) => ({ index, line: aLine(a) })),
    );
  return id;
}

describe('createNotebook and appendPage', () => {
  it('P2.3: a new notebook has page 1 with 10 empty lines, today, no title, draft', async () => {
    const r = await createNotebook('  My   notebook ');
    expect(r.ok).toBe(true);
    const nb = await db.notebooks.toArray();
    expect(nb[0]?.name).toBe('My notebook');
    const pages = await loadPages(nb[0]!.id);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({
      number: 1,
      date: '2026-11-22',
      title: null,
      status: 'draft',
      colour: null,
      broughtForwardPaise: 0,
      totalPaise: 0,
      reopenedOn: [],
    });
    expect(pages[0]?.lines).toHaveLength(10);
  });

  it('NB-01: an empty name is refused', async () => {
    expect(await createNotebook('   ')).toEqual({
      ok: false,
      error: { kind: 'invalid-input', message: 'Give the notebook a name' },
    });
  });

  it('appendPage adds at the end with BF = previous total', async () => {
    const id = await notebookWith(2, ['450', '-300']);
    const r = await appendPage(id);
    expect(r).toEqual({ ok: true, value: { pageId: expect.any(String), pageNumber: 3 } });
    const pages = await loadPages(id);
    expect(pages.map((p) => p.number)).toEqual([1, 2, 3]);
    expect(pages[2]?.broughtForwardPaise).toBe(30000);
  });

  it('DAT-03: a page created after midnight gets the new date (clock read each time)', async () => {
    const id = await notebookWith(1);
    nowMs = new Date(2026, 10, 23, 0, 1).getTime();
    await appendPage(id);
    const pages = await loadPages(id);
    expect(pages[1]?.date).toBe('2026-11-23');
  });

  it('appendPage on a missing notebook is not-found', async () => {
    expect(await appendPage('nope')).toEqual({ ok: false, error: { kind: 'not-found' } });
  });
});

describe('mutatePages', () => {
  it('CHN-02: editing page 1 of a 50-page notebook updates all later pages in one transaction', async () => {
    const id = await notebookWith(50, ['100']);
    const pages = await loadPages(id);
    expect(pages[49]?.totalPaise).toBe(500000);
    const spy = vi.spyOn(db, 'transaction');
    const r = await updateLine(pages[0]!.id, 0, aLine('150'));
    expect(r.ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    const after = await loadPages(id);
    after.forEach((p, i) => expect(p.totalPaise).toBe((i + 1) * 10000 + 5000));
  });

  it('CHN-03: a failing chain (over-limit) writes nothing', async () => {
    const id = await notebookWith(3, []);
    const pages = await loadPages(id);
    await updateLine(pages[1]!.id, 0, aLine('99,99,99,999.99'));
    const before = await loadPages(id);
    const r = await updateLine(pages[0]!.id, 0, aLine('0.01'));
    expect(r).toEqual({ ok: false, error: { kind: 'over-limit', pageNumber: 2 } });
    expect(await loadPages(id)).toEqual(before);
  });

  it('writes only changed pages and bumps notebook.updatedAt', async () => {
    const id = await notebookWith(5, ['100']);
    const before = await loadPages(id);
    nowMs += 60_000;
    await updateLine(before[3]!.id, 1, aLine('', 'Taxi'));
    const after = await loadPages(id);
    expect(after.map((p) => p.updatedAt === before[after.indexOf(p)]!.updatedAt)).toEqual([
      true,
      true,
      true,
      false,
      true,
    ]);
    expect((await db.notebooks.get(id))?.updatedAt).toBe(nowMs);
  });

  it('an exception inside the change rolls everything back', async () => {
    const id = await notebookWith(2, ['100']);
    const before = await loadPages(id);
    await expect(
      mutatePages(id, () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await loadPages(id)).toEqual(before);
  });

  it('deleting a page through mutatePages renumbers and recalculates', async () => {
    const id = await notebookWith(3, ['100']);
    const r = await mutatePages(id, (pages) => ({
      pages: pages.filter((p) => p.number !== 2),
      value: 1,
    }));
    expect(r).toEqual({ ok: true, value: 1 });
    const after = await loadPages(id);
    expect(after.map((p) => [p.number, p.totalPaise])).toEqual([
      [1, 10000],
      [2, 20000],
    ]);
  });
});

describe('updateLines / updatePageHeader', () => {
  it('MTB-02: writes are per line — another line written meanwhile is kept', async () => {
    const id = await notebookWith(1, []);
    const [page] = await loadPages(id);
    await updateLine(page!.id, 0, aLine('100', 'Tab A'));
    await updateLine(page!.id, 1, aLine('200', 'Tab B'));
    const [after] = await loadPages(id);
    expect(after?.lines.slice(0, 2).map((l) => l.description)).toEqual(['Tab A', 'Tab B']);
    expect(after?.totalPaise).toBe(30000);
  });

  it('refuses a line index outside 0..9', async () => {
    const id = await notebookWith(1, []);
    const [page] = await loadPages(id);
    const r = await updateLine(page!.id, 10, aLine('1'));
    expect(r.ok).toBe(false);
  });

  it('LIF-14: lines and header of a Final page cannot change', async () => {
    const id = await notebookWith(1, ['100']);
    const [page] = await loadPages(id);
    await db.pages.update(page!.id, { status: 'final' });
    expect(await updateLine(page!.id, 0, aLine('5'))).toEqual({
      ok: false,
      error: { kind: 'final-locked' },
    });
    expect(await updatePageHeader(page!.id, { title: 'x' })).toEqual({
      ok: false,
      error: { kind: 'final-locked' },
    });
  });

  it('EDT-13 / EDT-14: title cleared → null; cut at 60', async () => {
    const id = await notebookWith(1, []);
    const [page] = await loadPages(id);
    await updatePageHeader(page!.id, { title: 'x'.repeat(80) });
    expect((await db.pages.get(page!.id))?.title).toHaveLength(60);
    await updatePageHeader(page!.id, { title: '   ' });
    expect((await db.pages.get(page!.id))?.title).toBeNull();
    await updatePageHeader(page!.id, { title: null, colour: 'mint', date: '2026-01-31' });
    expect(await db.pages.get(page!.id)).toMatchObject({
      title: null,
      colour: 'mint',
      date: '2026-01-31',
    });
  });

  it('EDT-10: an invalid date is refused', async () => {
    const id = await notebookWith(1, []);
    const [page] = await loadPages(id);
    const r = await updatePageHeader(page!.id, { date: '2026-02-30' });
    expect(r.ok).toBe(false);
  });

  it('unknown page is not-found', async () => {
    expect(await updateLine('nope', 0, aLine('1'))).toEqual({
      ok: false,
      error: { kind: 'not-found' },
    });
  });
});

describe('defensive reads', () => {
  it('CHN-10: a page with the wrong number of lines is padded; content never dropped', () => {
    const short = { lines: linesOf(['5']).slice(0, 3) } as Page;
    expect(normalisePage(short).lines).toHaveLength(10);
    const long = { lines: [...linesOf(['5']), aLine(''), aLine('')] } as Page;
    expect(normalisePage(long).lines).toHaveLength(10);
    const longWithContent = { lines: [...linesOf(['5']), aLine('7')] } as Page;
    expect(normalisePage(longWithContent).lines).toHaveLength(11);
    const fine = { lines: linesOf() } as Page;
    expect(normalisePage(fine)).toBe(fine);
  });

  it('CHN-09 / CHN-10: verifyNotebook corrects stale totals and short pages without changing amounts', async () => {
    const id = await notebookWith(3, ['100']);
    const pages = await loadPages(id);
    await db.pages.update(pages[1]!.id, {
      totalPaise: 1 as never,
      lines: pages[1]!.lines.slice(0, 4),
    });
    const corrected = await verifyNotebook(id);
    expect(corrected).toBe(1);
    const after = await loadPages(id);
    expect(after.map((p) => p.totalPaise)).toEqual([10000, 20000, 30000]);
    expect(after[1]?.lines).toHaveLength(10);
    expect(after[1]?.lines[0]?.amountPaise).toBe(10000);
    expect(await verifyNotebook(id)).toBe(0);
    expect(await verifyNotebook('missing')).toBe(0);
  });
});

describe('activity', () => {
  it('ACT-05: trimmed to the latest 200 entries', async () => {
    for (let i = 0; i < 210; i += 30) {
      await appendActivity(
        Array.from({ length: 30 }, (_, j) => ({
          kind: 'backup' as const,
          notebookId: null,
          pageId: null,
          text: `e${i + j}`,
        })),
        nowMs,
      );
    }
    expect(await db.activity.count()).toBe(ACTIVITY_KEEP);
    expect((await recentActivity(1))[0]?.text).toBe('e209');
  });

  it('ACT-02: line edits create no activity entries', async () => {
    const id = await notebookWith(1, []);
    const n = await db.activity.count();
    const [page] = await loadPages(id);
    await updateLine(page!.id, 0, aLine('5', 'x'));
    expect(await db.activity.count()).toBe(n);
  });
});

describe('ids and schema', () => {
  it('STO-08: newId falls back when crypto.randomUUID is unavailable', () => {
    const original = globalThis.crypto.randomUUID.bind(globalThis.crypto);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(original);
    expect(newId()).toMatch(/^[0-9a-f-]{36}$/);
    vi.stubGlobal('crypto', {});
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
    vi.unstubAllGlobals();
  });

  it('MTB-04: a newer schema version closes this connection instead of being blocked', async () => {
    const events: string[] = [];
    const off = onDbEvent((e) => events.push(e));
    await db.open();
    const newer = new Dexie(DB_NAME);
    newer.version(2).stores({ notebooks: 'id, updatedAt' });
    await newer.open();
    expect(events).toEqual(['version-change']);
    expect(db.isOpen()).toBe(false);
    newer.close();
    off();
    await Dexie.delete(DB_NAME);
    await db.open();
  });
});
