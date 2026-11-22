import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import {
  chainErrorMessage,
  defaultTitle,
  formatPaise,
  isPageEmpty,
  LINES_PER_PAGE,
  pageTotal,
  spokenPaise,
} from '@/engine';
import {
  appendPage,
  type Notebook,
  type Page,
  type RepoError,
  TITLE_MAX,
  updateLines,
  updatePageHeader,
} from '@/db';
import { DateField } from './DateField';
import { EditingBar } from './EditingBar';
import { EditorSession } from './EditorSession';
import { amountState, fieldIndex } from './editorModel';

export const editorPath = (notebookId: string, pageNumber: number): string =>
  `/n/${notebookId}/p/${pageNumber}`;

interface Props {
  notebook: Notebook;
  page: Page;
  pageCount: number;
}

interface NavState {
  focus?: number;
  announce?: string;
}

function repoErrorText(e: RepoError): string {
  switch (e.kind) {
    case 'over-limit':
      return chainErrorMessage(e);
    case 'final-locked':
      return 'This page is Final. Reopen it to edit.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export function PageEditor({ notebook, page, pageCount }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state ?? {}) as NavState;
  const readOnly = page.status === 'final';
  const [session] = useState(() => new EditorSession(page.id, page.lines, updateLines, readOnly));
  const snap = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const creating = useRef(false);
  const lastAmount = useRef(1);
  const [hint, setHint] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [announced, setAnnounced] = useState(navState.announce ?? '');

  const total = pageTotal(page.broughtForwardPaise, session.effectiveLines(snap));
  const totalText = formatPaise(total);

  // SAV-07: the stored page changed underneath (another tab, chain recalculation, our save).
  useEffect(() => session.syncFromDb(page.lines), [session, page.lines]);

  // SAV-02: flush on route change (unmount), backgrounding and page hide.
  useEffect(() => {
    const flush = () => void session.flush();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      void session.dispose();
    };
  }, [session]);

  // Focus requested by the previous page (Enter on line 10) or the New page button.
  useEffect(() => {
    if (navState.focus !== undefined) inputs.current[navState.focus]?.focus();
  }, [location.key, navState.focus]);

  // A11Y-02: announce the total politely, throttled so it does not chatter on each key.
  useEffect(() => {
    const t = setTimeout(() => setAnnounced(`Total ${spokenPaise(total)}`), 1200);
    return () => clearTimeout(t);
  }, [total]);

  const goTo = async (pageNumber: number, state: NavState = { focus: 0 }) => {
    await session.flush();
    void navigate(editorPath(notebook.id, pageNumber), { state });
  };

  /** KBD-03, KBD-06: flush, append, open, focus line 1 — exactly once per press. */
  const createPage = async () => {
    if (creating.current) return;
    creating.current = true;
    try {
      session.commitAmount(LINES_PER_PAGE - 1);
      const saved = await session.flush();
      if (!saved && session.getSnapshot().save.state === 'error') return;
      const r = await appendPage(notebook.id);
      if (!r.ok) {
        setHint(repoErrorText(r.error));
        return;
      }
      void navigate(editorPath(notebook.id, r.value.pageNumber), {
        state: {
          focus: 0,
          announce: `Page ${r.value.pageNumber} started, brought forward ${formatPaise(total)}`,
        },
      });
    } finally {
      creating.current = false;
    }
  };

  const nextFrom = (index: number) => {
    const line = Math.floor(index / 2);
    setHint(null);
    if (index % 2 === 0) {
      inputs.current[index + 1]?.focus();
      return;
    }
    if (session.isRejected(line)) return; // EDT-02: focus and message stay
    if (line < LINES_PER_PAGE - 1) {
      inputs.current[index + 1]?.focus();
      return;
    }
    session.commitAmount(line);
    if (page.number < pageCount) {
      void goTo(page.number + 1); // KBD-04 / KBD-09: never insert a page in the middle
      return;
    }
    if (readOnly) return;
    if (isPageEmpty(session.effectiveLines())) {
      setHint('Add a line before starting a new page'); // KBD-05
      return;
    }
    void createPage();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    if (e.nativeEvent.isComposing || e.keyCode === 229) return; // KBD-07
    e.preventDefault();
    nextFrom(index);
  };

  const saveTitle = () => {
    if (titleDraft === null) return;
    const value = titleDraft;
    setTitleDraft(null);
    if ((value.trim() || null) !== page.title) void updatePageHeader(page.id, { title: value });
  };

  const save = snap.save;
  const amountFocused = snap.focused !== null && snap.focused % 2 === 1;

  return (
    <article className="editor" aria-labelledby="editor-heading">
      <header className="editor-header">
        <p className="notebook-name">{notebook.name}</p>
        <div className="page-nav">
          {page.number > 1 ? (
            <Link
              to={editorPath(notebook.id, page.number - 1)}
              className="nav-link"
              aria-label="Previous page"
            >
              ‹
            </Link>
          ) : (
            <span className="nav-link" aria-hidden="true" />
          )}
          <h1 id="editor-heading">
            Page {page.number} of {pageCount}
          </h1>
          {page.number < pageCount ? (
            <Link
              to={editorPath(notebook.id, page.number + 1)}
              className="nav-link"
              aria-label="Next page"
            >
              ›
            </Link>
          ) : (
            <span className="nav-link" aria-hidden="true" />
          )}
        </div>
        <div className="header-fields">
          <DateField
            value={page.date}
            readOnly={readOnly}
            onChange={(date) => void updatePageHeader(page.id, { date })}
          />
          <div className="title-field">
            <label htmlFor="page-title">Title</label>
            <input
              id="page-title"
              type="text"
              placeholder={defaultTitle(page.number)}
              maxLength={TITLE_MAX}
              readOnly={readOnly}
              value={titleDraft ?? page.title ?? ''}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  inputs.current[0]?.focus();
                }
              }}
            />
          </div>
        </div>
        <p className="save-status" role="status">
          {save.state === 'saving' && 'Saving…'}
          {save.state === 'saved' && 'Saved'}
        </p>
      </header>

      {save.state === 'error' && (
        <div className="banner banner-error" role="alert">
          <span>{save.message}</span>
          {save.retry && (
            <button type="button" onClick={() => void session.retry()}>
              Retry
            </button>
          )}
        </div>
      )}
      {snap.notice && (
        <div className="banner" role="status">
          <span>{snap.notice}</span>
          <button type="button" onClick={() => session.dismissNotice()}>
            OK
          </button>
        </div>
      )}

      <div className={`slip slip-${page.colour ?? notebook.colour}`}>
        <div className="row bf-row">
          <span>Brought forward</span>
          <span
            className="amount"
            aria-label={spokenPaise(page.broughtForwardPaise)}
            data-testid="brought-forward"
          >
            {formatPaise(page.broughtForwardPaise)}
          </span>
        </div>
        <ol className="lines">
          {snap.lines.map((line, i) => {
            const descIndex = fieldIndex(i, 0);
            const amtIndex = fieldIndex(i, 1);
            const focused = snap.focused === amtIndex;
            const state = amountState(line.amountText);
            const flagged = !focused && state.kind === 'invalid' && line.amountText.trim() !== '';
            const shown =
              !focused && state.kind === 'ok' ? formatPaise(state.paise) : line.amountText;
            const message = snap.messages[i];
            const msgId = `line-${i + 1}-msg`;
            const spokenId = `line-${i + 1}-spoken`;
            const negative = state.kind === 'ok' && state.paise < 0;
            return (
              <li key={i} className="row line">
                <input
                  ref={(el) => {
                    inputs.current[descIndex] = el;
                  }}
                  className="desc"
                  type="text"
                  dir="auto"
                  enterKeyHint="next"
                  aria-label={`Line ${i + 1} description`}
                  readOnly={readOnly}
                  value={line.description}
                  onChange={(e) => session.setDescription(i, e.target.value)}
                  onFocus={() => session.focus(descIndex)}
                  onBlur={() => session.blur(descIndex)}
                  onKeyDown={(e) => onKeyDown(e, descIndex)}
                />
                <span className="amount-cell">
                  {flagged && (
                    <span className="flag" role="img" aria-label="Not a number, counted as zero">
                      ●
                    </span>
                  )}
                  <input
                    ref={(el) => {
                      inputs.current[amtIndex] = el;
                    }}
                    className="amount"
                    type="text"
                    inputMode="decimal"
                    enterKeyHint="next"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    aria-label={`Line ${i + 1} amount`}
                    aria-invalid={flagged || state.kind === 'rejected' ? true : undefined}
                    aria-describedby={
                      [message ? msgId : '', negative ? spokenId : ''].join(' ').trim() || undefined
                    }
                    readOnly={readOnly}
                    value={shown}
                    onChange={(e) => session.setAmount(i, e.target.value)}
                    onFocus={(e) => {
                      // FMT-06: show the raw text while focused. Swap it synchronously so the
                      // value never changes under the user's caret or selection.
                      // If the text changed (formatted → raw), select it all so typing replaces it.
                      if (e.currentTarget.value !== line.amountText) {
                        e.currentTarget.value = line.amountText;
                        e.currentTarget.select();
                      }
                      lastAmount.current = amtIndex;
                      session.focus(amtIndex);
                    }}
                    onBlur={() => session.blur(amtIndex)}
                    onKeyDown={(e) => onKeyDown(e, amtIndex)}
                  />
                  {negative && (
                    <span id={spokenId} className="visually-hidden">
                      {spokenPaise(state.paise)}
                    </span>
                  )}
                </span>
                {message && (
                  <p id={msgId} className="field-message" role="alert">
                    {message}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
        <div className="row total-row">
          <span>Total</span>
          <span className="amount" aria-label={spokenPaise(total)} data-testid="total">
            {totalText}
          </span>
        </div>
      </div>

      {hint && (
        <p className="hint" role="status">
          {hint}
        </p>
      )}
      {!readOnly && (
        <div className="editor-actions">
          <button type="button" className="button" onClick={() => void createPage()}>
            New page
          </button>
        </div>
      )}
      <p className="visually-hidden" aria-live="polite">
        {announced}
      </p>
      <EditingBar
        visible={amountFocused && !readOnly}
        onToggleSign={() => session.toggleSign(Math.floor(lastAmount.current / 2))}
        onNext={() => nextFrom(lastAmount.current)}
      />
    </article>
  );
}
