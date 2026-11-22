import { newId, now } from '../clock';
import { db } from '../schema';
import { type ColourId, DEFAULT_COLOUR, type Notebook, NOTEBOOK_NAME_MAX } from '../types';
import { appendActivity } from './activity';
import { newPage, type RepoResult } from './pages';

export function cleanNotebookName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, NOTEBOOK_NAME_MAX);
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
