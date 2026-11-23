# Architecture: Note-Add

Date: 22 November 2026 · Owner: Spearman · Status: draft for review before phase 0
Source: [problem-statement.md](problem-statement.md) (referred to below as "the spec", with section numbers like §5)

This document says how Note-Add is built: the technology, the module boundaries, the data model, the calculation engine, and how each feature in the spec maps onto code. Where it departs from the spec's suggested technology, it says why.

---

## 1. Architectural summary

Note-Add is a **static, client-only single-page app** delivered as a PWA. There is no backend. Everything runs in the browser:

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Browser (one device)                         │
│                                                                      │
│  ┌──────────────┐   ┌───────────────┐   ┌─────────────────────────┐  │
│  │  UI (React)  │──>│  Data layer   │──>│  IndexedDB (Dexie)      │  │
│  │  screens,    │   │  repositories │   │  notebooks, pages,      │  │
│  │  components  │<──│  + live query │<──│  settings, activity,    │  │
│  └──────┬───────┘   └───────┬───────┘   │  safetyBackups, meta    │  │
│         │                   │           └─────────────────────────┘  │
│         │           ┌───────▼───────┐                                │
│         └──────────>│  Engine       │  pure TypeScript, no UI, no DB │
│                     │  money, pages,│  (parse, format, total, chain) │
│                     │  chain, dates │                                │
│                     └───────────────┘                                │
│  ┌──────────────┐   ┌───────────────┐   ┌─────────────────────────┐  │
│  │ Export       │   │ Backup /      │   │ Service worker          │  │
│  │ canvas → JPEG│   │ restore (JSON)│   │ (precache app + fonts)  │  │
│  │ pdf-lib → PDF│   │               │   │                         │  │
│  └──────┬───────┘   └───────┬───────┘   └─────────────────────────┘  │
│         └────────┬──────────┘                                        │
│           ┌──────▼──────┐                                            │
│           │ Share/Save  │  Web Share API, else download              │
│           └─────────────┘                                            │
└──────────────────────────────────────────────────────────────────────┘
          ▲ static files only (HTML, JS, CSS, fonts, icons)
          │
     Vercel (static hosting, no functions)
```

Three rules shape everything else:

1. **The engine is pure.** All money and carry-forward logic lives in `src/engine/`, which imports nothing from React, Dexie or the DOM. It is fully unit-tested and enforced by a lint rule.
2. **Money is integer paise.** Amounts are parsed from text straight into integers. No float is ever stored, summed or round-tripped.
3. **Nothing leaves the device.** No network requests after install; enforced by a Content Security Policy and an end-to-end test.

---

## 2. Technology choices

| Concern | Choice | Reason |
|---|---|---|
| Build | **Vite 6** + **TypeScript 5** (strict) | As suggested. Fast dev server, simple static output. |
| UI | **React 19** | As suggested. Small app; no state library needed beyond React and Dexie live queries. |
| Routing | **React Router** (data router, browser history) | Real URLs for each screen so back/forward and deep links work. Vercel rewrites all paths to `index.html`. |
| Storage | **Dexie 4** + `dexie-react-hooks` (`useLiveQuery`) | As suggested. Transactions for multi-page recalculation; live queries re-render screens when data changes, so no separate store. |
| Validation | **Zod** | Validates backup files on restore and settings on read. Gives clear error messages. |
| Service worker | **vite-plugin-pwa** (Workbox `generateSW`) | As suggested. Precaches the app shell and fonts; generates the manifest. |
| JPEG export | **Our own Canvas 2D renderer** (no library) | *Departure from spec.* See §8.1. html-to-image depends on SVG `foreignObject`, which on iPhone Safari often renders web fonts missing or late. Drawing directly to a canvas is deterministic and has no dependency. |
| PDF export | **pdf-lib** + a small in-house TrueType toolkit (`export/ttf.ts`) | Draws the slip as **real, selectable vector text** with the bundled fonts embedded (subset), from the same layout constants and `SlipModel` as the canvas renderer (decided 22/11/2026; see §8.2). fontkit was replaced in phase 7 (D37): it was half of the export chunk and its shaping is not needed for English-only text. Works without the DOM, so it is testable in Node. |
| Fonts | **Self-hosted WOFF2 files** in the bundle (from Fontsource packages or vendored, with `OFL.txt` for each) | Must work offline and be identical everywhere (§4). |
| Unit tests | **Vitest** + **fast-check** (property tests) + **fake-indexeddb** | Vitest as suggested. Property tests prove the engine against a reference implementation; fake-indexeddb lets repositories be tested without a browser. |
| E2E tests | **Playwright** (Chromium desktop, Pixel 7 emulation, iPhone 14 WebKit emulation) | As suggested. WebKit project catches most Safari-specific breakage before device testing. |
| Lint / format | **ESLint 9** (flat config, typescript-eslint, react-hooks, jsx-a11y) + **Prettier** | Standard; jsx-a11y supports the accessibility criterion. |
| Pre-commit | **Husky** + **lint-staged** | Runs lint, type check and unit tests before every commit (§7). |
| CI | **GitHub Actions** | Lint, type check, unit, e2e on every push; Lighthouse on `main`. |
| Hosting | **Vercel** (static, no serverless functions) | Zero cost (§7). |

Exact package versions are pinned in `package.json` at phase 0; the lockfile is committed.

---

## 3. Repository layout

```
note-add/
├── CLAUDE.md                     rules for Claude Code (see §13)
├── README.md                     overview + user guide (§9 of spec)
├── LICENSE
├── docs/
│   ├── problem-statement.md
│   ├── architecture.md           this file
│   ├── implementation-plan.md    phase-by-phase tasks
│   ├── edge-cases.md             corner cases with IDs used in test names
│   ├── test-plan.md              unit, e2e and manual device tests
│   └── decisions/                short ADRs when a decision here changes
├── public/
│   ├── icons/                    PWA icons (192, 512, maskable, apple-touch)
│   └── fonts/LICENSES/           OFL.txt per font family
├── src/
│   ├── engine/                   PURE. No imports from react, dexie, DOM.
│   │   ├── money.ts              parseAmount, formatPaise, limits
│   │   ├── page.ts               pageTotal, line flags, constants
│   │   ├── chain.ts              recalculateChain, renumber
│   │   ├── dates.ts              ISO <-> DD/MM/YYYY, today()
│   │   ├── search.ts             normalise + match
│   │   ├── contrast.ts           WCAG contrast ratio
│   │   └── index.ts
│   ├── db/
│   │   ├── schema.ts             Dexie class, versions, migrations
│   │   ├── types.ts              stored record types
│   │   └── repo/
│   │       ├── notebooks.ts
│   │       ├── pages.ts          every write goes through recalculation
│   │       ├── activity.ts
│   │       ├── settings.ts
│   │       └── backup.ts         export/import/safety backups
│   ├── features/
│   │   ├── library/              Notebooks home, search, recent activity
│   │   ├── notebook/             pages list, archive
│   │   ├── editor/               page editor, keyboard nav, autosave
│   │   ├── settings/             font, backup, restore, about
│   │   ├── export/               renderSlip (canvas), toJpeg, toPdf
│   │   └── pwa/                  install hint, update prompt, persist()
│   ├── ui/                       shared components (Button, Slip, Badge, Dialog, BottomNav)
│   ├── theme/
│   │   ├── colours.ts            the seven slip colours + ink (single source)
│   │   ├── fonts.ts              font registry (label, family, files)
│   │   └── global.css            CSS custom properties, @font-face
│   ├── platform/
│   │   ├── share.ts              shareOrDownload(file)
│   │   └── storage.ts            requestPersistence(), estimate()
│   ├── routes.tsx
│   └── main.tsx
├── tests/
│   ├── e2e/                      Playwright specs, one per flow
│   └── fixtures/                 sample backups (v1 valid, invalid, future version)
├── .github/workflows/ci.yml
├── vercel.json                   SPA rewrite + security headers (CSP)
├── vite.config.ts
├── playwright.config.ts
└── eslint.config.js
```

Engine tests sit next to their source (`money.test.ts`), so the engine folder is self-contained.

**Dependency direction** (enforced with ESLint `no-restricted-imports`):

```
features ──> ui, db, engine, theme, platform
db       ──> engine
ui       ──> engine, theme
engine   ──> (nothing)
```

---

## 4. Data model

### 4.1 Stored records (IndexedDB via Dexie)

```ts
type ColourId = 'canary' | 'mint' | 'blush' | 'lavender' | 'sky' | 'peach' | 'grey';
type FontId   = 'carlito' | 'atkinson' | 'caladea' | 'merriweather';
type IsoDate  = string;  // 'YYYY-MM-DD', local calendar date
type Epoch    = number;  // ms since epoch, for timestamps and ordering
type Paise    = number;  // always a safe integer (see §5.1)

