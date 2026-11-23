import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import {
  countFlagged,
  filterSupportedText,
  defaultTitle,
  formatPaise,
  isPageEmpty,
  LINES_PER_PAGE,
  pageTotal,
  spokenPaise,
  toDisplay,
  UNSUPPORTED_TEXT_MESSAGE,
} from '@/engine';
import {
  appendPage,
  deleteDraftPage,
  finalisePage,
  type Notebook,
  type Page,
  reopenPage,
  repoErrorMessage,
  TITLE_MAX,
  updateLines,
  updatePageHeader,
} from '@/db';
import { ColourPicker } from '@/ui/ColourPicker';
import { ConfirmDialog, Dialog } from '@/ui/Dialog';
import { ExportControls } from '../export/ExportControls';
import { Slip } from '@/ui/Slip';
import { slipColour } from '@/theme/colours';
import { editorPath } from '../paths';
import { DateField } from './DateField';
import { EditingBar } from './EditingBar';
import { EditorSession } from './EditorSession';
import { amountState, fieldIndex } from './editorModel';

const displayTitleOf = (page: Page): string => page.title ?? defaultTitle(page.number);

interface Props {
  notebook: Notebook;
  page: Page;
  pageCount: number;
}

interface NavState {
  focus?: number;
  announce?: string;
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
  const [titleRemoved, setTitleRemoved] = useState(false);
  const [announced, setAnnounced] = useState(navState.announce ?? '');
  const [dialog, setDialog] = useState<'final' | 'delete' | 'colour' | null>(null);
  const effectiveColour = page.colour ?? notebook.colour;
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);

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
        setHint(repoErrorMessage(r.error));
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

  const flaggedCount = countFlagged(session.effectiveLines(snap));
  const finalBlocked =
    flaggedCount > 0 ? repoErrorMessage({ kind: 'invalid-amounts', count: flaggedCount }) : null;

  /** LIF-04 / SAV-06: pending edits are flushed first, so the Final page has the last keystroke. */
  const markFinal = async () => {
    setDialog(null);
    await session.flush();
    const r = await finalisePage(page.id);
    setLifecycleError(r.ok ? null : repoErrorMessage(r.error));
  };

  const reopen = async () => {
    const r = await reopenPage(page.id);
    setLifecycleError(r.ok ? null : repoErrorMessage(r.error));
  };

  const askDelete = () => {
    if (pageCount === 1) {
      setLifecycleError(repoErrorMessage({ kind: 'only-page' })); // LIF-10
      return;
    }
    setDialog('delete');
  };

  const remove = async () => {
    setDialog(null);
    const r = await deleteDraftPage(page.id);
    if (r.ok) {
      void navigate(`/n/${notebook.id}`, {
        replace: true,
        state: { notice: `${displayTitleOf(page)} deleted. Later pages were renumbered.` },
      });
    } else {
      setLifecycleError(repoErrorMessage(r.error));
    }
  };

  const save = snap.save;
  const latestReopen = page.reopenedOn.at(-1);
  const amountFocused = snap.focused !== null && snap.focused % 2 === 1;

  return (
    <article className="editor" aria-labelledby="editor-heading">
      <header className="editor-header">
        <Link to={`/n/${notebook.id}`} className="back-link">
          ‹ {notebook.name}
        </Link>
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
          <div className="colour-field">
            <span className="field-label" aria-hidden="true">
              Colour
            </span>
            <button
              type="button"
              className="colour-dot-button"
              aria-label={`Page colour: ${slipColour(effectiveColour).label}${page.colour ? '' : ' (notebook colour)'}`}
              disabled={readOnly}
              onClick={() => setDialog('colour')}
            >
              <span
                className="colour-dot"
                style={{
                  background: slipColour(effectiveColour).paper,
                  borderColor: slipColour(effectiveColour).rule,
                }}
              />
            </button>
          </div>
          <div className="title-field">
            <label htmlFor="page-title">Title</label>
            <input
              id="page-title"
              type="text"
              placeholder={defaultTitle(page.number)}
              maxLength={TITLE_MAX}
              readOnly={readOnly}
              value={titleDraft ?? page.title ?? ''}
              aria-describedby={titleRemoved ? 'title-msg' : undefined}
              onChange={(e) => {
                const { text, removed } = filterSupportedText(e.target.value);
                setTitleRemoved(removed);
                setTitleDraft(text);
              }}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  inputs.current[0]?.focus();
                }
              }}
            />
            {titleRemoved && (
              <p id="title-msg" className="field-message" role="alert">
                {UNSUPPORTED_TEXT_MESSAGE}
              </p>
            )}
          </div>
        </div>
        <ul className="page-notes">
          {readOnly && page.finalisedOn && <li>Final since {toDisplay(page.finalisedOn)}</li>}
          {latestReopen && <li>Reopened on {toDisplay(latestReopen)}</li>}
          {page.totalUpdatedOn && (
            <li>Total updated from earlier page on {toDisplay(page.totalUpdatedOn)}</li>
          )}
        </ul>
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

      <Slip colour={effectiveColour} className="editor-slip">
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
                      // Only when the field still holds exactly the formatted text we rendered:
                      // if something already changed it (a fast fill, autofill, an IME), the
                      // user's text must never be overwritten by a late focus event.
                      if (shown !== line.amountText && e.currentTarget.value === shown) {
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
      </Slip>

      {hint && (
        <p className="hint" role="status">
          {hint}
        </p>
      )}
      {lifecycleError && (
        <p className="banner banner-error" role="alert">
          {lifecycleError}
        </p>
      )}
      <div className="editor-actions">
        {!readOnly && (
          <button type="button" className="button" onClick={() => void createPage()}>
            New page
          </button>
        )}
        {readOnly ? (
          <button type="button" className="button button-primary" onClick={() => void reopen()}>
            Reopen
          </button>
        ) : (
          <button
            type="button"
            className="button button-primary"
            aria-disabled={finalBlocked ? true : undefined}
            aria-describedby={finalBlocked ? 'final-blocked' : undefined}
            onClick={() => {
              if (!finalBlocked) setDialog('final');
            }}
          >
            Mark as Final
          </button>
        )}
        {!readOnly && (
          <button type="button" className="button" onClick={askDelete}>
            Delete page
          </button>
        )}
      </div>
      <ExportControls pageId={page.id} beforeExport={() => session.flush()} />
      {!readOnly && finalBlocked && (
        <p id="final-blocked" className="hint">
          {finalBlocked}
        </p>
      )}
      <Dialog
        open={dialog === 'colour'}
        title="Page colour"
        onClose={() => setDialog(null)}
        actions={
          <>
            <button
              type="button"
              className="button"
              onClick={() => {
                setDialog(null);
                void updatePageHeader(page.id, { colour: null });
              }}
            >
              Use notebook colour
            </button>
            <button type="button" className="button button-primary" onClick={() => setDialog(null)}>
              Done
            </button>
          </>
        }
      >
        <ColourPicker
          value={effectiveColour}
          legend="Colour for this page"
          onChange={(colour) => void updatePageHeader(page.id, { colour })}
        />
      </Dialog>
      <ConfirmDialog
        open={dialog === 'final'}
        title={`Mark ${displayTitleOf(page)} as Final?`}
        confirmLabel="Mark as Final"
        onCancel={() => setDialog(null)}
        onConfirm={() => void markFinal()}
      >
        <p>The page will be locked and moved to the notebook’s Archive. You can reopen it later.</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'delete'}
        title={`Delete ${displayTitleOf(page)}?`}
        confirmLabel="Delete page"
        destructive
        onCancel={() => setDialog(null)}
        onConfirm={() => void remove()}
      >
        <p>Later pages will be renumbered and their brought-forward amounts recalculated.</p>
      </ConfirmDialog>
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
