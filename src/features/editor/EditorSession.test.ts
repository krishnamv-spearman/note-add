import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aLine, linesOf } from '../../../tests/builders';
import type { LinePatch, RepoResult } from '@/db';
import { AUTOSAVE_MS, CHANGED_ELSEWHERE, EditorSession, SAVE_FAILED } from './EditorSession';
import { cleanDescription, toggleSign, TOO_LONG } from './editorModel';

type Saved = { pageId: string; patches: LinePatch[] };

function setup(stored = linesOf(), result: RepoResult = { ok: true, value: undefined }) {
  const calls: Saved[] = [];
  const save = vi.fn((pageId: string, patches: LinePatch[]) => {
    calls.push({ pageId, patches });
    return Promise.resolve(result);
  });
  const session = new EditorSession('page-1', stored, save);
  return { session, save, calls };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('autosave', () => {
  it('SAV-01: one write per 400 ms pause, only the dirty lines', async () => {
    const { session, save, calls } = setup();
    session.setDescription(0, 'T');
    session.setDescription(0, 'Ta');
    session.setAmount(0, '45');
    session.setAmount(0, '450');
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS - 1);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(calls[0]?.patches).toEqual([{ index: 0, line: aLine('450', 'Ta') }]);
    expect(session.getSnapshot().save).toEqual({ state: 'saved' });
    expect(session.hasUnsaved()).toBe(false);
  });

  it('shows Saving… while a write is in flight', () => {
    const { session } = setup();
    session.setAmount(1, '5');
    void session.flush();
    expect(session.getSnapshot().save).toEqual({ state: 'saving' });
  });

  it('SAV-02: flush on blur writes immediately', async () => {
    const { session, save } = setup();
    session.focus(1);
    session.setAmount(0, '12');
    session.blur(1);
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  });

  it('SAV-04: a failed save keeps the typing and offers Retry', async () => {
    const { session, save } = setup();
    save.mockImplementationOnce(() => Promise.reject(new Error('QuotaExceededError')));
    session.setAmount(0, '12');
    expect(await session.flush()).toBe(false);
    expect(session.getSnapshot().save).toEqual({
      state: 'error',
      message: SAVE_FAILED,
      retry: true,
    });
    expect(session.getSnapshot().lines[0]?.amountText).toBe('12');
    expect(await session.retry()).toBe(true);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('SAV-05 / TOT-04: a chain error names the page and keeps local state', async () => {
    const { session } = setup(linesOf(), {
      ok: false,
      error: { kind: 'over-limit', pageNumber: 40 },
    });
    session.setAmount(0, '99,99,99,999.99');
    expect(await session.flush()).toBe(false);
    expect(session.getSnapshot().save).toMatchObject({
      state: 'error',
      message: 'This would make the total on page 40 more than ₹99.99 crore',
    });
    expect(session.getSnapshot().lines[0]?.amountText).toBe('99,99,99,999.99');
  });

  it('a Final page refusal is explained', async () => {
    const { session } = setup(linesOf(), { ok: false, error: { kind: 'final-locked' } });
    session.setAmount(0, '1');
    await session.flush();
    expect(session.getSnapshot().save).toMatchObject({
      message: 'This page is Final. Reopen it to edit.',
    });
  });

  it('a flush during a save waits for it, then saves the rest', async () => {
    const { session, calls } = setup();
    session.setAmount(0, '1');
    const first = session.flush();
    session.setAmount(1, '2');
    const second = session.flush();
    await first;
    expect(await second).toBe(true);
    expect(calls.map((c) => c.patches.map((p) => p.index))).toEqual([[0], [1]]);
  });

  it('nothing dirty → no write', async () => {
    const { session, save } = setup(linesOf(['5']));
    session.setAmount(0, '5');
    expect(await session.flush()).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it('dispose flushes pending edits', async () => {
    const { session, save } = setup();
    session.setAmount(0, '3');
    await session.dispose();
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe('amounts', () => {
  it('MON-05 / EDT-03: rejected keeps the last valid value; leaving reverts with a message', async () => {
    const { session, calls } = setup(linesOf(['450']));
    session.focus(1);
    session.setAmount(0, '450.505');
    expect(session.getSnapshot().messages[0]).toBe('Up to 2 decimal places, for example 450.50');
    expect(session.effectivePaise(0)).toBe(45000);
    expect(session.isRejected(0)).toBe(true);
    session.blur(1);
    expect(session.getSnapshot().lines[0]?.amountText).toBe('450');
    expect(session.getSnapshot().messages[0]).toBe(
      'Not saved: Up to 2 decimal places, for example 450.50',
    );
    await session.flush();
    expect(calls).toEqual([]);
  });

  it('EDT-04: intermediate states are not flagged and keep the last valid total while focused', () => {
    const { session } = setup(linesOf(['450']));
    session.focus(1);
    for (const t of ['-', '.', '(', '45o']) {
      session.setAmount(0, t);
      expect(session.effectivePaise(0)).toBe(45000);
      expect(session.isHeld(0)).toBe(true);
    }
    session.setAmount(0, '450.');
    expect(session.effectivePaise(0)).toBe(45000);
  });

  it('CHN-13: invalid text is committed as zero (flagged) on blur, and saved', async () => {
    const { session, calls } = setup(linesOf(['450']));
    session.focus(1);
    session.setAmount(0, '45o');
    await session.flush();
    expect(calls).toEqual([]); // held while focused
    session.blur(1);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.patches[0]?.line).toEqual({
      description: '',
      amountText: '45o',
      amountPaise: null,
    });
    expect(session.effectivePaise(0)).toBeNull();
  });

  it('a held amount still lets its description save', async () => {
    const { session, calls } = setup(linesOf(['450']));
    session.focus(1);
    session.setAmount(0, '-');
    session.setDescription(0, 'Refund');
    await session.flush();
    expect(calls[0]?.patches[0]?.line).toEqual({ ...aLine('450'), description: 'Refund' });
    expect(session.hasUnsaved()).toBe(true);
  });

  it('PST-04 / PST-12: multi-value and over-long pastes are kept and invalid', () => {
    const { session } = setup();
    session.setAmount(0, '450\t300');
    expect(session.effectivePaise(0)).toBeNull();
    session.setAmount(1, '1'.repeat(25));
    expect(session.getSnapshot().messages[1]).toBe(TOO_LONG);
    expect(session.getSnapshot().lines[1]?.amountText).toHaveLength(25);
  });

  it('TOT-03: amount with no description is fine', async () => {
    const { session, calls } = setup();
    session.setAmount(0, '5');
    await session.flush();
    expect(calls[0]?.patches[0]?.line).toEqual(aLine('5'));
  });

  it('KBD-11: ± toggles sign; empty inserts "-"; invalid unchanged', () => {
    expect(toggleSign('')).toBe('-');
    expect(toggleSign('450')).toBe('-450');
    expect(toggleSign('-450')).toBe('450');
    expect(toggleSign('+450')).toBe('-450');
    expect(toggleSign('(300.00)')).toBe('300.00');
    expect(toggleSign('abc')).toBe('abc');
    expect(toggleSign('450.505')).toBe('-450.505');
    const { session } = setup(linesOf(['abc']));
    session.toggleSign(0);
    expect(session.getSnapshot().lines[0]?.amountText).toBe('abc');
    session.toggleSign(1);
    expect(session.getSnapshot().lines[1]?.amountText).toBe('-');
  });
});

describe('descriptions', () => {
  it('EDT-05 / EDT-06: newlines and tabs become spaces; cut at 120 with a notice', () => {
    expect(cleanDescription('a\r\nb\tc')).toEqual({ text: 'a b c', cut: false });
    const { session } = setup();
    session.setDescription(0, 'x'.repeat(130));
    expect(session.getSnapshot().lines[0]?.description).toHaveLength(120);
    expect(session.getSnapshot().messages[0]).toBe('Cut to 120 characters');
    session.setDescription(0, 'short');
    expect(session.getSnapshot().messages[0]).toBeUndefined();
  });

  it('EDT-07 / PST-13: only spaces save as empty; "Taxi 450" stays a description', async () => {
    const { session, calls } = setup(linesOf([], ['old', 'x']));
    session.setDescription(0, '   ');
    session.setDescription(1, 'Taxi 450');
    await session.flush();
    expect(calls[0]?.patches.map((p) => p.line)).toEqual([
      { description: '', amountText: '', amountPaise: null },
      { description: 'Taxi 450', amountText: '', amountPaise: null },
    ]);
  });

  it('read-only (Final) sessions ignore edits', () => {
    const session = new EditorSession('p', linesOf(['1']), vi.fn(), true);
    session.setDescription(0, 'x');
    session.setAmount(0, '2');
    expect(session.getSnapshot().lines[0]).toEqual({ description: '', amountText: '1' });
  });
});

describe('external changes (SAV-07, MTB-02)', () => {
  it('a clean line takes the new stored value', () => {
    const { session } = setup(linesOf(['1']));
    session.syncFromDb(linesOf(['2']));
    expect(session.getSnapshot().lines[0]?.amountText).toBe('2');
    expect(session.getSnapshot().notice).toBeNull();
  });

  it('our own save echoing back is not a conflict', async () => {
    let resolve!: (r: RepoResult) => void;
    const save = vi.fn(() => new Promise<RepoResult>((r) => (resolve = r)));
    const session = new EditorSession('p', linesOf(), save);
    session.setAmount(0, '7');
    const done = session.flush();
    session.syncFromDb(linesOf(['7'])); // live query fires before the save resolves
    resolve({ ok: true, value: undefined });
    await done;
    expect(session.getSnapshot().notice).toBeNull();
  });

  it('a dirty line changed elsewhere shows the notice and takes the new value on leaving', async () => {
    const { session, save } = setup(linesOf(['1']));
    session.focus(1);
    session.setAmount(0, '5');
    session.syncFromDb(linesOf(['9']));
    expect(session.getSnapshot().notice).toBe(CHANGED_ELSEWHERE);
    await session.flush();
    expect(save).not.toHaveBeenCalled(); // never a blind overwrite
    session.blur(1);
    expect(session.getSnapshot().lines[0]?.amountText).toBe('9');
    session.dismissNotice();
    expect(session.getSnapshot().notice).toBeNull();
  });

  it('an unchanged stored page does nothing', () => {
    const { session } = setup(linesOf(['1']));
    const before = session.getSnapshot();
    session.syncFromDb(linesOf(['1']));
    expect(session.getSnapshot()).toBe(before);
  });

  it('subscribers are notified and can unsubscribe', () => {
    const { session } = setup();
    const fn = vi.fn();
    const off = session.subscribe(fn);
    session.setAmount(0, '1');
    expect(fn).toHaveBeenCalled();
    off();
    fn.mockClear();
    session.setAmount(0, '2');
    expect(fn).not.toHaveBeenCalled();
  });
});