interface Notebook {
  id: string;            // crypto.randomUUID()
  name: string;          // 1–60 chars, trimmed
  colour: ColourId;
  createdAt: Epoch;
  updatedAt: Epoch;      // bumped on any change to the notebook or its pages
}

interface Line {
  description: string;   // English-only text (§5.8), up to 120 chars
  amountText: string;    // exactly what the user typed, kept for display/editing
  amountPaise: Paise | null; // null = empty or not a number (counts as 0, flagged)
}

interface Page {
  id: string;
  notebookId: string;
  number: number;        // 1-based position in the notebook; contiguous
  date: IsoDate;         // defaults to today
  title: string | null;  // null → shown as "Page N"
  colour: ColourId | null; // null → inherit notebook colour
  lines: Line[];         // length is always LINES_PER_PAGE (10)
  status: 'draft' | 'final';
  finalisedOn: IsoDate | null;
  reopenedOn: IsoDate[];           // history; latest shown as "Reopened on …"
  totalUpdatedOn: IsoDate | null;  // set when a Final page's total changed via the chain
  // Derived, cached, always rewritten by recalculation (never edited directly):
  broughtForwardPaise: Paise;
  totalPaise: Paise;
  createdAt: Epoch;
  updatedAt: Epoch;
}

interface ActivityEntry {
  id?: number;           // auto-increment
  at: Epoch;
  kind: 'notebook-created' | 'notebook-renamed' | 'page-created' | 'page-finalised'
      | 'page-reopened' | 'page-deleted' | 'restore' | 'backup';
  notebookId: string | null;
  pageId: string | null;
  text: string;          // pre-rendered, e.g. "Page 3 of Pune trip claims marked Final, 20/11/2026"
}

interface Settings {     // single row, key 'settings'
  font: FontId;          // default 'carlito'
  lastBackupAt: Epoch | null;
  backupReminderDismissedAt: Epoch | null;
  installHintDismissedAt: Epoch | null;
  lastOpenedNotebookId: string | null; // target of the bottom-nav "New page"
}

interface SafetyBackup { // automatic pre-restore copy (§6.3)
  id?: number;
  createdAt: Epoch;
  json: string;          // a full backup document, same format as a user backup
}
```

### 4.2 Dexie schema

```ts
db.version(1).stores({
  notebooks:     'id, updatedAt',
  pages:         'id, notebookId, [notebookId+number], status, updatedAt',
  activity:      '++id, at',
  settings:      'key',
  safetyBackups: '++id, createdAt',
});
```

Schema changes add a new `db.version(n)` with an `upgrade()` function; old versions are never edited. Each version bump has a test that opens a database at the previous version with fixture data and checks the upgrade.

### 4.3 Why derived totals are stored

`broughtForwardPaise` and `totalPaise` can always be recomputed from the lines, so storing them is a cache. It is kept because:

- The library and pages list show totals for many notebooks without loading and summing every page.
- Detecting "a Final page's total changed because of an earlier page" (§5 of spec) needs the previous total to compare against.

The cache is only written by the repository's recalculation step (§6.1), inside the same transaction as the edit, so it cannot drift. A debug check in development mode recomputes the chain on load and logs any mismatch.

---

## 5. Calculation engine (`src/engine/`)

### 5.1 Representation

- An amount is a JavaScript `number` that is always an integer number of paise, checked with `Number.isSafeInteger`.
- The limit is ±99,99,99,999.99 rupees = **±99,999,999,999 paise** (about 10¹¹; corrected 22/11/2026, the earlier figure 9,999,999,999 was ₹9.99 crore). The largest intermediate sum on one page is 11 values within that limit, about 1.1 × 10¹², far below `Number.MAX_SAFE_INTEGER` (9 × 10¹⁵). So integer `number` arithmetic is exact and **BigInt is not needed**. Plain numbers also serialise to JSON and IndexedDB without conversion, which keeps backups simple.
- A branded type `Paise` (`number & { __brand: 'Paise' }`) stops a raw number being passed where paise are expected; only `parseAmount` and the arithmetic helpers create it.

### 5.2 Parsing (`parseAmount`)

Parsing works on the **string** and never calls `parseFloat`, `Number()` on a decimal, or `toFixed`.

```ts
type ParseResult =
  | { kind: 'empty' }                                  // '' or whitespace → counts 0, not flagged
  | { kind: 'ok'; paise: Paise }
  | { kind: 'invalid' }                                // not a number → counts 0, flagged
  | { kind: 'rejected'; reason: 'too-many-decimals' | 'over-limit' };
