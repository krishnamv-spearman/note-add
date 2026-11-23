import { beforeEach, describe, expect, it } from 'vitest';
import { aLine } from '../../tests/builders';
import { setClock } from './clock';
import { recentActivity } from './repo/activity';
import {
  createNotebook,
  deleteNotebook,
  notebookSummaries,
  recolourNotebook,
  renameNotebook,
} from './repo/notebooks';
import {
  appendPage,
  deleteDraftPage,
  finalisePage,
  loadPages,
  reopenPage,
  repoErrorMessage,
  updateLine,
  updatePageHeader,
} from './repo/pages';
import { getSettings, newPageTarget, updateSettings } from './repo/settings';
import { db, resetDb } from './schema';

let day = 22;
beforeEach(async () => {
  day = 22;
  setClock(() => new Date(2026, 10, day, 12, 0));
  await resetDb();
});

async function notebook(name: string, amounts: string[][]): Promise<string> {
  const r = await createNotebook(name);
  if (!r.ok) throw new Error('create');
  for (let i = 1; i < amounts.length; i++) await appendPage(r.value.notebookId);
  const pages = await loadPages(r.value.notebookId);
  for (const [i, list] of amounts.entries()) {
    for (const [j, a] of list.entries()) await updateLine(pages[i]!.id, j, aLine(a));
  }
  return r.value.notebookId;
}

const ids = async (id: string) => (await loadPages(id)).map((p) => p.id);

describe('finalise and reopen', () => {
  it('LIF-01: marking Final sets status, date and an activity entry', async () => {
    const id = await notebook('Pune trip claims', [['100'], ['5'], ['7']]);
    const [, , p3] = await ids(id);
    expect(await finalisePage(p3!)).toEqual({ ok: true, value: undefined });
    const page = await db.pages.get(p3!);
    expect(page).toMatchObject({ status: 'final', finalisedOn: '2026-11-22' });
    expect((await recentActivity(1))[0]?.text).toBe(
      'Page 3 of Pune trip claims marked Final, 22/11/2026',
    );
  });

  it('LIF-18: refused while any amount is not a number (decided 22/11/2026)', async () => {
    const id = await notebook('T', [['100', 'abc', '12a']]);
    const [p1] = await ids(id);
    const r = await finalisePage(p1!);
    expect(r).toEqual({ ok: false, error: { kind: 'invalid-amounts', count: 2 } });
    expect((await db.pages.get(p1!))?.status).toBe('draft');
    if (!r.ok) {
      expect(repoErrorMessage(r.error)).toBe(
        '2 amounts are not numbers. Fix them before marking this page Final.',
      );
    }
    expect(repoErrorMessage({ kind: 'invalid-amounts', count: 1 })).toBe(
      '1 amount is not a number. Fix it before marking this page Final.',
    );
  });

  it('LIF-02 / LIF-03: every reopen date is kept; latest last', async () => {
    const id = await notebook('T', [['1']]);
    const [p1] = await ids(id);
    await finalisePage(p1!);
    await reopenPage(p1!);
    day = 24;
    await finalisePage(p1!);
    await reopenPage(p1!);
    const page = await db.pages.get(p1!);
    expect(page?.status).toBe('draft');
    expect(page?.reopenedOn).toEqual(['2026-11-22', '2026-11-24']);
    expect((await recentActivity(1))[0]?.text).toBe('Page 1 of T reopened, 24/11/2026');
  });

  it('finalising a Final page or reopening a Draft changes nothing', async () => {
    const id = await notebook('T', [['1']]);
    const [p1] = await ids(id);
    expect(await reopenPage(p1!)).toEqual({ ok: true, value: undefined });
    await finalisePage(p1!);
    const before = await db.pages.get(p1!);
    expect(await finalisePage(p1!)).toEqual({ ok: true, value: undefined });
    expect(await db.pages.get(p1!)).toEqual(before);
  });

  it('CHN-04 / CHN-08: a Final page gets "Total updated"; reopen and re-finalise clear it', async () => {
    const id = await notebook('T', [['100'], ['5']]);
    const [p1, p2] = await ids(id);
    await finalisePage(p2!);
    day = 25;
    await updateLine(p1!, 0, aLine('200'));
    expect(await db.pages.get(p2!)).toMatchObject({
      totalPaise: 20500,
      totalUpdatedOn: '2026-11-25',
    });
    await reopenPage(p2!);
    expect((await db.pages.get(p2!))?.totalUpdatedOn).toBeNull();
    await finalisePage(p2!);
    await updateLine(p1!, 0, aLine('300'));
    expect((await db.pages.get(p2!))?.totalUpdatedOn).toBe('2026-11-25');
    await reopenPage(p2!);
    await finalisePage(p2!);
    expect((await db.pages.get(p2!))?.totalUpdatedOn).toBeNull();
  });

  it('unknown pages are not-found', async () => {
    for (const op of [finalisePage, reopenPage, deleteDraftPage]) {
      expect(await op('nope')).toEqual({ ok: false, error: { kind: 'not-found' } });
    }
  });
});

