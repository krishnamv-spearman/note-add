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

/** Opens the app on a fresh notebook (phase 2 start screen) at page 1. */
export async function openFreshNotebook(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Page 1 of 1' })).toBeVisible();
}