```

Rules, in order:

1. Trim. Map Devanagari (`०–९`) and full-width (`０–９`) digits to ASCII (decided 22/11/2026). Map Unicode minus `−` and en dash `–` to `-`. Strip a leading `₹`, `Rs`, `Rs.` or `INR` (any case) and the spaces after it. Strip one trailing Indian "only" suffix `/-` (`450/-`, `₹ 450/-`; decided 22/11/2026).
2. Accept one leading `-` or `+`, **or** a value wrapped in brackets `(300.00)` as negative (so a copied display value parses back). Both together (`-(300)`) → `invalid`.
3. **Commas:** accepted only in valid grouping positions, either Indian (`1,00,000`, `12,34,567.89`) or Western (`100,000`, `1,234,567.89`), and then removed. Any other comma → `invalid`. This matters: blindly removing commas would turn `450,50` (a European-style ₹450.50) into ₹45,050. Spaces inside the number → `invalid`.
4. Match `^\d+(\.\d*)?$` or `^\.\d+$`. Anything else (letters, `1e5`, `0x10`, `Infinity`, shorthand like `1.5L`) → `invalid`.
5. More than 2 digits after the point, even trailing zeros (`450.500`) → `rejected: too-many-decimals` ("Up to 2 decimal places, for example 450.50"). **Nothing is ever rounded.**
6. Check the length and the limit **on the digit string** before converting to a number, so a 30-digit paste cannot lose precision.
7. Build paise from integer part × 100 + fractional part padded to 2 digits, using integer maths on digit strings. `-0` becomes `0`.
8. Outside ±99,999,999,999 paise → `rejected: over-limit` ("Amounts must be under ₹99.99 crore").

The full list of accepted and refused inputs is in [edge-cases.md §1](edge-cases.md).

**What the editor does with each result:** `ok` and `empty` save immediately. `invalid` saves with `amountPaise: null` and shows the subtle flag (§3.3 of spec says such amounts count as zero). `rejected` shows the message under the field and **does not save** that keystroke's value; the last valid value stays in the database and the total.

### 5.3 Formatting (`formatPaise`)

- Indian grouping on the rupee part: last three digits, then groups of two: `1,00,000.00`, `99,99,99,999.99`.
- Always two decimals.
- Negatives in accounting brackets: `-30000` → `(300.00)`. No minus sign, same ink colour.
- Implemented with string operations on the integer, **not** `Intl.NumberFormat('en-IN')`, so output is identical on every browser and in tests. (`Intl` is used only as a cross-check in a test.)
- `formatPaise(x, { style: 'brackets' | 'minus' })` takes a style argument from day one, so the open question about a minus-sign setting (§12 of spec) is a settings change, not an engine change.

### 5.4 Page and chain

```ts
const LINES_PER_PAGE = 10;           // single constant; see open question in §15

pageSum(lines: Line[]): Paise        // sum of amountPaise ?? 0
pageTotal(bf: Paise, lines): Paise   // bf + pageSum

interface ChainInput  { id; number; status; lines; broughtForwardPaise; totalPaise; totalUpdatedOn }
interface ChainResult {
  pages: ChainInput[];               // with corrected bf / total / totalUpdatedOn
  changedIds: string[];              // only pages whose cached values changed
  error?: { kind: 'over-limit'; pageNumber: number };
}

recalculateChain(pages: ChainInput[], today: IsoDate): ChainResult
```

`recalculateChain` takes all pages of a notebook sorted by `number` and walks them once: page 1's brought forward is 0; each later page's brought forward is the previous page's total. It is O(n), which is trivial for hundreds of pages.

- For a **Final** page whose total changes, it sets `totalUpdatedOn = today` (shown as "Total updated from earlier page on DD/MM/YYYY").
- If **any** total in the chain would go outside the limit, it returns an `error` naming the page, and the repository rejects the edit that caused it. This covers the case where a small edit on page 1 pushes page 40's total over ₹99.99 crore.
- `renumber(pages)` returns pages with contiguous `number` 1..n after a deletion.

### 5.5 Dates (`dates.ts`)

- Calendar dates are stored as ISO `YYYY-MM-DD` strings in **local** time (a page dated 20/11 stays 20/11 whatever the time zone). Never stored as `Date` objects or UTC timestamps.
- `toDisplay('2026-11-20') → '20/11/2026'`, `fromDisplay('20/11/2026') → '2026-11-20'` with validation (31/02 rejected).
- File names use `DD-MM-YYYY`.
- `today()` is injected (a parameter or a clock module) so tests are deterministic.

### 5.6 Search (`search.ts`)

`normalise(s)` lower-cases, removes diacritics (`NFKD`), and collapses spaces. `matches(query, notebook, pages)` checks notebook name, page titles (including the "Page N" default) and line descriptions. Search runs in memory over all records loaded with one query; at personal scale (a few thousand pages at most) this is instant and needs no index.

### 5.8 English-only text (`text.ts`, decided 23/11/2026)

Descriptions, page titles and notebook names accept Latin-script text only: Basic Latin (printable), Latin-1 Supplement and Latin Extended-A, plus `₹` and common punctuation (– — ‘ ’ ‚ “ ” „ • … ′ ″ ‹ ›). The soft hyphen (U+00AD) and the deprecated `ŉ` (U+0149) are excluded. `filterSupportedText(text)` composes the text (NFC), keeps only allowed characters and reports whether anything was removed; the editor, the title field and the notebook name dialog then show "Only English text is supported for now". The repository applies the same filter as a backstop. **Amounts are not affected** (Devanagari and full-width digits are still mapped to ASCII, §5.2). On restore, any notebook name, title or description with unsupported characters refuses the file (§9.2).

### 5.7 Contrast (`contrast.ts`)

`contrastRatio(hexA, hexB)` per WCAG 2.x relative luminance. The test iterates every slip colour × {ink, secondary ink} and asserts ≥ 4.5. It reads colours from `src/theme/colours.ts`, the same file the CSS variables are generated from, so the test checks what is actually shipped.

Pre-check done for this document: the lowest ratios are on lavender (`#E6DDF7`): 8.96:1 for ink and 6.65:1 for secondary ink. Every colour passes comfortably (ink 8.96–10.45, secondary 6.65–7.76). The test is still required so a future colour change cannot slip through.

---

## 6. Data layer (`src/db/`)