describe('deleteDraftPage', () => {
  it('LIF-05: delete page 2 of 4 → pages renumber; carry-forwards recalculated', async () => {
    const id = await notebook('T', [['10'], ['20'], ['30'], ['40']]);
    const [, p2] = await ids(id);
    expect(await deleteDraftPage(p2!)).toEqual({ ok: true, value: undefined });
    const pages = await loadPages(id);
    expect(pages.map((p) => [p.number, p.broughtForwardPaise, p.totalPaise])).toEqual([
      [1, 0, 1000],
      [2, 1000, 4000],
      [3, 4000, 8000],
    ]);
    expect((await recentActivity(1))[0]?.text).toBe('Page 2 of T deleted, 22/11/2026');
  });

  it('LIF-06: delete page 1 → old page 2 is page 1 with BF 0', async () => {
    const id = await notebook('T', [['10'], ['20']]);
    const [p1, p2] = await ids(id);
    await deleteDraftPage(p1!);
    const [first] = await loadPages(id);
    expect(first).toMatchObject({ id: p2, number: 1, broughtForwardPaise: 0, totalPaise: 2000 });
  });

  it('LIF-07: deleting a Draft before Final pages renumbers them with "Total updated"', async () => {
    const id = await notebook('T', [['10'], ['20'], ['30']]);
    const [, p2, p3] = await ids(id);
    await finalisePage(p3!);
    day = 26;
    await deleteDraftPage(p2!);
    expect(await db.pages.get(p3!)).toMatchObject({
      number: 2,
      status: 'final',
      totalPaise: 4000,
      totalUpdatedOn: '2026-11-26',
    });
  });

  it('LIF-08: a delete that pushes a later total over the limit is refused, page named', async () => {
    const id = await notebook('T', [['-1'], ['99,99,99,999.99', '0.50']]);
    const [p1] = await ids(id);
    const r = await deleteDraftPage(p1!);
    expect(r).toEqual({ ok: false, error: { kind: 'over-limit', pageNumber: 1 } });
    expect(await loadPages(id)).toHaveLength(2);
    if (!r.ok) expect(repoErrorMessage(r.error)).toMatch(/page 1 more than ₹99.99 crore/);
  });

  it('LIF-09: a Final page cannot be deleted', async () => {
    const id = await notebook('T', [['1'], ['2']]);
    const [p1] = await ids(id);
    await finalisePage(p1!);
    expect(await deleteDraftPage(p1!)).toEqual({ ok: false, error: { kind: 'final-delete' } });
  });

  it('LIF-10: the only page of a notebook cannot be deleted', async () => {
    const id = await notebook('T', [['1']]);
    const [p1] = await ids(id);
    const r = await deleteDraftPage(p1!);
    expect(r).toEqual({ ok: false, error: { kind: 'only-page' } });
    if (!r.ok) expect(repoErrorMessage(r.error)).toContain('Delete the notebook instead');
  });

  it('LIF-11: default titles follow the new numbers; custom titles stay', async () => {
    const id = await notebook('T', [['1'], ['2'], ['3']]);
    const [p1, , p3] = await ids(id);
    await updatePageHeader(p3!, { title: 'Hotel' });
    await deleteDraftPage(p1!);
    const pages = await loadPages(id);
    expect(pages.map((p) => [p.number, p.title])).toEqual([
      [1, null],
      [2, 'Hotel'],
    ]);
  });
});

