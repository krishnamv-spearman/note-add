import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { displayTitle, formatPaise, toDisplay } from '@/engine';
import {
  appendPage,
  db,
  deleteNotebook,
  loadPages,
  type Notebook,
  type Page,
  recolourNotebook,
  renameNotebook,
  repoErrorMessage,
  updateSettings,
} from '@/db';
import { slipColour } from '@/theme/colours';
import { StatusBadge } from '@/ui/bits';
import { Slip } from '@/ui/Slip';
import { ConfirmDialog } from '@/ui/Dialog';
import { editorPath } from '../editor/PageEditor';
import { NotebookDialog } from '../library/NewNotebookDialog';

const BATCH = 50; // NB-08: render long notebooks in batches

function PageCard({ notebook, page }: { notebook: Notebook; page: Page }) {
  const preview = page.lines.slice(0, 2);
  return (
    <li className="page-card">
      <Link to={editorPath(notebook.id, page.number)} className="page-card-link">
        <Slip as="span" colour={page.colour ?? notebook.colour} className="page-card-slip">
          <span className="page-card-top">
            <StatusBadge status={page.status} />
            <span>{toDisplay(page.date)}</span>
          </span>
          <span className="page-card-title">{displayTitle(page)}</span>
          {preview.map((l, i) => (
            <span key={i} className="page-card-line">
              <span>{l.description || '—'}</span>
              <span className="amount">
                {l.amountPaise === null ? l.amountText : formatPaise(l.amountPaise)}
              </span>
            </span>
          ))}
          <span className="page-card-total">
            <span>Total</span>
            <span className="amount" data-testid={`card-total-${page.number}`}>
              {formatPaise(page.totalPaise)}
            </span>
          </span>
        </Slip>
      </Link>
      <span className="page-card-actions">
        <button type="button" className="button" disabled title="Coming soon">
          Export PDF
        </button>
        <button type="button" className="button" disabled title="Coming soon">
          Export JPEG
        </button>
      </span>
    </li>
  );
}

function PageList({ notebook, pages }: { notebook: Notebook; pages: Page[] }) {
  const [shown, setShown] = useState(BATCH);
  return (
    <>
      <ol className="page-cards">
        {pages.slice(0, shown).map((p) => (
          <PageCard key={p.id} notebook={notebook} page={p} />
        ))}
      </ol>
      {pages.length > shown && (
        <button type="button" className="button" onClick={() => setShown(shown + BATCH)}>
          Show more pages
        </button>
      )}
    </>
  );
}

type DialogKind = 'rename' | 'colour' | 'delete' | 'delete-final' | null;