### 6.1 Every page write goes through one function

```ts
async function mutatePages(
  notebookId: string,
  change: (pages: Page[]) => Page[],   // edit, add, delete, finalise, reopen
): Promise<Result<void, ChainError>>
```

Inside a single Dexie `rw` transaction on `pages`, `notebooks` and `activity`:

1. Load all pages of the notebook ordered by `number`.
2. Apply `change`.
3. `renumber` if pages were added or removed.
4. `recalculateChain(pages, today())`.
5. If it returns an error, abort (nothing is written) and return the error to the UI.
6. Write only changed pages (`bulkPut`), bump `notebook.updatedAt`, append an activity entry if relevant.

Because of this single path, "editing an earlier page updates every later page immediately" (§10 of spec) is a property of the data layer, not something each screen has to remember. `useLiveQuery` then re-renders any open list or editor.

### 6.2 Operations

| Operation | Notes |
|---|---|
| `createNotebook(name, colour)` | Also creates page 1 so the user lands on a usable page. |
| `renameNotebook`, `recolourNotebook` | |
| `deleteNotebook` | Not in the spec's list; included behind a confirmation that names the page count, because a user who creates a test notebook needs a way out. Only allowed when every page is a Draft, or with a second explicit confirmation. |
| `updateLine(pageId, index, patch)` | Called by autosave. |
| `updatePageHeader(pageId, {date, title, colour})` | |
| `appendPage(notebookId)` | Always adds at the end. |
| `finalisePage`, `reopenPage` | Finalise is **refused while any amount on the page is invalid** (flagged), decided 22/11/2026 (edge-cases LIF-18). Reopen pushes today onto `reopenedOn`. |
| `deleteDraftPage(pageId)` | Refuses Final pages at the repository level, not just in the UI. |

### 6.3 Activity

The last 5 entries are shown on the library (§3.1 of spec). The table is trimmed to the latest 200 entries on write so it cannot grow without limit. Entries store pre-rendered text so a later rename does not rewrite history.

### 6.4 Safety backups

Before a restore replaces data, the current data is serialised (same format as a user backup) into `safetyBackups`. The latest 3 are kept. Settings shows "Undo last restore" while one exists, and also lets the user download it. This is kept inside IndexedDB rather than auto-downloaded because a download outside a direct tap is unreliable on phones. Undo itself first saves the current data as a safety backup, so an undo can be undone.

### 6.5 Several tabs or windows

The same browser can have Note-Add open in more than one tab or window (or the installed app plus a browser tab on desktop). They share one IndexedDB database.

- **Live updates:** `useLiveQuery` already re-renders other tabs when data changes.
- **Same page in two tabs:** writes are per line (`updateLine`), so the last write wins for that line only, never for the whole page. If the open editor has unsaved edits on a line that another tab changed, it shows "This page was changed in another window" and takes the new values when the user leaves the field.
- **Restore, undo restore:** the tab doing it posts on a `BroadcastChannel('note-add')`; other tabs flush pending saves, then reload.
- **Schema upgrade by a newer version:** an old tab handles Dexie's `versionchange` event by closing its connection and showing "Note-Add was updated — reload", so the upgrade is never blocked.

### 6.6 Defensive reads

On load, pages are checked against the engine: a page whose line count is not 10 is padded (a line with content is never dropped), and cached totals that disagree with a recomputation are corrected by running `mutatePages` with no change. Both cases are logged in development builds. Neither ever changes an amount.

---

## 7. UI

### 7.1 Routes

| Path | Screen | Spec |
|---|---|---|
| `/` | Notebooks library (home) | §3.1 |
| `/n/:notebookId` | Notebook pages list + Archive | §3.2 |
| `/n/:notebookId/p/:pageNumber` | Page editor | §3.3 |
| `/settings` | Settings | §3.4 |

Using the page **number** in the URL makes URLs readable ("page 3"); after a deletion the editor redirects if the number no longer exists.

**Bottom navigation:** Notebooks · New page · Settings. "New page" appends a page to `lastOpenedNotebookId`. If there is no notebook yet, it opens the "Add a new book" dialog first.

### 7.2 State

- **Persistent state** (notebooks, pages, settings) lives in IndexedDB and is read with `useLiveQuery`. There is no Redux/Zustand.
- **Editor state** is local React state for the page being edited, so typing never waits on the database. The total shown in the editor is computed from local state with the engine on every keystroke (live). Brought forward comes from the database (it depends on earlier pages).
- **Autosave** debounces writes by 400 ms per page, flushes immediately on blur, route change, `visibilitychange` (app backgrounded) and `pagehide`. The indicator shows "Saving…" then "Saved".

### 7.3 Page editor keyboard flow

Each line is two inputs: description (`enterkeyhint="next"`, `dir="auto"`, 120 characters max, pasted newlines and tabs become spaces) and amount (`type="text"`, `inputmode="decimal"`, `enterkeyhint="next"`, `autocomplete="off"`, 20 characters max). Amounts are never `type="number"`, which accepts `e`, changes value with the mouse wheel and arrow keys, and hides invalid text from JavaScript. All inputs use a font size of at least 16 px so iPhone does not zoom on focus.

The **date** field is a text input with a DD/MM/YYYY mask plus a picker button, not a native `<input type="date">`, because the native control shows the device's locale format (MM/DD/YYYY on US-English phones). Accepted range 01/01/1900 to 31/12/2099.

Focus order is managed by an index (`line × 2 + field`) rather than DOM tab order, so Enter behaves the same everywhere:

| Focus | Enter / Next |
|---|---|
| Line k description | Line k amount |
| Line k amount (k < 10) | Line k+1 description |
| Line 10 amount, page is last in notebook | Flush save → `appendPage` → navigate to new page → focus line 1 description |
| Line 10 amount, a later page exists | Navigate to the next existing page, line 1 (does **not** insert a page in the middle, which would renumber everything; see §15) |

Enter is caught in `onKeyDown` (`key === 'Enter'`) with `preventDefault`. On Android this fires for the IME "Next" key. **Enter during IME composition is ignored** (`event.isComposing` or `keyCode === 229`), so confirming a word on a Hindi or predictive keyboard does not jump fields. Pressing Enter while a field shows a rejected value keeps focus there. Creating a page from line 10 has an in-flight guard, so a double press creates exactly one page.

**Phone keyboard problem (known, must be designed for):** the iPhone decimal keypad (`inputmode="decimal"`) has **no minus key and no return/Next key**, and some Android keyboards also omit minus. The editor therefore shows a small **editing bar** pinned just above the on-screen keyboard (positioned with the `visualViewport` API) while an amount field is focused, with two buttons:

