import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aLine } from '../../../tests/builders';
import { createNotebook, loadPages, resetDb, setClock, updateLine } from '@/db';
import { App } from '../../App';
import { routes } from '../../routes';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

beforeEach(async () => {
  setClock(() => new Date('2026-11-22T10:00:00+05:30'));
  await resetDb();
});
afterEach(() => vi.restoreAllMocks());

const openLibrary = () =>
  render(<App router={createMemoryRouter(routes, { initialEntries: ['/'] })} />);

describe("the library appears all at once (no layout shift under the user's finger)", () => {
  it('the moment "Add a new book" is on screen, the iPhone hint is already above it', async () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(IPHONE);
    openLibrary();
    const add = await screen.findByRole('button', { name: 'Add a new book' });
    // Same instant, no waiting: if the hint arrived later it would push this button down.
    expect(screen.getByRole('region', { name: 'Install Note-Add' })).toBeInTheDocument();
    expect(add).toBeInTheDocument();
  });

  it('the notebooks are already listed when the "Add a new book" tile appears', async () => {
    const a = await createNotebook('Alpha');
    await createNotebook('Beta');
    if (!a.ok) throw new Error('create');
    const [page] = await loadPages(a.value.notebookId);
    await updateLine(page!.id, 0, aLine('5', 'x'));
    openLibrary();
    await screen.findByRole('button', { name: 'Add a new book' });
    const stacks = within(document.querySelector('.stacks') as HTMLElement);
    expect(stacks.getByRole('link', { name: /Alpha/ })).toBeInTheDocument();
    expect(stacks.getByRole('link', { name: /Beta/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Recent activity' })).toBeInTheDocument();
  });

  it('while loading, only the heading is shown — no half-built page', () => {
    openLibrary();
    // Synchronously after render the data has not been read yet.
    expect(screen.queryByRole('button', { name: 'Add a new book' })).toBeNull();
    expect(screen.queryByRole('searchbox')).toBeNull();
  });
});