/** Spec §3.2: pages newest first (highest number), Archive of Final pages collapsed. */
export function NotebookScreen() {
  const { notebookId = '' } = useParams();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [message, setMessage] = useState<string | null>(null);
  const adding = useRef(false);
  const data = useLiveQuery(async () => {
    const notebook = await db.notebooks.get(notebookId);
    return { for: notebookId, notebook, pages: notebook ? await loadPages(notebookId) : [] };
  }, [notebookId]);

  useEffect(() => {
    if (data?.notebook) void updateSettings({ lastOpenedNotebookId: notebookId });
  }, [data?.notebook, notebookId]);

  if (data?.for !== notebookId) return <p className="loading">Loading…</p>;
  const { notebook, pages } = data;
  if (!notebook) {
    return <Navigate to="/" replace state={{ notice: 'That notebook no longer exists.' }} />;
  }

  const newestFirst = [...pages].reverse();
  const drafts = newestFirst.filter((p) => p.status === 'draft');
  const finals = newestFirst.filter((p) => p.status === 'final');
  const colour = slipColour(notebook.colour);

  const addPage = async () => {
    if (adding.current) return;
    adding.current = true;
    const r = await appendPage(notebook.id);
    adding.current = false;
    if (r.ok) void navigate(editorPath(notebook.id, r.value.pageNumber), { state: { focus: 0 } });
    else setMessage(repoErrorMessage(r.error));
  };

  const remove = async (confirmFinal: boolean) => {
    const r = await deleteNotebook(notebook.id, { confirmFinal });
    if (r.ok) {
      void navigate('/', {
        replace: true,
        state: { notice: `Notebook ${notebook.name} deleted.` },
      });
    } else if (!confirmFinal && finals.length > 0) {
      setDialog('delete-final');
    } else {
      setDialog(null);
      setMessage(repoErrorMessage(r.error));
    }
  };

  return (
    <section className="notebook" aria-labelledby="notebook-heading">
      <Link to="/" className="back-link">
        ‹ Notebooks
      </Link>
      <header className="notebook-header">
        <span
          className="colour-dot"
          style={{ background: colour.paper, borderColor: colour.rule }}
          aria-hidden="true"
        />
        <h1 id="notebook-heading">{notebook.name}</h1>
      </header>
      <div className="toolbar">
        <button type="button" className="button button-primary" onClick={() => void addPage()}>
          + New page
        </button>
        <button type="button" className="button" onClick={() => setDialog('rename')}>
          Rename
        </button>
        <button type="button" className="button" onClick={() => setDialog('colour')}>
          Colour
        </button>
        <button type="button" className="button" onClick={() => setDialog('delete')}>
          Delete notebook
        </button>
      </div>
      {message && (
        <p className="banner" role="alert">
          {message}
        </p>
      )}

      <h2>Pages</h2>
      {drafts.length === 0 && (
        <p className="empty">No draft pages. Final pages are in the Archive below.</p>
      )}
      <PageList notebook={notebook} pages={drafts} />
      <button type="button" className="add-page" onClick={() => void addPage()}>
        <span aria-hidden="true">+</span> Add a new page
      </button>

      <details
        className="archive"
        open={drafts.length === 0 && finals.length > 0 ? true : undefined}
      >
        <summary>Archive ({finals.length})</summary>
        {finals.length === 0 ? (
          <p className="empty">Final pages appear here.</p>
        ) : (
          <PageList notebook={notebook} pages={finals} />
        )}
      </details>

      <NotebookDialog
        key={`rename-${dialog === 'rename'}`}
        open={dialog === 'rename'}
        title="Rename notebook"
        submitLabel="Save"
        initialName={notebook.name}
        showColour={false}
        onClose={() => setDialog(null)}
        onSubmit={async (name) => {
          const r = await renameNotebook(notebook.id, name);
          if (!r.ok) return repoErrorMessage(r.error);
          setDialog(null);
          return null;
        }}
      />
      <NotebookDialog
        key={`colour-${dialog === 'colour'}`}
        open={dialog === 'colour'}
        title="Notebook colour"
        submitLabel="Save"
        initialColour={notebook.colour}
        showName={false}
        onClose={() => setDialog(null)}
        onSubmit={async (_name, c) => {
          await recolourNotebook(notebook.id, c);
          setDialog(null);
          return null;
        }}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        title={`Delete ${notebook.name}?`}
        confirmLabel="Delete notebook"
        destructive
        onCancel={() => setDialog(null)}
        onConfirm={() => void remove(false)}
      >
        <p>
          This deletes the notebook and its {pages.length} {pages.length === 1 ? 'page' : 'pages'}.
          This cannot be undone.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'delete-final'}
        title="This notebook has Final pages"
        confirmLabel={`Delete ${finals.length} Final ${finals.length === 1 ? 'page' : 'pages'} too`}
        destructive
        onCancel={() => setDialog(null)}
        onConfirm={() => void remove(true)}
      >
        <p>
          {finals.length} {finals.length === 1 ? 'page is' : 'pages are'} marked Final. Delete them
          as well?
        </p>
      </ConfirmDialog>
    </section>
  );
}