- **±** toggles the sign of the current amount.
- **Next ↵** does exactly what Enter does.

This keeps "fill three pages by keyboard alone" achievable on iPhone. It is verified on real devices in phase 2, not just in emulation.

Final pages render inputs as `readOnly` (not `disabled`, so text stays selectable and readable by screen readers) with a Reopen button.

### 7.4 Components

- `Slip` — the sticky-note surface: paper colour, ruled lines drawn with a CSS `repeating-linear-gradient` in the ruled colour, soft shadow. Takes `colour` and `font` props; used by the editor, list previews and the library stacks.
- `NotebookStack` — 2–3 offset `Slip` backgrounds to suggest a pad; thick border and shadow. `AddBookTile` is deliberately different: thin border, no shadow, `+` icon (§3.1).
- `AmountCell` — right-aligned, `font-variant-numeric: tabular-nums lining-nums`, shows the invalid flag (a small dot with an accessible label "Not a number, counted as zero").
- `StatusBadge` — Draft / Final.
- `ConfirmDialog` — native `<dialog>` element for delete, restore and Final confirmations.

### 7.6 Accessibility (phase 7)

Checked automatically with axe on every screen and dialog state (zero violations of any impact) and by keyboard-only, focus-trap, focus-ring, reduced-motion and large-text tests (`tests/e2e/a11y.spec.ts`); Lighthouse accessibility is 1.00. Rules the code follows: native `<dialog>` (focus moves in, is trapped, returns to the trigger, Escape closes); every control has a visible focus ring and a 44 × 44 px target; status is text, never colour alone; the live total is announced politely and throttled; `prefers-reduced-motion: reduce` turns every transition and animation off; at very large text the layout reflows (one column of notebooks, a wrapping bottom navigation, an amount column that never exceeds the slip) instead of scrolling sideways. Content never pops in above something the user is about to tap: the library and Settings render only when everything they need has been read (D73), and transient notices (offline-ready, update available, in-app browser, private window) float in a fixed layer above the bottom navigation (D74). Lighthouse CLS is 0.005 to 0.03.

### 7.5 Theme

`src/theme/colours.ts` holds the seven slip colours and two ink colours from §4 of the spec. CSS custom properties (`--paper`, `--rule`, `--ink`, `--ink-2`) are set on the `Slip` element from it. The chrome (navigation, buttons) uses Work Sans on a neutral off-white; slips use the chosen font set on `--slip-font`.

Touch targets are enforced by a shared `min-height/min-width: 44px` on interactive components, and an e2e check measures every button and input on each screen.

---

## 8. Export (`src/features/export/`)

### 8.1 Why a canvas renderer instead of html-to-image

The spec requires exports to "match the on-screen page on phone and desktop". DOM-to-image libraries work by serialising the DOM into an SVG `foreignObject`. On iPhone Safari this commonly renders without the web font on the first attempt and has canvas size limits that vary by device, which would break exactly the platform most users have.

Instead, `renderSlip(ctx, model, options)` draws the export directly with the Canvas 2D API from a plain data model:

```ts
interface SlipModel {
  notebookName; pageTitle; dateDisplay; pageLabel;  // "Page 3 of 7"
  broughtForward: string; lines: {description; amount; flagged}[]; total: string;
  paper; rule; ink; ink2; fontFamily;
  footer: 'Made with Note-Add · spearman.in';
}
```

- The model is built from the same engine formatters as the screen, so numbers are identical.
- Layout constants (margins, line height, column widths) live in one file shared by the CSS (as custom properties) and the renderer, so the export and the screen use the same proportions.
- Before drawing, `await document.fonts.load('16px "<font>"')` for the slip font and Work Sans, so the font is always present.
- Long descriptions are truncated with an ellipsis using `measureText`, the same rule the screen applies with CSS `text-overflow`.
- Only English-only text (§5.8) reaches the renderers; every allowed character has a glyph in the bundled slip fonts or Work Sans, so screen, JPEG and PDF use the same fonts (decided 23/11/2026).

Rendering at a fixed logical size (for example 1080 × 1350 px, portrait slip) means output does not depend on the device's screen size.

### 8.2 Formats

- **JPEG:** `canvas.toBlob(cb, 'image/jpeg', 0.92)`.
- **PDF (decided 22/11/2026):** drawn directly with pdf-lib as **real, selectable text**, not an image. `renderSlipPdf(model, fonts)` uses the same `SlipModel` and the same layout constants as the canvas renderer, scaled to a page with the slip's aspect ratio (4:5, 108 × 135 mm). Fonts: the chosen slip font (regular + bold) and Work Sans are **embedded** from the bundled WOFF files as TrueType subsets made by `export/ttf.ts` (WOFF → TrueType, then only the glyphs the page uses, **glyph IDs unchanged**, plus composite-glyph components, the hinting tables, and tiny cmap/name/post tables), so the PDF looks the same on any viewer and needs no installed fonts. There is no kerning or shaping: Latin text and amounts only. `@pdf-lib/fontkit` stays a dev dependency, used by tests to prove the subsets have identical outlines and widths. The paper colour, ruled lines and rules are vector shapes.
  - **Fonts per text run:** each run is drawn with the first font in the chain *slip font latin → slip font latin-ext → Work Sans latin → Work Sans latin-ext* that has the glyph (Atkinson Hyperlegible and Caladea have no `₹`, for example). With the English-only rule (§5.8, decided 23/11/2026) every allowed character is covered; a test checks this for every font. A character no bundled font covers would become `?`, as a safeguard only. No other-script fallback font and no `regenerator-runtime` workaround are bundled (both removed 23/11/2026).
  - Long descriptions are truncated with an ellipsis using the embedded font's own widths, the same rule as the canvas.
  - pdf-lib needs no `eval` and runs under the CSP.
- File name: `<notebook>-<page title>-<DD-MM-YYYY>.pdf|.jpg`, with characters unsafe in file names (`/\:*?"<>|`) replaced by `-`, spaces kept, and length capped at 100 characters.

pdf-lib and the renderer are **lazy-loaded** (`import()`) when the user first taps Export, keeping them out of the initial bundle.

### 8.3 Share or download (`src/platform/share.ts`)

```ts
async function shareOrDownload(file: File): Promise<'shared' | 'downloaded' | 'cancelled'>
```

1. If `navigator.canShare?.({ files: [file] })` → `navigator.share({ files: [file], title })`. `AbortError` (user closed the sheet) → `'cancelled'`, silently.
2. Otherwise create an object URL and click a temporary `<a download>`.

