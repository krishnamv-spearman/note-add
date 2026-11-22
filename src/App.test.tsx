import { render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '@/db';
import { App } from './App';
import { routes } from './routes';

afterEach(() => vi.unstubAllGlobals());

describe('App boot', () => {
  it('opens the database and shows the app with its name', async () => {
    await resetDb();
    render(<App router={createMemoryRouter(routes, { initialEntries: ['/'] })} />);
    expect(await screen.findByText('Note-Add', { exact: true })).toBeInTheDocument();
  });

  it('STO-01: no IndexedDB → full-screen message instead of the app', () => {
    vi.stubGlobal('indexedDB', undefined);
    render(<App router={createMemoryRouter(routes)} />);
    expect(
      screen.getByText(
        'This browser can’t store notes. Open Note-Add in a normal Chrome or Safari window.',
      ),
    ).toBeInTheDocument();
  });
});
