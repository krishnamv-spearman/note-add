import { expect, type Page } from '@playwright/test';

export const amount = (page: Page, line: number) =>
  page.getByRole('textbox', { name: `Line ${line} amount`, exact: true });
export const description = (page: Page, line: number) =>
  page.getByRole('textbox', { name: `Line ${line} description`, exact: true });
export const total = (page: Page) => page.getByTestId('total');
export const broughtForward = (page: Page) => page.getByTestId('brought-forward');

/** True for the WebKit iPhone project: the decimal keypad has no Next, so use the editing bar. */
export const usesEditingBar = (projectName: string) => projectName === 'iphone-14';

/**
 * Press "Next" the way a user on this device would: Enter on a physical keyboard, or the
 * editing bar's Next button on iPhone when an amount is focused.
 */
export async function pressNext(page: Page, projectName: string, onAmount: boolean): Promise<void> {
  if (onAmount && usesEditingBar(projectName)) {
    await page.getByRole('button', { name: 'Next ↵' }).click();
  } else {
    await page.keyboard.press('Enter');
  }
}

/** Fills the 10 lines of the open page by keyboard only, starting with line 1 focused. */
export async function fillPageByKeyboard(
  page: Page,
  projectName: string,
  rows: readonly [string, string][],
): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const [desc, amt] = rows[i] ?? ['', ''];
    await expect(description(page, i + 1)).toBeFocused();
    if (desc) await page.keyboard.type(desc);
    await pressNext(page, projectName, false);
    await expect(amount(page, i + 1)).toBeFocused();
    if (amt) await page.keyboard.type(amt);
    await pressNext(page, projectName, true);
  }
}

/** Creates a notebook through the library dialog; lands on its page 1. */
export async function createNotebookViaUi(
  page: Page,
  name = 'My notebook',
  colour?: string,
): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add a new book' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill(name);
  if (colour) await page.getByRole('radio', { name: colour }).check();
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: 'Page 1 of 1' })).toBeVisible();
}

export async function openFreshNotebook(page: Page): Promise<void> {
  await createNotebookViaUi(page);
}

/** The editor's own buttons (the bottom navigation also has "New page"). */
export const editor = (page: Page) => page.getByRole('article');

export async function newPageFromEditor(page: Page, expectNumber: number): Promise<void> {
  await editor(page).getByRole('button', { name: 'New page' }).click();
  await expect(
    page.getByRole('heading', { name: `Page ${expectNumber} of ${expectNumber}` }),
  ).toBeVisible();
  // KBD-03: the app moves focus to line 1 of the new page. Wait for it, or a following
  // fill() can race that move and type into the description instead of the amount.
  await expect(description(page, 1)).toBeFocused();
}

/** Mark the open page Final through the confirmation dialog. */
export async function markFinal(page: Page): Promise<void> {
  await editor(page).getByRole('button', { name: 'Mark as Final' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Mark as Final' }).click();
  await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible();
}

/** DD/MM/YYYY of today in the browser's time zone. */
export const todayDisplay = (page: Page) =>
  page.evaluate(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  });

/** Click the previous/next page link and wait until that page is shown (no double clicks). */
export async function stepPage(page: Page, direction: 'Previous' | 'Next'): Promise<void> {
  const heading = page.getByRole('heading', { name: /^Page \d+ of \d+$/ });
  const [, n = '0', of = '0'] =
    /Page (\d+) of (\d+)/.exec((await heading.textContent()) ?? '') ?? [];
  const target = Number(n) + (direction === 'Next' ? 1 : -1);
  await page.getByRole('link', { name: `${direction} page` }).click();
  await expect(page.getByRole('heading', { name: `Page ${target} of ${of}` })).toBeVisible();
}

/** The bottom navigation's New page (works from any screen, including a Final page). */
export async function newPageFromNav(page: Page, expectNumber: number): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('button', { name: 'New page' })
    .click();
  await expect(
    page.getByRole('heading', { name: `Page ${expectNumber} of ${expectNumber}` }),
  ).toBeVisible();
  // KBD-03: the app moves focus to line 1 of the new page. Wait for it, or a following
  // fill() can race that move and type into the description instead of the amount.
  await expect(description(page, 1)).toBeFocused();
}
