import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { displayTitle, formatPaise, normalise, search } from '@/engine';
import { createNotebook, db, notebookSummaries, recentActivity, repoErrorMessage } from '@/db';
import { AddBookTile, NotebookStack, StatusBadge } from '@/ui/bits';
import { ReminderBanner } from '../backup/ReminderBanner';
import { editorPath, notebookPath } from '../paths';
import { NotebookDialog } from './NewNotebookDialog';

function SearchResults({ query }: { query: string }) {
  const data = useLiveQuery(async () => {
    const [notebooks, pages] = await Promise.all([db.notebooks.toArray(), db.pages.toArray()]);
    return { notebooks, pages, hits: search(query, notebooks, pages) };
  }, [query]);
  if (!data) return null;
  if (data.hits.length === 0) {
    return (
      <p className="empty">
        No notebooks or pages match. Search looks at notebook names, page titles and line
        descriptions.
      </p>
    );
  }
  const byId = new Map(data.pages.map((p) => [p.id, p]));
  return (
    <ul className="search-results" aria-label="Search results">
      {data.hits.map((hit) => {
        const nb = data.notebooks.find((n) => n.id === hit.notebookId);
        if (!nb) return null;
        return (
          <li key={hit.notebookId}>
            <Link to={notebookPath(nb.id)} className="result-notebook">
              {nb.name}
            </Link>
            {hit.pageIds.length > 0 && (
              <ul>
                {hit.pageIds.map((id) => {
                  const p = byId.get(id);
                  if (!p) return null;
                  return (
                    <li key={id}>
                      <Link to={editorPath(nb.id, p.number)} className="result-page">
                        {displayTitle(p)} <StatusBadge status={p.status} />{' '}
                        <span className="amount">{formatPaise(p.totalPaise)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Spec §3.1: notebooks home with search, stacks, "Add a new book" and recent activity. */
export function LibraryScreen() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const creating = params.get('new') === '1';
  const summaries = useLiveQuery(notebookSummaries, []);
  const activity = useLiveQuery(async () => {
    const [entries, notebooks, pages] = await Promise.all([
      recentActivity(5),
      db.notebooks.toArray(),
      db.pages.toArray(),
    ]);
    return { entries, notebookIds: new Set(notebooks.map((n) => n.id)), pages };
  }, []);

  const openCreate = () => setParams({ new: '1' });
  const closeCreate = () => setParams({}, { replace: true });
  const searching = normalise(query) !== '';

  return (
    <section className="library" aria-labelledby="library-heading">
      <h1 id="library-heading">Notebooks</h1>
      <ReminderBanner />
      <label className="search">
        <span className="visually-hidden">Search</span>
        <input
          type="search"
          placeholder="Find a notebook or page…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {searching ? (
        <SearchResults query={query} />
      ) : (
        <>
          {summaries && summaries.length === 0 && (
            <p className="hint">Create your first notebook to start adding up expenses.</p>
          )}
          <div className="stacks">
            {summaries?.map((s) => (
              <NotebookStack
                key={s.notebook.id}
                to={notebookPath(s.notebook.id)}
                name={s.notebook.name}
                colour={s.notebook.colour}
                pageCount={s.pageCount}
                latestTotal={formatPaise(s.latestTotal)}
              />
            ))}
            <AddBookTile onClick={openCreate} />
          </div>

          {activity && activity.entries.length > 0 && (
            <section className="activity" aria-labelledby="activity-heading">
              <h2 id="activity-heading">Recent activity</h2>
              <ol>
                {activity.entries.map((e) => {
                  const page = e.pageId ? activity.pages.find((p) => p.id === e.pageId) : undefined;
                  const live = e.notebookId !== null && activity.notebookIds.has(e.notebookId);
                  return (
                    <li key={e.id}>
                      {live && e.notebookId ? (
                        <Link
                          to={
                            page
                              ? editorPath(e.notebookId, page.number)
                              : notebookPath(e.notebookId)
                          }
                        >
                          {e.text}
                        </Link>
                      ) : (
                        e.text
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </>
      )}

      <NotebookDialog
        key={creating ? 'open' : 'closed'}
        open={creating}
        title="Add a new book"
        submitLabel="Create"
        onClose={closeCreate}
        onSubmit={async (name, colour) => {
          const r = await createNotebook(name, colour);
          if (!r.ok) return repoErrorMessage(r.error);
          void navigate(editorPath(r.value.notebookId, 1), { replace: true, state: { focus: 0 } });
          return null;
        }}
      />
    </section>
  );
}
