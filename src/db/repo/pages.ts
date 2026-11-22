import Dexie from 'dexie';
import {
  chainErrorMessage,
  countFlagged,
  displayTitle,
  emptyLine,
  emptyLines,
  isValidIso,
  type IsoDate,
  type Line,
  LINES_PER_PAGE,
  recalculateChain,
  renumber,
  toDisplay,
  ZERO,
} from '@/engine';
import { newId, now, today } from '../clock';
import { db } from '../schema';
import { type ActivityEntry, type ColourId, type Notebook, type Page, TITLE_MAX } from '../types';
import { appendActivity } from './activity';

export type RepoError =
  | { kind: 'over-limit'; pageNumber: number }
  | { kind: 'not-found' }
  | { kind: 'final-locked' }
  | { kind: 'invalid-amounts'; count: number }
  | { kind: 'only-page' }
  | { kind: 'final-delete' }
  | { kind: 'invalid-input'; message: string };

export type RepoResult<T = void> = { ok: true; value: T } | { ok: false; error: RepoError };

/** Thrown inside a transaction to abort it (nothing is written) and report an error. */
export class Refusal extends Error {
  constructor(readonly error: RepoError) {
    super(error.kind);
  }
}

export type NewActivity = Omit<ActivityEntry, 'id' | 'at'>;

export interface Change<T> {
  pages: Page[];
  value: T;
  activity?: NewActivity[];
}

/**
 * CHN-10 / arch §6.6: pad a stored page to exactly 10 lines. A line with content is never
 * dropped; only trailing empty lines beyond 10 are removed. Returns the same object if fine.
 */
export function normalisePage(page: Page): Page {
  if (page.lines.length === LINES_PER_PAGE) return page;
  let lines = [...page.lines];
  while (lines.length < LINES_PER_PAGE) lines.push(emptyLine());
  while (lines.length > LINES_PER_PAGE) {
    const last = lines[lines.length - 1] as Line;
    if (last.description !== '' || last.amountText !== '') break;
    lines = lines.slice(0, -1);
  }
  if (import.meta.env.DEV) console.warn(`Note-Add: page ${page.id} had ${page.lines.length} lines`);
  return { ...page, lines };
}

/** All pages of a notebook in page-number order. */
export async function loadPages(notebookId: string): Promise<Page[]> {
  return db.pages
    .where('[notebookId+number]')
    .between([notebookId, Dexie.minKey], [notebookId, Dexie.maxKey])
    .toArray();
}

/**
 * The single write path for pages (arch §6.1). In one transaction: load → change →
 * renumber → recalculate the chain → abort on error → write only changed pages → bump
 * notebook.updatedAt → append activity. A Refusal thrown by `change` aborts with that error.
 */
export async function mutatePages<T>(
  notebookId: string,
  change: (pages: Page[], notebook: Notebook) => Change<T>,
): Promise<RepoResult<T>> {
  try {
    const value = await db.transaction('rw', db.pages, db.notebooks, db.activity, async () => {
      const notebook = await db.notebooks.get(notebookId);
      if (!notebook) throw new Refusal({ kind: 'not-found' });
      const stored = await loadPages(notebookId);
      const loaded = stored.map(normalisePage);
      const result = change(loaded, notebook);
      const chain = recalculateChain(renumber(result.pages), today());
      if (chain.error) throw new Refusal(chain.error);

      const t = now();
      const original = new Map(stored.map((p) => [p.id, p]));
      const keep = new Set(chain.pages.map((p) => p.id));
      const removed = stored.filter((p) => !keep.has(p.id)).map((p) => p.id);
      const changed = chain.pages
        .filter((p) => original.get(p.id) !== p)
        .map((p) => ({ ...p, updatedAt: t }));

      if (removed.length > 0) await db.pages.bulkDelete(removed);
      if (changed.length > 0) await db.pages.bulkPut(changed);
      if (changed.length > 0 || removed.length > 0) {
        await db.notebooks.update(notebookId, { updatedAt: t });
      }
      if (result.activity?.length) await appendActivity(result.activity, t);
      return result.value;
    });
    return { ok: true, value };
  } catch (e) {
    if (e instanceof Refusal) return { ok: false, error: e.error };
    throw e;
  }
}

