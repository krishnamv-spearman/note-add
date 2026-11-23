import { beforeEach, describe, expect, it } from 'vitest';
import { aLine } from '../../tests/builders';
import { createBackupDocument, inspectBackupText } from './repo/backup';
import { createNotebook, notebookSummaries } from './repo/notebooks';
import { appendPage, loadPages, mutatePages, newPage, updateLine } from './repo/pages';
import { db, resetDb } from './schema';

// Arch §14: recalculating a 200-page notebook, including the IndexedDB write, takes under 50 ms.
// The CI tolerance is x2 (shared runners). These run against fake-indexeddb, which is a plain
// JavaScript implementation; real browsers' IndexedDB is not slower for this workload.
const CI = Boolean(process.env.CI);
const BUDGET_MS = 50 * (CI ? 2 : 1);

beforeEach(async () => {
  await resetDb();
});

async function notebookOf(pageCount: number): Promise<{ id: string; firstPageId: string }> {
  const r = await createNotebook('Big');
  if (!r.ok) throw new Error('create');
  const id = r.value.notebookId;
  await mutatePages(id, (pages) => ({
    value: 0,
    pages: [
      ...pages,
      ...Array.from({ length: pageCount - 1 }, (_, i) => {
        const page = newPage(id, i + 2);
        page.lines[0] = aLine('10.50', 'Taxi');
        page.lines[1] = aLine('-3', 'Refund');
        page.lines[2] = aLine('1,280.75', 'Hotel');
        return page;
      }),
    ],
  }));
  const [first] = await loadPages(id);
  return { id, firstPageId: (first as { id: string }).id };
}

const median = (xs: number[]): number =>
  [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] as number;

async function timeEdits(pageId: string, runs: number): Promise<number[]> {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    // A different amount each time, so every later page's total really changes.
    const r = await updateLine(pageId, 0, aLine(String(100 + i)));
    times.push(performance.now() - t);
    expect(r.ok).toBe(true);
  }
  return times;
}

describe('performance (P7.8, arch §14)', () => {
  it('CHN-15: editing page 1 of a 200-page notebook recalculates and writes every page in under 50 ms (median of 20)', async () => {
    const { id, firstPageId } = await notebookOf(200);
    expect(await db.pages.where('notebookId').equals(id).count()).toBe(200);
    const times = await timeEdits(firstPageId, 20);
    expect(median(times), `times: ${times.map((t) => String(t)).join(' ')}`).toBeLessThan(
      BUDGET_MS,
    );

    // And the result is right on the last page: BF(200) is the sum of the 199 earlier pages.
    const pages = await loadPages(id);
    expect(pages).toHaveLength(200);
    expect(pages[199]?.broughtForwardPaise).toBe(pages[198]?.totalPaise);
    // Page 1 holds only the edited line: the last run wrote 119 (100 + 19), i.e. 11,900 paise.
    expect(pages[0]?.totalPaise).toBe(11_900);
  });

  it('a 1,000-page notebook still edits within a second', async () => {
    const { firstPageId } = await notebookOf(1000);
    const times = await timeEdits(firstPageId, 5);
    expect(median(times), `times: ${times.map((t) => String(t)).join(' ')}`).toBeLessThan(1000);
  }, 60_000);

  it('BAK-04: a 1,000-page backup is created quickly, is a few MB, and validates', async () => {
    await notebookOf(1000);
    const t = performance.now();
    const doc = await createBackupDocument('1.0.0');
    const json = JSON.stringify(doc);
    const took = performance.now() - t;
    expect(doc.summary).toMatchObject({ notebooks: 1, pages: 1000 });
    expect(json.length).toBeGreaterThan(500_000);
    expect(json.length).toBeLessThan(8 * 1024 * 1024); // a few MB, far under the 20 MB cap
    expect(took).toBeLessThan(2000 * (CI ? 2 : 1));
    const inspected = inspectBackupText(json); // every chain recomputed and compared
    expect(inspected.ok).toBe(true);
  }, 60_000);

  it('NB-08: the library data for 100 notebooks of 10 pages loads in well under a second', async () => {
    for (let i = 0; i < 100; i++) {
      const r = await createNotebook(`Notebook ${i + 1}`);
      if (!r.ok) throw new Error('create');
      for (let p = 1; p < 10; p++) await appendPage(r.value.notebookId);
    }
    const t = performance.now();
    const summaries = await notebookSummaries();
    const took = performance.now() - t;
    expect(summaries).toHaveLength(100);
    expect(summaries[0]?.pageCount).toBe(10);
    expect(took).toBeLessThan(1000 * (CI ? 2 : 1));
  }, 120_000);
});
