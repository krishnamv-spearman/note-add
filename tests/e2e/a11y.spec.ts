import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { amount, createNotebookViaUi, description } from './helpers';

const FIXTURE = join(import.meta.dirname, '../fixtures/backups/v1/valid-3-notebooks-21-pages.json');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

/** Zero violations of any impact, listed readably when there are some. */
async function expectAccessible(page: Page, screen: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = violations.map(
    (v) =>
      `${v.id} [${v.impact}] ${v.help}: ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(' | ')}`,
  );
  expect(summary, `axe: ${screen}`).toEqual([]);
}

/** Restores the committed v1 backup: 3 notebooks, 21 pages, Final and flagged pages, negatives. */
async function seed(page: Page): Promise<void> {
  await page.goto('/settings');
  await page.getByLabel('Restore from a backup file').setInputFiles(FIXTURE);
  await page.getByRole('dialog').getByRole('button', { name: 'Replace my notes' }).click();
  await expect(page.getByText(/^Backup restored/)).toBeVisible();
}

test.describe('axe: no accessibility violations on any screen (P7.7)', () => {
  test('library: empty, with data, search results and no results, new-notebook dialog', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByText('Create your first notebook')).toBeVisible();
    await expectAccessible(page, 'library, empty');

    await seed(page);
    await page.goto('/');
    await expect(page.locator('.stacks .notebook-stack')).toHaveCount(3);
    await expectAccessible(page, 'library, with notebooks and recent activity');

    const search = page.getByRole('searchbox', { name: 'Search' });
    await search.fill('hotel');
    await expect(page.getByRole('list', { name: 'Search results' })).toBeVisible();
    await expectAccessible(page, 'library, search results');
    await search.fill('zebra');
    await expect(page.getByText(/^No notebooks or pages match/)).toBeVisible();
    await expectAccessible(page, 'library, no search results');

    await search.fill('');
    await page.getByRole('button', { name: 'Add a new book' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectAccessible(page, 'new-notebook dialog');
  });

  test('pages list: drafts, open Archive, rename and delete dialogs', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await page
      .locator('.stacks')
      .getByRole('link', { name: /Pune trip claims/ })
      .click();
    await expect(page.getByRole('heading', { name: 'Pune trip claims' })).toBeVisible();
    await expectAccessible(page, 'pages list');
    await page.locator('details.archive summary').click();
    await expectAccessible(page, 'pages list, Archive open');
    await page.getByRole('button', { name: 'Rename' }).click();
    await expectAccessible(page, 'rename dialog');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'Delete notebook' }).click();
    await expectAccessible(page, 'delete notebook dialog');
  });

  test('editor: draft with a flagged amount and a rejected value, Final page, dialogs', async ({
    page,
  }) => {
    await seed(page);
    await page.goto('/');
    await page
      .locator('.stacks')
      .getByRole('link', { name: /Pune trip claims/ })
      .click();
    // Page 2 has an unclear amount ("12a", flagged); page 1 is Final.
    await page
      .locator('.page-cards')
      .getByRole('link', { name: /Page 2/ })
      .first()
      .click();
    await expect(
      page.getByRole('img', { name: 'Not a number, counted as zero' }).first(),
    ).toBeVisible();
    await expectAccessible(page, 'editor, draft with a flagged amount');

    await amount(page, 5).fill('450.505'); // rejected: message under the field
    await expect(page.getByText('Up to 2 decimal places, for example 450.50')).toBeVisible();
    await expectAccessible(page, 'editor, rejected amount message');
    await amount(page, 5).fill('');

    await page.getByRole('button', { name: /^Page colour/ }).click();
    await expectAccessible(page, 'page colour dialog');
    await page.getByRole('button', { name: 'Done' }).click();

    await page.getByRole('button', { name: 'Delete page' }).click();
    await expectAccessible(page, 'delete page dialog');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('link', { name: '‹ Pune trip claims' }).click();
    await page.locator('details.archive summary').click();
    await page.locator('details.archive').getByRole('link').first().click();
    await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible();
    await expectAccessible(page, 'editor, Final page (read-only)');
  });

  test('editor: Mark as Final dialog and the amount editing bar on a phone', async ({
    page,
  }, testInfo) => {
    await createNotebookViaUi(page, 'Dialogs');
    await description(page, 1).fill('Taxi');
    await amount(page, 1).fill('450');
    await amount(page, 1).blur();
    await expect(page.getByText('Saved')).toBeVisible();
    await page.getByRole('button', { name: 'Mark as Final' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectAccessible(page, 'Mark as Final dialog');
    await page.getByRole('button', { name: 'Cancel' }).click();

    if (testInfo.project.name !== 'chromium-desktop') {
      await amount(page, 2).focus();
      await expect(page.getByRole('toolbar', { name: 'Amount keys' })).toBeVisible();
      await expectAccessible(page, 'editor with the amount editing bar');
    }
  });

  test('settings: font choice, backup, restore summary dialog, undo', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByTestId('storage-status')).not.toHaveAttribute('data-status', 'unknown');
    await expectAccessible(page, 'settings, empty');

    await page.getByLabel('Restore from a backup file').setInputFiles(FIXTURE);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectAccessible(page, 'restore summary dialog');
    await page.getByRole('dialog').getByRole('button', { name: 'Replace my notes' }).click();
    await expect(page.getByRole('button', { name: 'Undo last restore' })).toBeVisible();
    await expectAccessible(page, 'settings, after a restore (undo offered)');
    await page.getByRole('button', { name: 'Undo last restore' }).click();
    await expectAccessible(page, 'undo restore dialog');
  });

  test('banner: the iPhone install hint', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'shown in iPhone Safari only');
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Install Note-Add' })).toBeVisible();
    await expectAccessible(page, 'library with the iPhone install hint');
  });

  test('banner: the private window warning', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator.storage, 'estimate', {
        value: () => Promise.resolve({ quota: 30 * 1024 * 1024, usage: 0 }),
        configurable: true,
      });
    });
    await page.goto('/');
    await expect(
      page.getByText('Notes in a private window are deleted when it closes.'),
    ).toBeVisible();
    await expectAccessible(page, 'library with the private window warning');
  });
});

