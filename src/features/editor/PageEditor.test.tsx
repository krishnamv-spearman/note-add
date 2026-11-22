import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { aLine } from '../../../tests/builders';
import { appendPage, createNotebook, db, loadPages, resetDb, updateLine } from '@/db';
import { App } from '../../App';
import { routes } from '../../routes';

const amount = (n: number) => screen.getByRole('textbox', { name: `Line ${n} amount` });
/** The editor itself (the bottom navigation has its own New page button). */
const editor = () => within(screen.getByRole('article'));
const desc = (n: number) => screen.getByRole('textbox', { name: `Line ${n} description` });

let notebookId = '';

async function openEditor(pageNumber = 1) {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/n/${notebookId}/p/${pageNumber}`],
  });
  render(<App router={router} />);
  await screen.findByRole('heading', { name: new RegExp(`^Page ${pageNumber} of`) });
  return router;
}

beforeEach(async () => {
  await resetDb();
  const r = await createNotebook('Trip');
  if (!r.ok) throw new Error('create');
  notebookId = r.value.notebookId;
});

describe('PageEditor keyboard', () => {
  it('KBD-01 / KBD-02: Enter moves description → amount → next description across all 10 lines', async () => {
    const user = userEvent.setup();
    await openEditor();
    await user.click(desc(1));
    for (let n = 1; n <= 10; n++) {
      expect(desc(n)).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(amount(n)).toHaveFocus();
      if (n < 10) await user.keyboard('{Enter}');
    }
  });

  it('KBD-03 / A11Y-03: Enter on line 10 creates page 2, focuses its line 1 and announces it', async () => {
    const user = userEvent.setup();
    await openEditor();
    await user.click(amount(1));
    await user.keyboard('1280.75');
    await user.click(amount(10));
    await user.keyboard('{Enter}');
    await screen.findByRole('heading', { name: 'Page 2 of 2' });
    await waitFor(() => expect(desc(1)).toHaveFocus());
    expect(screen.getByTestId('brought-forward')).toHaveTextContent('1,280.75');
    expect(screen.getByText('Page 2 started, brought forward 1,280.75')).toBeInTheDocument();
  });

  it('KBD-04: Enter on line 10 when a later page exists goes to it; no page inserted', async () => {
    await appendPage(notebookId);
    const user = userEvent.setup();
    await openEditor(1);
    await user.click(amount(10));
    await user.keyboard('{Enter}');
    await screen.findByRole('heading', { name: 'Page 2 of 2' });
    expect(await loadPages(notebookId)).toHaveLength(2);
  });

  it('KBD-05: an empty page does not create a new page', async () => {
    const user = userEvent.setup();
    await openEditor();
    await user.click(amount(10));
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Add a line before starting a new page')).toBeInTheDocument();
    expect(await loadPages(notebookId)).toHaveLength(1);
  });

  it('KBD-06: Enter twice quickly on line 10 creates exactly one page', async () => {
    const [page] = await loadPages(notebookId);
    await updateLine(page!.id, 0, aLine('5'));
    await openEditor();
    const input = amount(10);
    input.focus();
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter' });
    await screen.findByRole('heading', { name: 'Page 2 of 2' });
    expect(await loadPages(notebookId)).toHaveLength(2);
  });

  it('KBD-06: New page tapped twice creates exactly one page', async () => {
    await openEditor();
    const button = editor().getByRole('button', { name: 'New page' });
    fireEvent.click(button);
    fireEvent.click(button);
    await screen.findByRole('heading', { name: 'Page 2 of 2' });
    expect(await loadPages(notebookId)).toHaveLength(2);
  });

  it('KBD-07: Enter during IME composition does not move focus', async () => {
    await openEditor();
    const input = desc(1);
    input.focus();
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(input).toHaveFocus();
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
    expect(input).toHaveFocus();
  });

  it('KBD-08: Shift+Enter does nothing special; Tab follows natural order', async () => {
    const user = userEvent.setup();
    await openEditor();
    await user.click(desc(3));
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(desc(3)).toHaveFocus();
    await user.tab();
    expect(amount(3)).toHaveFocus();
  });

  it('KBD-09 / EDT-19: a Final page is read-only and Enter on line 10 never creates a page', async () => {
    const [page] = await loadPages(notebookId);
    await updateLine(page!.id, 0, aLine('5'));
    await db.pages.update(page!.id, { status: 'final' });
    const user = userEvent.setup();
    await openEditor();
    expect(amount(1)).toHaveAttribute('readonly');
    expect(desc(1)).toHaveAttribute('readonly');
    expect(editor().queryByRole('button', { name: 'New page' })).toBeNull();
    await user.click(amount(10));
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('toolbar', { name: 'Amount keys' })).toBeNull();
    expect(await loadPages(notebookId)).toHaveLength(1);
  });

  it('LIF-17: New page after a Final last page starts with BF = its total', async () => {
    const [page] = await loadPages(notebookId);
    await updateLine(page!.id, 0, aLine('75'));
    await db.pages.update(page!.id, { status: 'final' });
    await appendPage(notebookId);
    await openEditor(2);
    expect(screen.getByTestId('brought-forward')).toHaveTextContent('75.00');
  });
});

describe('PageEditor amounts and fields', () => {
  it('EDT-01 / EDT-16 / EDT-17: amount input attributes', async () => {
    await openEditor();
    const a = amount(1);
    expect(a).toHaveAttribute('type', 'text');
    expect(a).toHaveAttribute('inputmode', 'decimal');
    expect(a).toHaveAttribute('enterkeyhint', 'next');
    expect(a).toHaveAttribute('autocomplete', 'off');
    expect(a).toHaveAttribute('autocorrect', 'off');
    expect(a).toHaveAttribute('autocapitalize', 'off');
    expect(desc(1)).toHaveAttribute('dir', 'auto');
    expect(desc(1)).toHaveAttribute('enterkeyhint', 'next');
  });

  it('FMT-06: formatted on blur, raw text on focus; live total on each keystroke', async () => {
    const user = userEvent.setup();
    await openEditor();
    await user.click(amount(1));
    await user.keyboard('1280.75');
    expect(screen.getByTestId('total')).toHaveTextContent('1,280.75');
    await user.click(desc(2));
    expect(amount(1)).toHaveValue('1,280.75');
    await user.click(amount(1));
    expect(amount(1)).toHaveValue('1280.75');
  });

  it('flagged amount shows the mark after leaving the field; counts as zero', async () => {
    const user = userEvent.setup();
    await openEditor();
    await user.click(amount(1));
    await user.keyboard('12a');
    expect(screen.queryByRole('img', { name: 'Not a number, counted as zero' })).toBeNull();
    await user.click(desc(2));
    expect(screen.getByRole('img', { name: 'Not a number, counted as zero' })).toBeInTheDocument();
    expect(screen.getByTestId('total')).toHaveTextContent('0.00');
  });

  it('MON-05 / EDT-02: rejected input keeps the last valid value and blocks Enter', async () => {
    const user = userEvent.setup();
    await openEditor();
    await user.click(amount(1));
    await user.keyboard('450');
    await user.clear(amount(1));
    await user.paste('450.505'); // one change: the last valid value is 450
    // clear() made the field empty, which is itself a valid (zero) value
    expect(screen.getByText('Up to 2 decimal places, for example 450.50')).toBeInTheDocument();
    expect(screen.getByTestId('total')).toHaveTextContent('0.00');
    await user.keyboard('{Enter}');
    expect(amount(1)).toHaveFocus();
    await user.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}');
    expect(screen.getByTestId('total')).toHaveTextContent('450.00');
    await user.keyboard('.505');
    expect(screen.getByTestId('total')).toHaveTextContent('450.50'); // typed 450.50 was valid
  });

  it('MON-05: a pasted rejected value keeps the previous valid value', async () => {
    const user = userEvent.setup();
    await openEditor();
    await user.click(amount(1));
    await user.keyboard('450');
    await user.keyboard('{Control>}a{/Control}');
    await user.paste('450.505');
    expect(screen.getByTestId('total')).toHaveTextContent('450.00');
  });

  it('FMT-07 / A11Y-01: a negative total shows brackets and reads as minus', async () => {
    const user = userEvent.setup();
    await openEditor();
    await user.click(amount(1));
    await user.keyboard('-300');
    await user.click(desc(2));
    const t = screen.getByTestId('total');
    expect(t).toHaveTextContent('(300.00)');
    expect(t).toHaveAttribute('aria-label', 'minus 300.00 rupees');
    expect(amount(1)).toHaveAccessibleDescription('minus 300.00 rupees');
  });

  it('EDT-10 / EDT-11: invalid date shows a message and keeps the date; cleared reverts', async () => {
    const user = userEvent.setup();
    await openEditor();
    const date = screen.getByRole('textbox', { name: 'Date' });
    expect(date).toHaveValue(
      '22/11/2026'.replace(
        /.*/,
        (await loadPages(notebookId))[0]!.date.split('-').reverse().join('/'),
      ),
    );
    const original = (date as HTMLInputElement).value;
    await user.clear(date);
    await user.type(date, '31/02/2026');
    await user.tab();
    expect(screen.getByText('Use DD/MM/YYYY, for example 20/11/2026')).toBeInTheDocument();
    expect(date).toHaveValue(original);
    await user.clear(date);
    await user.tab();
    expect(date).toHaveValue(original);
    await user.clear(date);
    await user.type(date, '01/01/2026');
    await user.tab();
    await waitFor(async () => expect((await loadPages(notebookId))[0]?.date).toBe('2026-01-01'));
  });

  it('EDT-13 / EDT-14: title placeholder is "Page N"; capped at 60', async () => {
    const user = userEvent.setup();
    await openEditor();
    const title = screen.getByRole('textbox', { name: 'Title' });
    expect(title).toHaveAttribute('placeholder', 'Page 1');
    expect(title).toHaveAttribute('maxlength', '60');
    await user.type(title, 'Airport run');
    await user.tab();
    await waitFor(async () => expect((await loadPages(notebookId))[0]?.title).toBe('Airport run'));
  });

  it('SAV-01: "Saved" after the debounce; data is in the database', async () => {
    const user = userEvent.setup();
    await openEditor();
    await user.click(amount(2));
    await user.keyboard('99');
    expect(await screen.findByText('Saved', {}, { timeout: 3000 })).toBeInTheDocument();
    expect((await loadPages(notebookId))[0]?.lines[1]?.amountPaise).toBe(9900);
  });

  it('SAV-07: brought forward updates live when an earlier page changes', async () => {
    const [p1] = await loadPages(notebookId);
    await appendPage(notebookId);
    await openEditor(2);
    expect(screen.getByTestId('brought-forward')).toHaveTextContent('0.00');
    await act(async () => {
      await updateLine(p1!.id, 0, aLine('42'));
    });
    await waitFor(() => expect(screen.getByTestId('brought-forward')).toHaveTextContent('42.00'));
  });
});