**Gesture timing on iPhone:** Safari only allows `navigator.share` shortly after a tap. If building the file takes too long, `share` throws `NotAllowedError`. The export flow handles this: on that error it shows "Your file is ready" with a **Share** button, whose tap calls `share` again with the already-built file. Rendering is fast enough that this is the fallback, not the normal path.

The same function is used for backups (§9).

---

## 9. Backup and restore (`src/db/repo/backup.ts`)

### 9.1 Format

```json
{
  "format": "note-add-backup",
  "version": 1,
  "appVersion": "1.0.0",
  "exportedAt": "2026-11-22T10:15:00.000Z",
  "summary": { "notebooks": 3, "pages": 21, "lastChanged": "2026-11-20" },
  "data": {
    "notebooks": [ ... ],
    "pages": [ ... ],
    "activity": [ ... ],
    "settings": { ... }
  }
}
```

- `version` is the **backup format** version, separate from the Dexie schema version. It changes only when the file shape changes.
- `summary` is informational; on restore it is recomputed from `data`, never trusted.
- Amounts are plain integers, so JSON round-trips them exactly.
- Safety backups are excluded from backups.
- File name: `note-add-backup-<DD-MM-YYYY>.json`. Successful backup sets `settings.lastBackupAt`.

### 9.2 Restore pipeline

1. User picks a file (`<input type="file" accept="application/json,.json">`). Files of 0 bytes or over 20 MB are refused before reading.
2. Strip a leading byte-order mark (a file opened and saved in Notepad has one). Parse JSON; reject if not valid JSON ("This is not a Note-Add backup file").
3. Check `format === 'note-add-backup'`. If `version` is newer than the app supports: "This backup was made by a newer version of Note-Add. Update the app and try again." Older versions run through `migrateBackup(vN → current)` functions (§9.4).
4. Validate with a Zod schema. **Text fields are strict too** (decided 23/11/2026): a notebook name, page title or line description with characters outside the English-only set (§5.8) refuses the file with a message naming where; recent-activity entries with such text are dropped with a note. **Money fields are strict:** every paise value must be a safe integer within the limit (a decimal like `450.5` or a string like `"45050"` is refused), `lines.length === 10`, page numbers contiguous from 1 per notebook, no duplicate IDs, every page's `notebookId` exists, string lengths within limits. **Cosmetic fields are forgiving:** an unknown colour or font falls back to the default and unknown extra fields are dropped, with a note in the summary.
5. **Recompute every chain** with the engine and compare to the stored totals. A mismatch means the file was edited or corrupted: refuse with a message rather than silently "fixing" someone's money.
6. Show the summary ("3 notebooks, 21 pages, last changed 20/11/2026") and a confirmation that says current data will be replaced.
7. On confirm: write a safety backup of current data (§6.4), then in **one transaction** clear `notebooks`, `pages`, `activity`, `settings` and bulk-insert the backup. If anything fails, the transaction rolls back and current data is untouched.
8. Set `lastBackupAt` to the file's `exportedAt` (the restored settings hold the value from *before* that backup was made). Log a `restore` activity entry. Tell other tabs to reload (§6.5).

### 9.4 Old backups

Every format version the app has ever written must keep restoring, for ever.

- `migrateBackup` is a chain of pure functions `v1 → v2 → … → current`, each with a committed fixture file made by the real app at that version, in `tests/fixtures/backups/vN/`.
- A migration may **add** fields with defaults (for example a new setting) and **reshape** data, but must never change an amount, a line, a page number or a page status. Migrated chains are recomputed and must match the totals in the file, exactly like an up-to-date backup.
- If a later version changes a money rule (it should not), the migration must carry the old rule's results unchanged, not recalculate them under the new rule.
- The backup format `version` is separate from the app version: an old app version that wrote format v1 produces a file the newest app restores through the same v1 path.

### 9.5 Backup reminder

Shown on the library when there is at least one page with content and `now − (lastBackupAt ?? firstDataAt) > 30 days`, and the banner was not dismissed in the last 30 days. Dismissing sets `backupReminderDismissedAt`.

---

## 10. PWA, offline and storage

### 10.1 Service worker

vite-plugin-pwa in `generateSW` mode:

- **Precache** the build: HTML, every JS chunk (including the lazy export chunk and the route chunks, so export and every screen work offline), CSS, icons, the font licences, and **only the latin and latin-ext font subsets** as WOFF2 (screen) and WOFF (embedded into PDFs). The cyrillic, greek and other subsets are not cached: English-only text cannot use them (D30, ADR 002). About 70 entries, 2.2 MB.
- No runtime caching rules are needed because there are no network resources other than the app itself.
- `registerType: 'prompt'`: when a new version is deployed, a small "New version available — Reload" toast appears. The app never reloads by itself, so it cannot interrupt typing. When the user taps Reload, every open editor first **flushes its pending typing** (PWA-03), an **export, backup or restore in progress finishes** (PWA-04), and only then the new version takes over. The worker is registered after the first paint from a lazily loaded script file (`injectRegister: false`), so the CSP needs no inline script. Updates are looked for every hour and when the app returns to the foreground. If registration fails (blocked, private mode, storage full) the app works online and shows no error (PWA-10).
- `navigateFallback: '/index.html'` so deep links work offline.

### 10.2 Manifest

`id`, `name: "Note-Add"`, `short_name: "Note-Add"`, `display: "standalone"`, `start_url` and `scope` (both the base path), `theme_color` `#FFF4A3` (canary) and `background_color` `#FAFAF7`, icons 192/512 plus a maskable 512. `apple-touch-icon` (180), `apple-mobile-web-app-*` and `mobile-web-app-capable` meta tags in `index.html` for iPhone. All icons are generated by `npm run icons` from one source SVG (`scripts/icons/icon.svg`) using the Playwright Chromium; the PNGs are committed.

If the app is hosted at `spearman.in/note-add` instead of a subdomain, `base`, `start_url`, `scope`, the service-worker scope and the router basename all become `/note-add/`; this is one config value (`VITE_BASE`) set at build time. `npm run test:e2e:base` builds and tests exactly that (PWA-09).

### 10.3 Persistent storage

On first data write, call `navigator.storage.persist()` once (Chrome grants it to installed or frequently used apps; Safari decides on its own). Store the result. Settings › About shows "Storage: protected" or "Storage: may be cleared by the browser — keep backups" (or, where the browser cannot say, "this browser cannot protect it — keep backups"). The status is read with `navigator.storage.persisted()` and never prompts; a refusal is information only, with no nagging (STO-04).

