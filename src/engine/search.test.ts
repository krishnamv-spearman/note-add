import { describe, expect, it } from 'vitest';
import { normalise, pageMatches, search, type SearchablePage, textMatches } from './search';

const notebooks = [
  { id: 'n1', name: 'Pune trip claims' },
  { id: 'n2', name: 'Café expenses' },
  { id: 'n3', name: 'Groceries' },
];

const page = (
  id: string,
  notebookId: string,
  number: number,
  title: string | null,
  descriptions: string[] = [],
): SearchablePage => ({
  id,
  notebookId,
  number,
  title,
  lines: descriptions.map((description) => ({ description })),
});

const pages = [
  page('a1', 'n1', 1, null, ['Taxi to airport', 'Hotel']),
  page('a2', 'n1', 2, 'Return  journey', ['Auto (shared)']),
  page('b1', 'n2', 1, null, ['Coffee', 'Łódź pierogi']),
  page('c1', 'n3', 1, 'Weekly shop', ['Rice 450']),
];

describe('search', () => {
  it('normalise lower-cases, removes accents and collapses spaces', () => {
    expect(normalise('  Café   Déjà  Vu ')).toBe('cafe deja vu');
  });

  it('finds by notebook name', () => {
    expect(search('pune', notebooks, pages)).toEqual([
      { notebookId: 'n1', notebookMatched: true, pageIds: [] },
    ]);
  });

  it('finds by page title, ignoring multiple spaces', () => {
    expect(search('return journey', notebooks, pages)).toEqual([
      { notebookId: 'n1', notebookMatched: false, pageIds: ['a2'] },
    ]);
  });

  it('SRC-05: finds the default "Page N" title', () => {
    expect(search('page 1', notebooks, pages).map((h) => h.pageIds)).toEqual([['a1'], ['b1']]);
    // A page with a custom title is not found by its default title.
    expect(pageMatches('page 1', pages[3]!)).toBe(false);
  });

  it('finds by line description; results highest page number first', () => {
    expect(search('a', notebooks, [pages[0]!, pages[1]!])[0]?.pageIds).toEqual(['a2', 'a1']);
    expect(search('hotel', notebooks, pages)).toEqual([
      { notebookId: 'n1', notebookMatched: false, pageIds: ['a1'] },
    ]);
  });

  it('SRC-02: case and accents', () => {
    expect(search('CAFE', notebooks, pages)[0]?.notebookId).toBe('n2');
    expect(textMatches('café', 'Cafe')).toBe(true);
  });

  it('SRC-03: special characters are literal', () => {
    expect(search('(shared)', notebooks, pages)[0]?.pageIds).toEqual(['a2']);
    expect(search('.*', notebooks, pages)).toEqual([]);
    expect(search('\\', notebooks, pages)).toEqual([]);
  });

  it('SRC-07: Latin Extended-A text matches regardless of case (English-only, decided 23/11/2026)', () => {
    expect(search('ŁÓDŹ', notebooks, pages)[0]?.pageIds).toEqual(['b1']);
    expect(search('PIEROGI', notebooks, pages)[0]?.pageIds).toEqual(['b1']);
  });

  it('SRC-01: blank query returns no hits (the UI shows the normal library)', () => {
    expect(search('   ', notebooks, pages)).toEqual([]);
    expect(textMatches('', 'anything')).toBe(false);
  });

  it('no match', () => {
    expect(search('zebra', notebooks, pages)).toEqual([]);
  });

  it('SRC-04: amounts are not searched (only descriptions)', () => {
    // "Rice 450" is a description, so it matches as text; there is no amount search.
    expect(search('450', notebooks, pages)[0]?.pageIds).toEqual(['c1']);
    expect(search('450', notebooks, [page('x', 'n3', 1, null, [''])])).toEqual([]);
  });
});