export function newPage(notebookId: string, number: number, t = now()): Page {
  return {
    id: newId(),
    notebookId,
    number,
    date: today(),
    title: null,
    colour: null,
    lines: emptyLines(),
    status: 'draft',
    finalisedOn: null,
    reopenedOn: [],
    totalUpdatedOn: null,
    broughtForwardPaise: ZERO,
    totalPaise: ZERO,
    createdAt: t,
    updatedAt: t,
  };
}

async function notebookOf(pageId: string): Promise<string | null> {
  return (await db.pages.get(pageId))?.notebookId ?? null;
}

/** Applies `edit` to one page; refuses edits to Final pages (LIF-14). */
async function editPage(pageId: string, edit: (page: Page) => Page): Promise<RepoResult> {
  const notebookId = await notebookOf(pageId);
  if (!notebookId) return { ok: false, error: { kind: 'not-found' } };
  return mutatePages(notebookId, (pages) => ({
    value: undefined,
    pages: pages.map((p) => {
      if (p.id !== pageId) return p;
      if (p.status === 'final') throw new Refusal({ kind: 'final-locked' });
      return edit(p);
    }),
  }));
}

export interface LinePatch {
  index: number;
  line: Line;
}

/** Autosave: writes only the given lines, so concurrent tabs win per line (MTB-02). */
export async function updateLines(
  pageId: string,
  patches: readonly LinePatch[],
): Promise<RepoResult> {
  for (const { index } of patches) {
    if (!Number.isInteger(index) || index < 0 || index >= LINES_PER_PAGE) {
      return { ok: false, error: { kind: 'invalid-input', message: `No line ${index + 1}` } };
    }
  }
  return editPage(pageId, (page) => {
    const lines = [...page.lines];
    for (const { index, line } of patches) lines[index] = { ...line };
    return { ...page, lines };
  });
}

export async function updateLine(pageId: string, index: number, line: Line): Promise<RepoResult> {
  return updateLines(pageId, [{ index, line }]);
}

export interface HeaderPatch {
  date?: IsoDate;
  title?: string | null;
  colour?: ColourId | null;
}

export async function updatePageHeader(pageId: string, patch: HeaderPatch): Promise<RepoResult> {
  if (patch.date !== undefined && !isValidIso(patch.date)) {
    return { ok: false, error: { kind: 'invalid-input', message: 'Not a valid date' } };
  }
  return editPage(pageId, (page) => {
    const next = { ...page };
    if (patch.date !== undefined) next.date = patch.date;
    if (patch.title !== undefined) {
      const title = (patch.title ?? '').replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX);
      next.title = title === '' ? null : title;
    }
    if (patch.colour !== undefined) next.colour = patch.colour;
    return next;
  });
}

/** Always adds a page at the end (arch §6.2). Returns its number and id. */
export async function appendPage(
  notebookId: string,
): Promise<RepoResult<{ pageId: string; pageNumber: number }>> {
  return mutatePages(notebookId, (pages) => {
    const page = newPage(notebookId, pages.length + 1);
    return { pages: [...pages, page], value: { pageId: page.id, pageNumber: page.number } };
  });
}

/**
 * Arch §6.6 / CHN-09: re-run the chain with no change, correcting malformed pages and
 * cached totals that disagree with the engine. Returns how many pages were corrected.
 */
export async function verifyNotebook(notebookId: string): Promise<number> {
  const before = await loadPages(notebookId);
  const r = await mutatePages(notebookId, (pages) => ({ pages, value: undefined }));
  if (!r.ok) return 0;
  const after = await loadPages(notebookId);
  const corrected = after.filter((p, i) => {
    const b = before[i];
    return (
      !b ||
      b.lines.length !== p.lines.length ||
      b.broughtForwardPaise !== p.broughtForwardPaise ||
      b.totalPaise !== p.totalPaise ||
      b.totalUpdatedOn !== p.totalUpdatedOn
    );
  }).length;
  if (corrected > 0 && import.meta.env.DEV) {
    console.warn(`Note-Add: corrected ${corrected} page(s) in notebook ${notebookId}`);
  }
  return corrected;
}

