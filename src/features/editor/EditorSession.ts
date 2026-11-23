import { chainErrorMessage, type Line, type Paise, UNSUPPORTED_TEXT_MESSAGE } from '@/engine';
import type { LinePatch, RepoResult } from '@/db';
import { requestPersistenceOnce } from '@/platform/storage';
import {
  amountState,
  cleanDescription,
  descriptionForSave,
  fieldIndex,
  type LocalLine,
  sameLine,
  toggleSign,
  toStoredLine,
} from './editorModel';

export const AUTOSAVE_MS = 400;
export const CHANGED_ELSEWHERE = 'This page was changed in another window';
export const SAVE_FAILED = 'Couldn’t save — your typing is kept on screen';

export type SaveState =
  | { state: 'idle' }
  | { state: 'saving' }
  | { state: 'saved' }
  | { state: 'error'; message: string; retry: boolean };

export interface EditorSnapshot {
  lines: LocalLine[];
  /** Last committed (valid or committed-invalid) stored value of each line. */
  committed: Line[];
  focused: number | null;
  /** Message under a line (rejected amount, too long, cut description). */
  messages: Record<number, string>;
  notice: string | null;
  save: SaveState;
}

export type SaveLines = (pageId: string, patches: LinePatch[]) => Promise<RepoResult>;

const toLocal = (l: Line): LocalLine => ({ description: l.description, amountText: l.amountText });

/**
 * Per-page editor state outside React (arch §7.2): local text, committed values, 400 ms
 * debounced autosave of only the dirty lines, and per-line conflict handling (MTB-02).
 */
export class EditorSession {
  private snap: EditorSnapshot;
  private readonly listeners = new Set<() => void>();
  private readonly dirty = new Set<number>();
  private readonly conflicts = new Set<number>();
  private base: Line[];
  private readonly inFlight = new Map<number, Line>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private saving: Promise<boolean> | null = null;
  private disposed = false;

  constructor(
    private readonly pageId: string,
    stored: readonly Line[],
    private readonly saveLines: SaveLines,
    private readonly readOnly = false,
  ) {
    this.base = stored.map((l) => ({ ...l }));
    this.snap = {
      lines: stored.map(toLocal),
      committed: stored.map((l) => ({ ...l })),
      focused: null,
      messages: {},
      notice: null,
      save: { state: 'idle' },
    };
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): EditorSnapshot => this.snap;