test.describe('keyboard only, focus and motion', () => {
  /** Press Tab until the focused element's accessible name matches. */
  async function tabTo(page: Page, name: RegExp | string, limit = 60): Promise<void> {
    for (let i = 0; i < limit; i++) {
      await page.keyboard.press('Tab');
      const label = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return ''; // the body's text contains everything
        return (
          el.getAttribute('aria-label') ??
          (el as HTMLInputElement).placeholder ??
          el.textContent ??
          ''
        ).trim();
      });
      // Inclusion: a button's text content includes its (hidden) "+" or similar decoration.
      if (typeof name === 'string' ? label.includes(name) : name.test(label)) return;
    }
    throw new Error(`Tab never reached "${String(name)}"`);
  }

  test.beforeEach(({ browserName: _b }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'keyboard-only on desktop');
  });

  test('P7.7: create a notebook, fill a page, finalise and reopen it with the keyboard alone', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Notebooks' })).toBeVisible(); // rendered
    await tabTo(page, 'Add a new book');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('textbox', { name: 'Name' })).toBeFocused(); // focus moved in
    await page.keyboard.type('Keyboard book');
    await page.keyboard.press('Enter'); // submits the form
    await expect(page.getByRole('heading', { name: 'Page 1 of 1' })).toBeVisible();
    await expect(description(page, 1)).toBeFocused();

    await page.keyboard.type('Taxi');
    await page.keyboard.press('Enter');
    await page.keyboard.type('450');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Lunch');
    await page.keyboard.press('Enter');
    await page.keyboard.type('-50');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('total')).toHaveText('400.00');

    await tabTo(page, 'Mark as Final');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape'); // closes, and focus returns to the button that opened it
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Mark as Final' })).toBeFocused();

    await page.keyboard.press('Space'); // opens again with the space bar
    await page.getByRole('dialog').getByRole('button', { name: 'Mark as Final' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible();
    await expect(amount(page, 1)).toHaveAttribute('readonly', '');
    await tabTo(page, 'Reopen');
    await page.keyboard.press('Enter');
    await expect(amount(page, 1)).not.toHaveAttribute('readonly', '');
  });

  test('A11Y-05: dialogs trap focus in both directions and return it to the trigger', async ({
    page,
  }) => {
    await createNotebookViaUi(page, 'Focus trap');
    await page.getByRole('link', { name: '‹ Focus trap' }).click();
    const trigger = page.getByRole('button', { name: 'Rename' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // The page behind a modal dialog is inert: focus is inside the dialog or (after the last
    // control) with the browser's own UI, i.e. on the body — never on the page behind.
    const insideDialog = () =>
      page.evaluate(
        () =>
          document.activeElement === document.body ||
          document.activeElement?.closest('dialog') != null,
      );
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab');
      expect(await insideDialog(), `Tab ${i + 1}`).toBe(true);
    }
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await insideDialog(), `Shift+Tab ${i + 1}`).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    // The same through Cancel with the keyboard.
    await trigger.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Cancel' }).focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toBeFocused();
  });

  test('A11Y: every focused control shows a visible focus ring', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await expect(page.locator('.stacks .notebook-stack')).toHaveCount(3); // rendered before tabbing
    const rings: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      rings.push(
        await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          const s = getComputedStyle(el);
          const visible = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2;
          return visible
            ? 'ok'
            : `${el.tagName} "${(el.textContent ?? '').slice(0, 25)}" has no focus ring`;
        }),
      );
    }
    expect(rings.filter((r) => r !== 'ok')).toEqual([]);
  });

  test('A11Y-06: with reduced motion requested, nothing animates or scrolls smoothly', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seed(page);
    await page.goto('/');
    const slow = await page.evaluate(() => {
      const seconds = (v: string) =>
        v.split(',').map((x) => parseFloat(x) * (x.includes('ms') ? 0.001 : 1));
      return [...document.querySelectorAll('*')].flatMap((el) => {
        const s = getComputedStyle(el);
        const durations = [...seconds(s.transitionDuration), ...seconds(s.animationDuration)];
        const bad = durations.some((d) => d > 0.01) || s.scrollBehavior === 'smooth';
        return bad ? [el.tagName.toLowerCase() + '.' + el.className] : [];
      });
    });
    expect(slow).toEqual([]);
  });

  test('LOOK-05: at a 200% zoom equivalent the screens still fit without horizontal scrolling', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await seed(page);
    for (const path of ['/', '/settings']) {
      await page.goto(path);
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      await expect(page.getByRole('heading', { name: /^(Notebooks|Settings)$/ })).toBeVisible();
      // Elements sticking out past the right edge, named so a failure says what to fix.
      const overflow = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        return [...document.querySelectorAll('body *')]
          .filter((el) => el.getBoundingClientRect().right > width + 1)
          .slice(0, 5)
          .map(
            (el) =>
              `${el.tagName.toLowerCase()}.${String(el.className)} right=${Math.round(el.getBoundingClientRect().right)} (viewport ${width})`,
          );
      });
      expect(overflow, path).toEqual([]);
    }
  });
});
