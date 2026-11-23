import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router';
import { db, updateSettings, verifyNotebook } from '@/db';
import { editorPath } from '../paths';
import { PageEditor } from './PageEditor';

/** Loads the notebook and page live; redirects for missing or malformed URLs (P2.4, NB-09/10). */
export function EditorRoute() {
  const { notebookId = '', pageNumber = '' } = useParams();
  const number = /^\d{1,6}$/.test(pageNumber) ? Number(pageNumber) : 0;

  const data = useLiveQuery(async () => {
    const notebook = await db.notebooks.get(notebookId);
    if (!notebook) return { kind: 'missing' as const, for: `${notebookId}/${number}` };
    const count = await db.pages.where('notebookId').equals(notebookId).count();
    const page =
      number > 0
        ? await db.pages.where('[notebookId+number]').equals([notebookId, number]).first()
        : undefined;
    return { kind: 'ok' as const, for: `${notebookId}/${number}`, notebook, count, page };
  }, [notebookId, number]);

  // Arch §6.6: defensive check once per notebook opened.
  useEffect(() => {
    void verifyNotebook(notebookId);
  }, [notebookId]);

  const exists = data?.kind === 'ok';
  useEffect(() => {
    if (exists) void updateSettings({ lastOpenedNotebookId: notebookId });
  }, [exists, notebookId]);

  // Live queries keep the previous result while new params load; never act on stale data.
  if (data?.for !== `${notebookId}/${number}`) return <p className="loading">Loading…</p>;
  if (data.kind === 'missing' || data.count === 0) {
    return <Navigate to="/" replace state={{ notice: 'That notebook no longer exists.' }} />;
  }
  if (!data.page) {
    return (
      <Navigate
        to={editorPath(notebookId, data.count)}
        replace
        state={{ notice: `There is no page ${pageNumber}; showing the last page.` }}
      />
    );
  }
  return (
    <PageEditor
      key={data.page.id}
      notebook={data.notebook}
      page={data.page}
      pageCount={data.count}
    />
  );
}
