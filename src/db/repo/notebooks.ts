import { filterSupportedText, type Paise, ZERO } from '@/engine';
import { newId, now } from '../clock';
import { db } from '../schema';
import { type ColourId, DEFAULT_COLOUR, type Notebook, NOTEBOOK_NAME_MAX } from '../types';
import { appendActivity } from './activity';
import { loadPages, newPage, type RepoResult } from './pages';

export function cleanNotebookName(name: string): string {
  return filterSupportedText(name).text.replace(/\s+/g, ' ').trim().slice(0, NOTEBOOK_NAME_MAX);
}

/** Creates a notebook with page 1, so the user lands on a usable page (arch §6.2). */
export async function createNotebook(
  name: string,
  colour: ColourId = DEFAULT_COLOUR,
): Promise<RepoResult<{ notebookId: string; pageId: string }>> {
  const clean = cleanNotebookName(name);
  if (clean === '') {
    return { ok: false, error: { kind: 'invalid-input', message: 'Give the notebook a name' } };
  }
  const t = now();
  const notebook: Notebook = { id: newId(), name: clean, colour, createdAt: t, updatedAt: t };
  const page = newPage(notebook.id, 1, t);
  await db.transaction('rw', db.notebooks, db.pages, db.activity, async () => {
    await db.notebooks.add(notebook);
    await db.pages.add(page);
    await appendActivity(
      [
        {
          kind: 'notebook-created',
          notebookId: notebook.id,
          pageId: null,
          text: `Notebook ${clean} created`,
        },
      ],
      t,
    );
  });
  return { ok: true, value: { notebookId: notebook.id, pageId: page.id } };
}

const nameError = { kind: 'invalid-input', message: 'Give the notebook a name' } as const;

/** Rename; the old activity entries keep the old name (ACT-03). */
export async function renameNotebook(id: string, name: string): Promise<RepoResult> {
  const clean = cleanNotebookName(name);
  if (clean === '') return { ok: false, error: nameError };
  return db.transaction('rw', db.notebooks, db.activity, async () => {
    const nb = await db.notebooks.get(id);
    if (!nb) return { ok: false, error: { kind: 'not-found' } } as const;
    if (nb.name === clean) return { ok: true, value: undefined } as const;
    const t = now();
    await db.notebooks.update(id, { name: clean, updatedAt: t });
    await appendActivity(
      [
        {
          kind: 'notebook-renamed',
          notebookId: id,
          pageId: null,
          text: `Notebook ${nb.name} renamed to ${clean}`,
        },
      ],
      t,
    );
    return { ok: true, value: undefined } as const;
  });
}

/** Pages with their own colour keep it (EDT-18). */
export async function recolourNotebook(id: string, colour: ColourId): Promise<RepoResult> {
  const n = await db.notebooks.update(id, { colour, updatedAt: now() });
  return n === 1 ? { ok: true, value: undefined } : { ok: false, error: { kind: 'not-found' } };
}

/**
 * Deletes a notebook and its pages (arch §6.2). When any page is Final, the caller must
 * pass `confirmFinal` after a second explicit confirmation (NB-07).
 */
export async function deleteNotebook(
  id: string,
  options: { confirmFinal?: boolean } = {},
): Promise<RepoResult<{ pages: number }>> {
  return db.transaction('rw', db.notebooks, db.pages, db.settings, async () => {
    const nb = await db.notebooks.get(id);
    if (!nb) return { ok: false, error: { kind: 'not-found' } } as const;
    const pages = await db.pages.where('notebookId').equals(id).toArray();
    const finals = pages.filter((p) => p.status === 'final').length;
    if (finals > 0 && !options.confirmFinal) {
      return {
        ok: false,
        error: { kind: 'invalid-input', message: `This notebook has ${finals} Final pages` },
      } as const;
    }
    await db.pages.bulkDelete(pages.map((p) => p.id));
    await db.notebooks.delete(id);
    const settings = await db.settings.get('settings');
    if (settings?.lastOpenedNotebookId === id) {
      await db.settings.update('settings', { lastOpenedNotebookId: null });
    }
    return { ok: true, value: { pages: pages.length } } as const;
  });
}

export interface NotebookSummary {
  notebook: Notebook;
  pageCount: number;
  finalCount: number;
  latestTotal: Paise;
}

/** Library data: every notebook, most recently updated first, with its latest page total. */
export async function notebookSummaries(): Promise<NotebookSummary[]> {
  const notebooks = await db.notebooks.orderBy('updatedAt').reverse().toArray();
  return Promise.all(
    notebooks.map(async (notebook) => {
      const pages = await loadPages(notebook.id);
      return {
        notebook,
        pageCount: pages.length,
        finalCount: pages.filter((p) => p.status === 'final').length,
        latestTotal: pages.at(-1)?.totalPaise ?? ZERO,
      };
    }),
  );
}
