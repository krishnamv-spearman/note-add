# src/engine — the calculation engine

Pure TypeScript: no React, DOM, Dexie or anything outside this folder (enforced by ESLint). 100% line and branch coverage (enforced by Vitest).

## The paise rule

Every amount is an **integer number of paise** (`Paise`, a branded `number`), always a safe integer. Text is parsed straight into paise on digit strings; nothing is ever parsed as a float, multiplied by 100, rounded or `toFixed`-ed. The limit is ±₹99,99,99,999.99 = ±99,999,999,999 paise (`MAX_PAISE`, `MIN_PAISE`).

## Public functions

| Module        | Function                                                                                                         | What it does                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `types.ts`    | `asPaise(n)`, `addPaise(a, b)`, `isWithinLimit(n)`                                                               | Branding, exact addition, limit check (all assert safe integers)                                            |
| `money.ts`    | `parseAmount(text)`                                                                                              | `empty` / `ok` / `invalid` / `rejected` (arch §5.2)                                                         |
|               | `formatPaise(p, { style })`                                                                                      | Indian grouping, two decimals, `(300.00)` or `-300.00`                                                      |
|               | `spokenPaise(p)`                                                                                                 | "minus 300.00 rupees" for screen readers                                                                    |
| `page.ts`     | `pageSum`, `pageTotal`, `isFlagged`, `countFlagged`, `isPageEmpty`, `emptyLines`, `defaultTitle`, `displayTitle` | One page                                                                                                    |
| `chain.ts`    | `recalculateChain(pages, today)`                                                                                 | Brought forward / totals for a notebook; `totalUpdatedOn` for Final pages; over-limit error naming the page |
|               | `renumber(pages)`                                                                                                | Contiguous numbers 1..n                                                                                     |
| `dates.ts`    | `todayIso(clock)`, `toDisplay`, `fromDisplay`, `toFileDate`, `isValidIso`, `epochToDisplay`                      | Local calendar dates, DD/MM/YYYY                                                                            |
| `search.ts`   | `normalise`, `textMatches`, `pageMatches`, `search`                                                              | Literal, accent-insensitive search                                                                          |
| `contrast.ts` | `contrastRatio(a, b)`                                                                                            | WCAG 2.x                                                                                                    |