  private set(patch: Partial<EditorSnapshot>): void {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  private setMessage(line: number, message: string | null): void {
    const messages = { ...this.snap.messages };
    if (message === null) delete messages[line];
    else messages[line] = message;
    this.set({ messages });
  }

  private setLine(i: number, local: LocalLine): void {
    const lines = [...this.snap.lines];
    lines[i] = local;
    this.dirty.add(i);
    this.set({ lines });
    this.schedule();
  }

  /** Amount counted in the live total (EDT-04: last valid value while typing). */
  effectivePaise(i: number, snap: EditorSnapshot = this.snap): Paise | null {
    const local = snap.lines[i] as LocalLine;
    const s = amountState(local.amountText);
    if (s.kind === 'ok') return s.paise;
    if (s.kind === 'empty') return null;
    if (s.kind === 'rejected' || snap.focused === fieldIndex(i, 1)) {
      return (snap.committed[i] as Line).amountPaise;
    }
    return null;
  }

  /** Lines as the total and export see them right now. */
  effectiveLines(snap: EditorSnapshot = this.snap): Line[] {
    return snap.lines.map((l, i) => ({
      description: l.description,
      amountText: l.amountText,
      amountPaise: this.effectivePaise(i, snap),
    }));
  }

  /** True when the amount field shows a value that cannot be saved yet. */
  isHeld(i: number): boolean {
    const s = amountState((this.snap.lines[i] as LocalLine).amountText);
    return (
      s.kind === 'rejected' || (s.kind === 'invalid' && this.snap.focused === fieldIndex(i, 1))
    );
  }

  isRejected(i: number): boolean {
    return amountState((this.snap.lines[i] as LocalLine).amountText).kind === 'rejected';
  }

  setDescription(i: number, text: string): void {
    if (this.readOnly) return;
    const { text: clean, cut, removed } = cleanDescription(text);
    this.setLine(i, { ...(this.snap.lines[i] as LocalLine), description: clean });
    this.setMessage(i, removed ? UNSUPPORTED_TEXT_MESSAGE : cut ? 'Cut to 120 characters' : null);
  }

  setAmount(i: number, text: string): void {
    if (this.readOnly) return;
    const local = { ...(this.snap.lines[i] as LocalLine), amountText: text };
    const s = amountState(text);
    // Arch §5.2: every valid keystroke becomes "the last valid value" kept by a rejection.
    if (s.kind === 'ok' || s.kind === 'empty') {
      const committed = [...this.snap.committed];
      committed[i] = toStoredLine(local);
      this.set({ committed });
    }
    this.setLine(i, local);
    this.setMessage(
      i,
      s.kind === 'rejected' || (s.kind === 'invalid' && s.message) ? s.message : null,
    );
  }

  toggleSign(i: number): void {
    const text = (this.snap.lines[i] as LocalLine).amountText;
    const next = toggleSign(text);
    if (next !== text) this.setAmount(i, next);
  }

  focus(index: number): void {
    this.set({ focused: index });
  }

  /** Leaving a field: commit or revert the amount, resolve conflicts, then save. */
  blur(index: number): void {
    const line = Math.floor(index / 2);
    if (this.snap.focused === index) this.set({ focused: null });
    if (index % 2 === 1) this.commitAmount(line);
    if (this.conflicts.has(line)) this.takeExternal(line);
    void this.flush();
  }

  /** EDT-03: a rejected value reverts to the last valid one; invalid is committed and flagged. */
  commitAmount(i: number): void {
    const local = this.snap.lines[i] as LocalLine;
    const s = amountState(local.amountText);
    if (s.kind === 'rejected') {
      const committed = this.snap.committed[i] as Line;
      const lines = [...this.snap.lines];
      lines[i] = { ...local, amountText: committed.amountText };
      this.set({ lines });
      this.setMessage(i, `Not saved: ${s.message}`);
      return;
    }
    const committed = [...this.snap.committed];
    committed[i] = { ...toStoredLine(local) };
    this.set({ committed });
  }

  private takeExternal(i: number): void {
    const external = this.base[i] as Line;
    const lines = [...this.snap.lines];
    lines[i] = toLocal(external);
    const committed = [...this.snap.committed];
    committed[i] = { ...external };
    this.conflicts.delete(i);
    this.dirty.delete(i);
    this.set({ lines, committed, notice: CHANGED_ELSEWHERE });
  }

  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), AUTOSAVE_MS);
  }

  /** The value to store for line i now: held amounts keep their committed value. */
  private storedValue(i: number): Line {
    const local = this.snap.lines[i] as LocalLine;
    if (this.isHeld(i)) {
      const committed = this.snap.committed[i] as Line;
      return { ...committed, description: descriptionForSave(local.description) };
    }
    return toStoredLine(local);
  }

  /** Saves every dirty line now. Resolves true when nothing is left unsaved. */
  flush(): Promise<boolean> {
    clearTimeout(this.timer);
    if (this.saving) return this.saving.then(() => (this.dirty.size > 0 ? this.flush() : true));
    const patches: LinePatch[] = [];
    for (const i of [...this.dirty].sort((a, b) => a - b)) {
      if (this.conflicts.has(i)) continue;
      const line = this.storedValue(i);
      if (sameLine(line, this.base[i])) {
        if (!this.isHeld(i)) this.dirty.delete(i);
        continue;
      }
      patches.push({ index: i, line });
    }
    if (patches.length === 0) return Promise.resolve(this.dirty.size === 0);
    patches.forEach((p) => this.inFlight.set(p.index, p.line));
    if (!this.disposed) this.set({ save: { state: 'saving' } });
    this.saving = this.saveLines(this.pageId, patches)
      .then((r) => this.afterSave(patches, r))
      .catch(() => this.afterSave(patches, null))
      .finally(() => {
        this.saving = null;
      });
    return this.saving;
  }

  private afterSave(patches: LinePatch[], r: RepoResult | null): boolean {
    patches.forEach((p) => this.inFlight.delete(p.index));
    if (r?.ok) {
      for (const { index, line } of patches) {
        this.base[index] = line;
        if (sameLine(this.storedValue(index), line) && !this.isHeld(index))
          this.dirty.delete(index);
      }
      if (!this.disposed) this.set({ save: { state: 'saved' } });
      void requestPersistenceOnce();
      return this.dirty.size === 0;
    }
    const message =
      r && !r.ok && r.error.kind === 'over-limit'
        ? chainErrorMessage(r.error)
        : r && !r.ok && r.error.kind === 'final-locked'
          ? 'This page is Final. Reopen it to edit.'
          : SAVE_FAILED;
    if (!this.disposed) {
      this.set({ save: { state: 'error', message, retry: r === null || !r.ok } });
    }
    return false;
  }

  retry(): Promise<boolean> {
    return this.flush();
  }

  /** SAV-07 / MTB-02: the stored page changed (this tab's save, another tab, recalculation). */
  syncFromDb(stored: readonly Line[]): void {
    let lines = this.snap.lines;
    let committed = this.snap.committed;
    let notice = this.snap.notice;
    stored.forEach((dbLine, i) => {
      if (sameLine(dbLine, this.base[i])) return;
      if (sameLine(dbLine, this.inFlight.get(i))) {
        this.base[i] = { ...dbLine };
        return;
      }
      this.base[i] = { ...dbLine };
      if (!this.dirty.has(i)) {
        lines = lines === this.snap.lines ? [...lines] : lines;
        committed = committed === this.snap.committed ? [...committed] : committed;
        lines[i] = toLocal(dbLine);
        committed[i] = { ...dbLine };
      } else {
        this.conflicts.add(i);
        notice = CHANGED_ELSEWHERE;
      }
    });
    if (lines !== this.snap.lines || notice !== this.snap.notice) {
      this.set({ lines, committed, notice });
    }
  }

  dismissNotice(): void {
    this.set({ notice: null });
  }

  hasUnsaved(): boolean {
    return this.dirty.size > 0;
  }

  dispose(): Promise<boolean> {
    const done = this.flush();
    this.disposed = true;
    return done;
  }
}