### 10.4 iPhone install hint

Shown when: iOS/iPadOS Safari (user-agent plus `'ontouchend' in document` for iPadOS), **not** standalone (`navigator.standalone !== true` and not `matchMedia('(display-mode: standalone)')`), and not dismissed recently. Text: "Install to keep your notes safe: tap Share, then Add to Home Screen." Hidden for 30 days after "Got it" (a clock moved backwards keeps it hidden). iPadOS in desktop mode is found by touch support (PWA-08); Chrome, Firefox and in-app web views on iOS are not offered it (they cannot add to the home screen the same way). Android/desktop Chrome use the `beforeinstallprompt` event (kept from start-up) to show an "Install app" button in Settings, hidden once installed (PWA-07).

**iPhone gives the installed app its own storage, separate from Safari.** Notes typed in Safari do not appear in the installed app. So the hint is shown on first visit, before any data is entered; if Safari already has notes, it says "Back up first, then restore inside the installed app: the installed app starts with its own empty storage" and offers a **Back up now** button (STO-05).

### 10.5 Browsers that lose data

- **In-app browsers** (a link opened inside WhatsApp, Instagram, Facebook or Gmail) have their own storage and often block downloads. Detected by user-agent tokens, Android WebView (`; wv)`) and, on iOS, a web view with no `Safari/` token; a banner on every screen says "Open in Chrome or Safari to keep your notes." with the reason (SHR-07). Dismissed for the page visit only, because the risk remains.
- **Private windows** delete storage on close. Best-effort banner: "Notes in a private window are deleted when it closes." Detection is a heuristic (a storage quota under 120 MB, as Chromium incognito reports); no method works in every browser, and Safari and Firefox private windows are mostly not detected (STO-02).
- **IndexedDB unavailable** (blocked by policy, very old browser): full-screen message instead of the app.

---

## 11. Privacy and security

- **No network after load.** `vercel.json` sets a Content Security Policy:
  `default-src 'self'; img-src 'self' blob: data:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'`.
  Any accidental third-party request (a CDN font, an analytics snippet) fails loudly.
