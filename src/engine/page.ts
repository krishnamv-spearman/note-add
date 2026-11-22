import { addPaise, type Line, type Paise, ZERO } from './types';

export const LINES_PER_PAGE = 10;

export function emptyLine(): Line {
  return { description: '', amountText: '', amountPaise: null };
}

export function emptyLines(): Line[] {
  return Array.from({ length: LINES_PER_PAGE }, emptyLine);
}

/** Sum of the page's amounts; empty and invalid amounts count as 0. */
export function pageSum(lines: readonly Line[]): Paise {
  return lines.reduce<Paise>((sum, line) => addPaise(sum, line.amountPaise ?? ZERO), ZERO);
}

/** Brought forward plus the sum of the page's amounts. */
export function pageTotal(broughtForward: Paise, lines: readonly Line[]): Paise {
  return addPaise(broughtForward, pageSum(lines));
}

/** True when the user typed something that is not a number (shown with the subtle flag). */
export function isFlagged(line: Line): boolean {
  return line.amountText.trim() !== '' && line.amountPaise === null;
}

export function countFlagged(lines: readonly Line[]): number {
  return lines.filter(isFlagged).length;
}

/** True when no line has a description or an amount. */
export function isPageEmpty(lines: readonly Line[]): boolean {
  return lines.every((l) => l.description.trim() === '' && l.amountText.trim() === '');
}

export function defaultTitle(pageNumber: number): string {
  return `Page ${pageNumber}`;
}

export function displayTitle(page: { number: number; title: string | null }): string {
  return page.title ?? defaultTitle(page.number);
}