const pageLabel = (page: Page, notebook: Notebook): string =>
  `Page ${page.number} of ${notebook.name}`;

/**
 * Locks a page (P3.3). Refused while any amount is not a number (LIF-18, decided
 * 22/11/2026). Clears "Total updated…": finalising means the user has reviewed it (CHN-08).
 */
export async function finalisePage(pageId: string): Promise<RepoResult> {
  const notebookId = await notebookOf(pageId);
  if (!notebookId) return { ok: false, error: { kind: 'not-found' } };
  return mutatePages(notebookId, (pages, notebook) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page) throw new Refusal({ kind: 'not-found' });
    if (page.status === 'final') return { pages, value: undefined };
    const flagged = countFlagged(page.lines);
    if (flagged > 0) throw new Refusal({ kind: 'invalid-amounts', count: flagged });
    const day = today();
    return {
      value: undefined,
      pages: pages.map((p) =>
        p.id === pageId ? { ...p, status: 'final', finalisedOn: day, totalUpdatedOn: null } : p,
      ),
      activity: [
        {
          kind: 'page-finalised',
          notebookId,
          pageId,
          text: `${pageLabel(page, notebook)} marked Final, ${toDisplay(day)}`,
        },
      ],
    };
  });
}

/** Back to Draft; every reopen date is kept (LIF-02, LIF-03); the note is cleared (CHN-08). */
export async function reopenPage(pageId: string): Promise<RepoResult> {
  const notebookId = await notebookOf(pageId);
  if (!notebookId) return { ok: false, error: { kind: 'not-found' } };
  return mutatePages(notebookId, (pages, notebook) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page) throw new Refusal({ kind: 'not-found' });
    if (page.status === 'draft') return { pages, value: undefined };
    const day = today();
    return {
      value: undefined,
      pages: pages.map((p) =>
        p.id === pageId
          ? { ...p, status: 'draft', reopenedOn: [...p.reopenedOn, day], totalUpdatedOn: null }
          : p,
      ),
      activity: [
        {
          kind: 'page-reopened',
          notebookId,
          pageId,
          text: `${pageLabel(page, notebook)} reopened, ${toDisplay(day)}`,
        },
      ],
    };
  });
}

/**
 * Deletes a Draft page; later pages renumber and their carry-forwards are recalculated.
 * Refuses Final pages (LIF-09) and the only page of a notebook (LIF-10).
 */
export async function deleteDraftPage(pageId: string): Promise<RepoResult> {
  const notebookId = await notebookOf(pageId);
  if (!notebookId) return { ok: false, error: { kind: 'not-found' } };
  return mutatePages(notebookId, (pages, notebook) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page) throw new Refusal({ kind: 'not-found' });
    if (page.status === 'final') throw new Refusal({ kind: 'final-delete' });
    if (pages.length === 1) throw new Refusal({ kind: 'only-page' });
    return {
      value: undefined,
      pages: pages.filter((p) => p.id !== pageId),
      activity: [
        {
          kind: 'page-deleted',
          notebookId,
          pageId: null,
          text: `${displayTitle(page)} of ${notebook.name} deleted, ${toDisplay(today())}`,
        },
      ],
    };
  });
}

/** User-facing text for a repository error. */
export function repoErrorMessage(e: RepoError): string {
  switch (e.kind) {
    case 'over-limit':
      return chainErrorMessage(e);
    case 'not-found':
      return 'That page or notebook no longer exists.';
    case 'final-locked':
      return 'This page is Final. Reopen it to edit.';
    case 'invalid-amounts':
      return e.count === 1
        ? '1 amount is not a number. Fix it before marking this page Final.'
        : `${e.count} amounts are not numbers. Fix them before marking this page Final.`;
    case 'only-page':
      return 'A notebook always has at least one page. Delete the notebook instead.';
    case 'final-delete':
      return 'Final pages cannot be deleted. Reopen the page first.';
    case 'invalid-input':
      return e.message;
  }
}