- **E2E privacy test:** Playwright records every request during a full user journey and fails if any goes to an origin other than the app's.
- **E2E runs under the real CSP.** `vite preview` does not read `vercel.json`, so `vite.config.ts` sets `preview.headers` from the same headers file. Otherwise the tests would never see a blocked request.
- **No `eval`.** The CSP has no `'unsafe-eval'`. Zod 4 uses `new Function` for speed unless told not to, so the app calls `z.config({ jitless: true })` at start-up. Every library is checked under the CSP in e2e.
- No cookies, no `localStorage` for data (only IndexedDB), no error-reporting service.
- User text is rendered as React text nodes only; no `dangerouslySetInnerHTML`. Restore input is validated before it touches the database.
- Other headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` disabling camera, microphone, geolocation.

---

## 12. Testing strategy

This is the summary; the full list of test suites, cases and the manual device checklist is in [test-plan.md](test-plan.md).

| Layer | Tool | What is covered | Phase |
|---|---|---|---|
| Engine: money | Vitest + fast-check | Parsing every input form in §5.2; formatting incl. `0.00`, `(0.05)`, `1,00,000.00`, `99,99,99,999.99`; limits at exactly ±99,999,999,999 paise and ±1 beyond; property test: `parse(format(x)) === x` for all valid x; property test: our sum equals a BigInt reference sum | 1 |
| Engine: chain | Vitest + fast-check | 50-, 200- and 1000-page chains; edit page 1 of a 50-page notebook and check every later page; negatives; Final pages get `totalUpdatedOn`; over-limit anywhere in the chain is reported; delete + renumber | 1 |
| Engine: dates, search, contrast | Vitest | DD/MM/YYYY round-trips, invalid dates; search matches; **contrast ≥ 4.5 for all 7 colours × 2 inks** | 1, 4 |
| Repositories | Vitest + fake-indexeddb | `mutatePages` atomicity (a failing chain writes nothing); refusing to delete Final pages; activity trimming; backup → wipe → restore deep-equals original; safety backup + undo; schema migrations | 2, 3, 6 |
| Components | Vitest + Testing Library | Editor keyboard focus order; rejected input keeps last valid value; read-only Final page | 2 |
| E2E | Playwright (Chromium, Pixel 7, iPhone 14 WebKit) | Fill three pages by keyboard; reload persistence; notebook create/rename/colour; search; Final → Archive → Reopen; delete Draft; export produces a file of the right type and name; backup/restore round trip; offline reload (`context.setOffline(true)`); no third-party requests; 44 px targets | 2–7 |
| Export visual | Playwright screenshot comparison | Rendered JPEG of a fixture page compared against a committed baseline per font (catches layout drift) | 5 |
| Lighthouse | `@lhci/cli` in CI on `main` | Accessibility ≥ 95, performance ≥ 90 (mobile preset), best practices | 7 |
| Real devices | Manual checklist | Android Chrome, iPhone Safari (installed and not), desktop Chrome/Edge: install, airplane mode, share sheet, keyboard bar | 2, 5, 7 |

**Note on "Lighthouse PWA checks":** Lighthouse removed its PWA category in version 12 (2024). The spec's success criterion is met instead by (a) an e2e test that checks the manifest fields, icons and an active service worker controlling the page, (b) the offline e2e test, and (c) Chrome DevTools' installability check during the manual device pass.

**Coverage target:** 100% line and branch coverage for `src/engine/` (enforced in Vitest config); no numeric target elsewhere.

---

## 13. Build harness

### 13.1 `CLAUDE.md` rules (created in phase 0)

- Money is integer paise only. Never use `parseFloat`, `toFixed`, or floating-point arithmetic on amounts. All parsing and formatting goes through `src/engine/money.ts`.
- `src/engine/` has no UI, DOM, React or Dexie imports. Every engine change has tests.
- All page writes go through `mutatePages` so the carry-forward chain is always recalculated.
- Dates are DD/MM/YYYY in the UI, ISO `YYYY-MM-DD` in storage.
- Indian digit grouping; negatives in brackets.
- No network requests, third-party scripts, fonts from CDNs, analytics or cookies.
- Never commit unless lint, type check and all tests pass. Never skip hooks.
- One phase at a time; each phase ends with its exit criteria demonstrated.

### 13.2 Lint guards

ESLint `no-restricted-imports` blocks `react`, `react-dom`, `dexie` and `src/ui|features|db` from `src/engine/**`. `no-restricted-syntax` / `no-restricted-globals` in `src/engine/**` and `src/db/**` bans `parseFloat`, `Number.prototype.toFixed` and `Math.round` on amounts (with an inline-disable needing a comment for the few legitimate cases, such as contrast maths).

### 13.3 Scripts

```
dev          vite
build        tsc -b && vite build
preview      vite preview
lint         eslint .
typecheck    tsc -b --noEmit
test         vitest run
test:e2e     playwright test
lhci         lhci autorun
```

Pre-commit (Husky): `lint-staged` (eslint + prettier on staged files), then `typecheck`, then `test`.

### 13.4 CI (`.github/workflows/ci.yml`)

On every push and pull request: install (`npm ci`, cached) → lint → typecheck → unit tests with coverage → build → Playwright (browsers cached) with the built app served by `vite preview`. Upload the Playwright report on failure. On `main` only: Lighthouse CI against the preview build.

### 13.5 Deployment

Vercel project linked to the GitHub repo: preview deployments for every branch, production from `main`. Framework preset Vite, output `dist/`. `vercel.json` holds the SPA rewrite (`/(.*) → /index.html`, excluding files with extensions) and the headers in §11. The service worker file is served with `Cache-Control: no-cache` so updates are picked up.

---

## 14. Performance budget

| Item | Budget |
|---|---|
| Initial JS (gzip) | ≤ 150 KB (React + router + Dexie + the library screen), **achieved: 143 KB**. The editor, pages list and Settings are route-split; `npm run size` enforces both budgets |
| Fonts on first load | Only Work Sans + the selected slip font are preloaded; the other three are precached by the service worker after load |
| Export chunk (pdf-lib + `ttf.ts` + renderer) | Lazy; ≤ 250 KB gzip, **achieved: 77 KB** (D37). pdf-lib's unused standard-font metrics and PNG codec are stubbed at build time (`export/stubs/`). Font files for PDF embedding are fetched from the app's own origin at export time and are not counted |
| Time to interactive, mid-range Android, 4G, first visit | < 2 s |
| Repeat visit (from service worker) | < 1 s |
| Recalculation of a 200-page notebook | < 50 ms including the IndexedDB write |

Vite's bundle report is checked in CI with a size-limit step that fails if the initial bundle exceeds the budget.

---

## 15. Decisions for confirmation and answers to the spec's open questions

These are this document's proposed defaults. Each is cheap to change because the code isolates it.

| Question | Proposed default | Where it lives |
|---|---|---|
| Page title required? | No. `null` shows "Page N". | `Page.title` |
| 10 lines or a setting? | 10 for v1; one engine constant. A setting later would need a backup format bump, since `lines.length` is validated. | `LINES_PER_PAGE` |
| Minus-sign style for negatives? | Not in v1 UI, but the formatter already accepts a style argument. | `formatPaise(…, { style })` |
| Address | Either works; `notes.spearman.in` is simpler (root scope, no base path). | `VITE_BASE` |
| Edge-case decisions (empty-page Enter, deleting the only page, Draft label on exports, and others) | See [edge-cases.md §18.1](edge-cases.md) | Various |
| Enter on line 10 when later pages exist | Go to the next existing page; never insert in the middle. | Editor focus logic |
| Bottom-nav "New page" target | Last opened notebook; if none, create a notebook first. | `settings.lastOpenedNotebookId` |
| Delete a whole notebook | Allowed with confirmation (not in spec). | `deleteNotebook` |
| Per-page colour override UI | A colour dot in the editor header; null inherits the notebook. | `Page.colour` |
| PDF text selectable? | **Yes (decided 22/11/2026):** real text drawn with pdf-lib, bundled fonts embedded. | `renderSlipPdf` |
| Final page with invalid amounts? | **Refused (decided 22/11/2026)** until every amount is valid or empty. | `finalisePage` |
| Devanagari digits, `450/-` suffix | **Accepted (decided 22/11/2026)**: digits mapped to ASCII, suffix stripped. | `parseAmount` |
| Text in other scripts | **Not in v1 (decided 23/11/2026)**: English-only descriptions, titles and names; other characters removed with a message; restore refuses such files. | `engine/text.ts` |

---

## 16. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| iPhone decimal keypad lacks minus and Next | Users cannot enter refunds or move by keyboard | Editing bar with ± and Next (§7.3); tested on a real iPhone in phase 2 |
| iPhone evicts data of non-installed sites after weeks of non-use | Data loss | Install hint, `persist()`, 30-day backup reminder, Settings shows storage status |
| `navigator.share` rejected after slow file generation on iPhone | Export seems to do nothing | Second-tap "Share" fallback (§8.3) |
| Users need text in other scripts (Hindi, Tamil…) | Text removed from descriptions | v1 is English only (§5.8, decided 23/11/2026); the message explains it. Adding scripts later needs a PDF font and shaping strategy |
| User edits a backup by hand | Wrong totals restored | Restore recomputes chains and refuses mismatches (§9.2) |
| Long notebooks make every edit rewrite many pages | Slow typing | Only changed pages are written; edits are debounced; budget tested with 200 pages |
| Service worker serves a stale version | Bug fixes don't reach users | Update prompt; `no-cache` on the service worker file |
| "Note-Add" name conflict | Rename after launch | Name check is a phase 8 gate before the domain and spearman.in card |

---

## 17. Phase-to-architecture map

| Phase (spec §11) | Main modules built | Key tests |
|---|---|---|
| 0 Harness | Scaffold, `CLAUDE.md`, ESLint/Prettier, Husky, CI, `vercel.json`, placeholder page | CI green; placeholder on Vercel |
| 1 Engine | `src/engine/*` | Full engine suite, 100% coverage |
| 2 Editor | `db/schema`, `repo/pages` (`mutatePages`), `features/editor`, `ui/Slip` (plain), editing bar | Keyboard three-page e2e; reload persistence |
| 3 Library & list | `features/library`, `features/notebook`, `repo/notebooks`, `repo/activity`, search | E2E per flow |
| 4 Look & settings | `theme/*`, fonts, `features/settings` (font) | Contrast test; font persists |
| 5 Export | `features/export`, `platform/share` | File type/name e2e; PDF text extraction matches the page; visual baselines; device check |
| 6 Backup | `repo/backup`, restore UI, safety backups, reminder | Round-trip deep-equal; invalid/future-version fixtures |
| 7 PWA | vite-plugin-pwa config, manifest, icons, `features/pwa`, `platform/storage`, CSP | Offline e2e; privacy e2e; Lighthouse CI; device pass |
| 8 Publish | Domain, README user guide, spearman.in card | Real-user 2-minute task |
