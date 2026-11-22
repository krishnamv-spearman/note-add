import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { aLine } from '../../tests/builders';
import {
  appendPage,
  createNotebook,
  db,
  deleteNotebook,
  finalisePage,
  loadPages,
  resetDb,
  updateLine,
} from '@/db';
import { ConfirmDialog } from '@/ui/Dialog';
import { App } from '../App';
import { routes } from '../routes';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<App router={router} />);
  return router;
}

let notebookId = '';
beforeEach(async () => {
  await resetDb();
  const r = await createNotebook('Trip');
  if (!r.ok) throw new Error('create');
  notebookId = r.value.notebookId;
});

describe('ConfirmDialog', () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        <ConfirmDialog
          open={open}
          title="Sure?"
          confirmLabel="Yes"
          onCancel={() => setOpen(false)}
          onConfirm={() => setOpen(false)}
        />
      </>
    );
  }

  it('A11Y-05: opens, closes with Cancel and Escape, and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);
    expect(screen.getByRole('heading', { name: 'Sure?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('heading', { name: 'Sure?' })).toBeNull();
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    const dialog = screen.getByRole('heading', { name: 'Sure?' }).closest('dialog')!;
    dialog.dispatchEvent(new Event('cancel', { cancelable: true })); // Escape
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Sure?' })).toBeNull());
  });
});

describe('editor lifecycle', () => {
  it('LIF-18: Mark as Final is blocked while an amount is not a number', async () => {
    const [p] = await loadPages(notebookId);
    await updateLine(p!.id, 0, aLine('12a'));
    const user = userEvent.setup();
    renderAt(`/n/${notebookId}/p/1`);
    const article = within(await screen.findByRole('article'));
    const button = article.getByRole('button', { name: 'Mark as Final' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription(
      '1 amount is not a number. Fix it before marking this page Final.',
    );
    await user.click(button);
    expect(screen.queryByRole('heading', { name: /as Final\?/ })).toBeNull();
  });

  it('LIF-01 / LIF-04: pending typing is flushed before the page is marked Final', async () => {
    const user = userEvent.setup();
    renderAt(`/n/${notebookId}/p/1`);
    const article = within(await screen.findByRole('article'));
    await user.click(article.getByRole('textbox', { name: 'Line 1 amount' }));
    await user.keyboard('77');
    await user.click(article.getByRole('button', { name: 'Mark as Final' }));
    const confirm = screen.getByRole('heading', { name: 'Mark Page 1 as Final?' }).closest('form')!;
    await user.click(within(confirm).getByRole('button', { name: 'Mark as Final' }));
    await waitFor(async () => expect((await loadPages(notebookId))[0]?.status).toBe('final'));
    const [page] = await loadPages(notebookId);
    expect(page?.lines[0]?.amountPaise).toBe(7700);
    expect(await screen.findByRole('button', { name: 'Reopen' })).toBeInTheDocument();
    expect(screen.getByText(/^Final since \d{2}\/\d{2}\/\d{4}$/)).toBeInTheDocument();
  });

  it('LIF-02: Reopen makes the page editable and shows "Reopened on"', async () => {
    const [p] = await loadPages(notebookId);
    await finalisePage(p!.id);
    const user = userEvent.setup();
    renderAt(`/n/${notebookId}/p/1`);
    await user.click(await screen.findByRole('button', { name: 'Reopen' }));
    expect(await screen.findByText(/^Reopened on \d{2}\/\d{2}\/\d{4}$/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Line 1 amount' })).not.toHaveAttribute('readonly');
  });

  it('LIF-10: deleting the only page explains why not', async () => {
    const user = userEvent.setup();
    renderAt(`/n/${notebookId}/p/1`);
    const article = within(await screen.findByRole('article'));
    await user.click(article.getByRole('button', { name: 'Delete page' }));
    expect(
      screen.getByText('A notebook always has at least one page. Delete the notebook instead.'),
    ).toBeInTheDocument();
  });
});

describe('library and pages list', () => {
  it('NB-05: with no notebooks, the library shows the hint and New page opens the dialog', async () => {
    await deleteNotebook(notebookId);
    const user = userEvent.setup();
    renderAt('/');
    expect(
      await screen.findByText('Create your first notebook to start adding up expenses.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New page' }));
    expect(await screen.findByRole('heading', { name: 'Add a new book' })).toBeInTheDocument();
  });

  it('SRC-01 / SRC-04: blank query shows the library; no match explains what is searched', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await screen.findByText('Trip');
    const box = screen.getByRole('searchbox', { name: 'Search' });
    await user.type(box, '   ');
    expect(screen.getByText('Trip')).toBeInTheDocument();
    await user.type(box, '450');
    expect(
      await screen.findByText(
        'No notebooks or pages match. Search looks at notebook names, page titles and line descriptions.',
      ),
    ).toBeInTheDocument();
  });

  it('ACT-01 / ACT-04: activity shows what exists; deleted notebooks are plain text', async () => {
    const other = await createNotebook('Gone');
    if (!other.ok) throw new Error();
    await deleteNotebook(other.value.notebookId);
    renderAt('/');
    const list = within(await screen.findByRole('region', { name: 'Recent activity' }));
    expect(list.getByRole('link', { name: 'Notebook Trip created' })).toBeInTheDocument();
    expect(list.getByText('Notebook Gone created').closest('a')).toBeNull();
  });

  it('ACT-01: no activity → section hidden', async () => {
    await db.activity.clear();
    renderAt('/');
    await screen.findByText('Trip');
    expect(screen.queryByRole('region', { name: 'Recent activity' })).toBeNull();
  });

  it('LIF-13: every page Final → empty Drafts state, Add card and an open Archive', async () => {
    await appendPage(notebookId);
    for (const p of await loadPages(notebookId)) await finalisePage(p.id);
    renderAt(`/n/${notebookId}`);
    expect(
      await screen.findByText('No draft pages. Final pages are in the Archive below.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a new page' })).toBeInTheDocument();
    expect(screen.getByText('Archive (2)').closest('details')).toHaveAttribute('open');
  });
});
