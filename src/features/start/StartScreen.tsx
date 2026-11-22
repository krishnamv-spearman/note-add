import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { createNotebook, db } from '@/db';
import { editorPath } from '../editor/PageEditor';

let opening: Promise<string> | null = null;

/** Phase 2 only: open the latest notebook (or create "My notebook") at its last page. */
async function startPath(): Promise<string> {
  const latest = await db.notebooks.orderBy('updatedAt').last();
  if (latest) {
    const count = await db.pages.where('notebookId').equals(latest.id).count();
    return editorPath(latest.id, Math.max(1, count));
  }
  const r = await createNotebook('My notebook');
  if (!r.ok) throw new Error('Could not create a notebook');
  return editorPath(r.value.notebookId, 1);
}

export function StartScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    let live = true;
    opening ??= startPath().finally(() => {
      opening = null;
    });
    void opening.then((path) => {
      if (live) void navigate(path, { replace: true, state: location.state as unknown });
    });
    return () => {
      live = false;
    };
  }, [navigate, location.state]);
  return <p className="loading">Opening your notebook…</p>;
}
