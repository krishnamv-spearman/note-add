import { defaultTitle } from './page';

/** Lower-case, remove Latin diacritics, collapse whitespace (arch §5.6). */
export function normalise(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SearchablePage {
  id: string;
  notebookId: string;
  number: number;
  title: string | null;
  lines: readonly { description: string }[];
}

export interface SearchableNotebook {
  id: string;
  name: string;
}

export interface SearchHit {
  notebookId: string;
  notebookMatched: boolean;
  /** Matching pages, highest page number first. */
  pageIds: string[];
}

/** Literal substring match on normalised text; no regular expressions (SRC-03). */
export function textMatches(query: string, text: string): boolean {
  const q = normalise(query);
  return q !== '' && normalise(text).includes(q);
}

export function pageMatches(query: string, page: SearchablePage): boolean {
  return (
    textMatches(query, page.title ?? defaultTitle(page.number)) ||
    page.lines.some((l) => textMatches(query, l.description))
  );
}

/**
 * Searches notebook names, page titles (including the default "Page N") and line
 * descriptions. Amounts are not searched (SRC-04). Results keep the notebooks' order.
 */
export function search(
  query: string,
  notebooks: readonly SearchableNotebook[],
  pages: readonly SearchablePage[],
): SearchHit[] {
  if (normalise(query) === '') return [];
  return notebooks.flatMap((nb) => {
    const notebookMatched = textMatches(query, nb.name);
    const pageIds = pages
      .filter((p) => p.notebookId === nb.id && pageMatches(query, p))
      .sort((a, b) => b.number - a.number)
      .map((p) => p.id);
    return notebookMatched || pageIds.length > 0
      ? [{ notebookId: nb.id, notebookMatched, pageIds }]
      : [];
  });
}
