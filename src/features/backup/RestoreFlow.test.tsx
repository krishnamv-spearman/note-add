import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { createNotebook, db, resetDb, setClock } from '@/db';
import { App } from '../../App';
import { routes } from '../../routes';

const FIXTURES = join(import.meta.dirname, '../../../tests/fixtures/backups');
const file = (name: string) =>
  new File([readFileSync(join(FIXTURES, name), 'utf8')], name.split('/').pop()!, {
    type: 'application/json',
  });

beforeEach(async () => {
  setClock(() => new Date(2026, 10, 22, 10, 0, 0));
  await resetDb();
});

async function openSettings() {
  render(<App router={createMemoryRouter(routes, { initialEntries: ['/settings'] })} />);
  await screen.findByRole('heading', { name: 'Backup and restore' });
}

/** The fixture's latest change as DD/MM/YYYY in the zone the test runs in (it is one instant). */
function fixtureLastChanged(): string {
  const raw = JSON.parse(
    readFileSync(join(FIXTURES, 'v1/valid-3-notebooks-21-pages.json'), 'utf8'),
  ) as { data: { notebooks: { updatedAt: number }[]; pages: { updatedAt: number }[] } };
  const d = new Date(
    Math.max(
      ...raw.data.notebooks.map((n) => n.updatedAt),
      ...raw.data.pages.map((p) => p.updatedAt),
    ),
  );
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

describe('RestoreFlow', () => {
  it('TXT-05: a backup with unsupported text is refused with a clear message; no dialog', async () => {
    const user = userEvent.setup();
    await openSettings();
    await user.upload(
      screen.getByLabelText('Restore from a backup file'),
      file('unsupported-text-description.json'),
    );
    expect(
      await screen.findByText(/Only English text is supported for now, so nothing was restored\./),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Restore this backup?' })).toBeNull();
    expect(await db.notebooks.count()).toBe(0);
  });

  it('BAK-01: with no notebooks, Back up is disabled with a reason; last backup "Never"', async () => {
    await openSettings();
    expect(await screen.findByText('Nothing to back up yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back up' })).toBeDisabled();
    expect(screen.getByTestId('last-backup')).toHaveTextContent('Never');
  });

  it('shows the summary, then replaces the data on confirmation; Undo appears', async () => {
    const user = userEvent.setup();
    await openSettings();
    await user.upload(
      screen.getByLabelText('Restore from a backup file'),
      file('v1/valid-3-notebooks-21-pages.json'),
    );
    expect(await screen.findByTestId('restore-summary')).toHaveTextContent(
      `3 notebooks, 21 pages, last changed ${fixtureLastChanged()}`,
    );
    const dialog = within(
      screen.getByRole('heading', { name: 'Restore this backup?' }).closest('form')!,
    );
    await user.click(dialog.getByRole('button', { name: 'Replace my notes' }));
    expect(await screen.findByText(/^Backup restored: 3 notebooks, 21 pages/)).toBeInTheDocument();
    expect(await db.pages.count()).toBe(21);
    expect(await screen.findByRole('button', { name: 'Undo last restore' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download this safety copy' })).toBeInTheDocument();
    // RES-15: last backup shows the file's exportedAt date.
    expect(screen.getByTestId('last-backup')).not.toHaveTextContent('Never');
  });

  it('OLD-12: warns when the backup is older than the current notes', async () => {
    await createNotebook('Newer notes');
    const user = userEvent.setup();
    await openSettings();
    await user.upload(
      screen.getByLabelText('Restore from a backup file'),
      file('v1/valid-3-notebooks-21-pages.json'),
    );
    expect(
      await screen.findByText(
        'This backup is older than your current notes (last changed 22/11/2026).',
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await db.notebooks.count()).toBe(1); // nothing replaced
  });

  it('RES-09: cosmetic fallbacks are listed in the summary', async () => {
    const user = userEvent.setup();
    await openSettings();
    await user.upload(
      screen.getByLabelText('Restore from a backup file'),
      file('unknown-cosmetic-fields.json'),
    );
    expect(
      await screen.findByText('The font was not recognised; the default font is used.'),
    ).toBeInTheDocument();
  });

  it('a bad file gives its message and no dialog', async () => {
    const user = userEvent.setup();
    await openSettings();
    await user.upload(
      screen.getByLabelText('Restore from a backup file'),
      file('future-version.json'),
    );
    expect(
      await screen.findByText(
        'This backup was made by a newer version of Note-Add. Update the app and try again.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Restore this backup?' })).toBeNull();
  });
});