describe('notebooks', () => {
  it('NB-02 / NB-03 / NB-04: cut at 60; duplicates and file-name-unsafe characters allowed', async () => {
    await createNotebook('n'.repeat(80));
    await createNotebook('Łódź trip / a:b');
    await createNotebook('Łódź trip / a:b');
    const names = (await db.notebooks.toArray()).map((n) => n.name);
    expect(names.filter((n) => n.length === 60)).toHaveLength(1);
    expect(names.filter((n) => n === 'Łódź trip / a:b')).toHaveLength(2);
  });

  it('TXT-02: notebook names keep English-only text; other characters are removed', async () => {
    await createNotebook('Trip 🚕 / a:b');
    await createNotebook('दूध');
    const names = (await db.notebooks.toArray()).map((n) => n.name);
    expect(names).toEqual(['Trip / a:b']);
    const r = await renameNotebook((await db.notebooks.toArray())[0]!.id, 'Café قهوة');
    expect(r.ok).toBe(true);
    expect((await db.notebooks.toArray())[0]?.name).toBe('Café');
  });

  it('ACT-03: rename keeps old entries as written', async () => {
    const id = await notebook('Old', [['1']]);
    expect(await renameNotebook(id, '  New  name ')).toEqual({ ok: true, value: undefined });
    expect((await db.notebooks.get(id))?.name).toBe('New name');
    const texts = (await recentActivity(5)).map((a) => a.text);
    expect(texts).toEqual(['Notebook Old renamed to New name', 'Notebook Old created']);
    expect(await renameNotebook(id, 'New name')).toEqual({ ok: true, value: undefined });
    expect(await recentActivity(5)).toHaveLength(2);
    expect((await renameNotebook(id, ' ')).ok).toBe(false);
    expect(await renameNotebook('nope', 'x')).toEqual({ ok: false, error: { kind: 'not-found' } });
  });

  it('EDT-18: recolouring a notebook keeps a page override', async () => {
    const id = await notebook('T', [['1'], ['2']]);
    const [p1] = await ids(id);
    await updatePageHeader(p1!, { colour: 'mint' });
    await recolourNotebook(id, 'sky');
    expect((await db.notebooks.get(id))?.colour).toBe('sky');
    expect((await db.pages.get(p1!))?.colour).toBe('mint');
    expect(await recolourNotebook('nope', 'sky')).toEqual({
      ok: false,
      error: { kind: 'not-found' },
    });
  });

  it('NB-07: deleting a notebook with Final pages needs a second confirmation', async () => {
    const id = await notebook('T', [['1'], ['2']]);
    const [p1] = await ids(id);
    await finalisePage(p1!);
    const first = await deleteNotebook(id);
    expect(first).toEqual({
      ok: false,
      error: { kind: 'invalid-input', message: 'This notebook has 1 Final pages' },
    });
    expect(await db.notebooks.get(id)).toBeDefined();
    expect(await deleteNotebook(id, { confirmFinal: true })).toEqual({
      ok: true,
      value: { pages: 2 },
    });
    expect(await db.notebooks.get(id)).toBeUndefined();
    expect(await loadPages(id)).toEqual([]);
    expect(await deleteNotebook(id)).toEqual({ ok: false, error: { kind: 'not-found' } });
  });

  it('NB-06: "New page" target falls back when the last opened notebook was deleted', async () => {
    expect(await newPageTarget()).toBeNull();
    const a = await notebook('A', [['1']]);
    const b = await notebook('B', [['1']]);
    await updateSettings({ lastOpenedNotebookId: a });
    expect(await newPageTarget()).toBe(a);
    await deleteNotebook(a);
    expect((await getSettings()).lastOpenedNotebookId).toBeNull();
    expect(await newPageTarget()).toBe(b);
  });

  it('settings default and fall back for unknown fonts', async () => {
    expect(await getSettings()).toMatchObject({ font: 'carlito', lastBackupAt: null });
    await db.settings.put({ ...(await getSettings()), font: 'comic' as never, key: 'settings' });
    expect((await getSettings()).font).toBe('carlito');
  });

  it('summaries: page count, Final count, latest total; most recently updated first', async () => {
    const a = await notebook('A', [['1'], ['2.50']]);
    await notebook('B', [['-3']]);
    const [, a2] = await ids(a);
    day = 23; // A changes after B, so A is listed first
    await finalisePage(a2!);
    const s = await notebookSummaries();
    expect(s.map((x) => [x.notebook.name, x.pageCount, x.finalCount, x.latestTotal])).toEqual([
      ['A', 2, 1, 350],
      ['B', 1, 0, -300],
    ]);
  });
});
