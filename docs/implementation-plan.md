# Implementation Plan: Note-Add

Date: 22 November 2026 · Owner: Spearman · Status: draft for review before phase 0
Inputs: [problem-statement.md](problem-statement.md) ("spec") and [architecture.md](architecture.md) ("arch"). Section references look like spec §5 or arch §6.1.
Companions: [edge-cases.md](edge-cases.md) (corner cases, IDs like `MON-14`) and [test-plan.md](test-plan.md) (test suites and the manual device checklist).

This plan turns the spec's nine phases into ordered tasks, each with the files it touches, the tests that prove it, and the exit check that closes the phase. Work runs one phase at a time. A phase is not started until the previous phase's exit criteria have been shown to work.

---

## 0. How to use this plan

### 0.1 Working agreement

- **One branch per phase:** `phase-0-harness`, `phase-1-engine`, and so on. Merge to `main` through a pull request once the exit criteria pass and CI is green.
- **Small commits, one task each** (task IDs below, for example `P1.3`). The pre-commit hook runs lint, type check and unit tests; never bypass it.
- **Tests come with the code**, in the same commit. For the engine (phase 1), write the tests first.
- **Tick the boxes in this file** as tasks finish, so the plan doubles as the progress tracker.
- **If a decision in arch §15 changes**, record it in `docs/decisions/NNN-title.md` and update arch in the same PR.

### 0.2 Definition of done (every phase)

1. All tasks ticked, or explicitly deferred with a note.
2. `npm run lint`, `npm run typecheck`, `npm test` and `npm run test:e2e` pass locally and in CI.
3. The phase's exit criteria (spec §11) are shown to work, with the evidence linked in the PR (test names, screenshots, Vercel preview URL).
4. Nothing breaks the rules in `CLAUDE.md` (integer paise, pure engine, no network, DD/MM/YYYY, Indian grouping).
5. The preview deployment on Vercel works for the new feature.
6. Every edge case assigned to the phase ([edge-cases.md §18.3](edge-cases.md)) has a test named with its ID and is marked ✅.
7. The phase's rows in the [test-plan.md](test-plan.md) manual checklist are filled in, where the phase has any.

### 0.3 Phase overview

| Phase | Theme | Depends on | Rough size | Exit criteria (spec §11) |
|---|---|---|---|---|
| 0 | Harness and placeholder deploy | n/a | 1–2 sessions | CI green; placeholder live on Vercel |
| 1 | Calculation engine | 0 | 2–3 sessions | Full engine suite passes, including all spec §5 edge cases |
| 2 | Page editor and storage | 1 | 3–4 sessions | Three pages filled by keyboard alone; data survives reload |
| 3 | Library, pages list, lifecycle | 2 | 3–4 sessions | E2E test for each flow passes |
| 4 | Look, colours, fonts, settings | 3 | 2–3 sessions | Contrast test passes; font choice persists |
| 5 | Export (JPEG, PDF, share) | 4 | 2–3 sessions | Exports match the on-screen page on phone and desktop |
| 6 | Backup, restore, reminder | 3 (4 for settings UI) | 2 sessions | Backup → wipe → restore reproduces everything |
| 7 | PWA, offline, a11y, performance | 5, 6 | 2–3 sessions | Installability/offline/Lighthouse checks pass; airplane mode works on Android and iPhone |
| 8 | Publish and user testing | 7 | 1–2 sessions + testing time | Live at the chosen address; testers complete the 2-minute task |

"Session" means one focused working block with Claude Code (about 2–3 hours). The sizes are for ordering and planning, not commitments.

```
0 ──> 1 ──> 2 ──> 3 ──> 4 ──> 5 ──┐
                   └────────> 6 ──┴──> 7 ──> 8
```

Phase 6 can be built in parallel with phase 5 once phase 4's Settings screen exists.

### 0.4 Decisions needed before or during the build

| Decision | Needed by | Default if not decided (arch §15) |
|---|---|---|
| Address: `notes.spearman.in` or `spearman.in/note-add` | Phase 7 (manifest scope); final by phase 8 | `notes.spearman.in` |
| Page title required? | Phase 2 | Optional; shows "Page N" |
| 10 lines, or a 10/15 setting? | Phase 2 | 10, fixed |
| Minus-sign style for negatives in Settings? | Phase 4 | Not offered; brackets only |
| Enter on line 10 when a later page already exists | Phase 2 | Go to the next existing page |
| Allow deleting a whole notebook (not in spec) | Phase 3 | Yes, with confirmation |
| Keep the name "Note-Add" | Phase 8 (before the domain) | Keep, if the name check is clear |

---

## Phase 0 — Harness and placeholder deploy

**Goal:** an empty but fully guarded repository: every later commit is linted, type-checked and tested, and every push deploys a preview.

### Prerequisites (one-time, on this machine and accounts)

- [x] **P0.0a** **Node.js 26 LTS** (includes npm) is installed on this machine (confirmed 22/11/2026: `node -v` → v26.13.1, npm 11.20.0).
- [x] **P0.0b** Install **Git for Windows** if `git --version` fails; set `user.name` and `user.email`.
- [ ] **P0.0c** GitHub account with the `gh` CLI signed in (`gh auth login`), or create the repo in the browser.
- [ ] **P0.0d** Vercel account (free Hobby plan), linked to GitHub.
- [x] **P0.0e** Project folder decided (22/11/2026): `C:\Projects\AI Projects\002_Note-Add`, which is outside OneDrive. The path contains spaces, so every script quotes paths (DEV-01).

### Tasks

- [ ] **P0.1 Repository.** `git init`, create public GitHub repo `note-add`, add `LICENSE` (MIT suggested for the code; fonts keep their OFL), move `docs/` in.
- [x] **P0.2 Scaffold.** `npm create vite@latest` with the `react-ts` template. Pin exact versions in `package.json` (no `^`), commit `package-lock.json`. Set `"engines": { "node": ">=26" }` and add `.nvmrc` with `26`.
- [x] **P0.3 TypeScript strict.** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`. Path alias `@/` → `src/`.
- [x] **P0.4 Folder skeleton** from arch §3, with an `index.ts` placeholder in each of `engine/`, `db/`, `features/`, `ui/`, `theme/`, `platform/`.
- [x] **P0.5 ESLint 9 flat config** with typescript-eslint (type-aware), react-hooks, jsx-a11y, and the **architecture guards** from arch §13.2:
  - `no-restricted-imports`: `src/engine/**` may not import `react`, `react-dom`, `dexie`, `@/ui`, `@/features`, `@/db`, `@/platform`.
  - `no-restricted-syntax`/`no-restricted-globals` in `src/engine/**` and `src/db/**`: ban `parseFloat`, `.toFixed(`, `Number.parseFloat`.
  - A deliberately broken sample file is used once to confirm each guard fires, then deleted.
- [x] **P0.6 Prettier** config and `format` / `format:check` scripts.
- [x] **P0.7 Vitest** configured (jsdom environment for `src/ui` and `src/features`, node for `src/engine`), with coverage via `@vitest/coverage-v8`. One trivial passing test.
- [x] **P0.8 Playwright** installed with three projects: `chromium-desktop`, `pixel-7` (Chromium), `iphone-14` (WebKit). `webServer` runs `npm run build && npm run preview`. One smoke test: the placeholder page loads and shows "Note-Add".
- [x] **P0.9 npm scripts** from arch §13.3: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:e2e`, `format`.
- [x] **P0.10 Husky + lint-staged** pre-commit: lint-staged (eslint --fix, prettier) → `npm run typecheck` → `npm test`. Confirm it blocks a commit with a failing test.
- [x] **P0.11 `.gitignore`**: `node_modules/`, `dist/`, `.env*`, `coverage/`, `playwright-report/`, `test-results/`, `.vercel/`.
- [x] **P0.12 `CLAUDE.md`** with the rules in arch §13.1, plus: commands to run, folder map, and "read docs/architecture.md before changing a module".
- [x] **P0.13 GitHub Actions** `.github/workflows/ci.yml` (arch §13.4): Node 26 from `.nvmrc`, `npm ci` with cache, lint, typecheck, unit tests with coverage, build, Playwright with browser cache, upload report on failure. Runs on every push and PR.
- [x] **P0.14 Placeholder page:** "Note-Add — coming soon · Made by Spearman", in plain CSS, no external fonts.
- [x] **P0.15 `vercel.json`:** SPA rewrite plus **security headers including the CSP from arch §11, added now rather than in phase 7**, so any accidental third-party request fails from day one. (The CSP has no `'unsafe-inline'` for scripts, so the PWA plugin in phase 7 must register the service worker with a script file, not an inline script.)
- [x] **P0.15a Same headers in e2e** (SEC-02): `vite.config.ts` sets `preview.headers` from a shared headers file that `vercel.json` also uses, so Playwright runs under the real CSP.
- [x] **P0.15b `.gitattributes`** with `* text=auto eol=lf` (DEV-02).
- [ ] **P0.16 Vercel project** linked to the repo: preview per branch, production from `main`. Record the `*.vercel.app` address in the README.
- [x] **P0.17 README** stub: what the app is, how to run it, links to docs.

### Tests

- Smoke unit test; Playwright smoke test on all three projects.
- Manual: a commit with a failing test is blocked by the hook; a lint-guard violation in `src/engine` fails lint.

### Exit criteria

- [ ] CI green on `main`.
- [ ] Placeholder live on a Vercel address, with the CSP header present (check in browser devtools → Network → Headers).

---

## Phase 1 — Calculation engine

**Goal:** a pure, fully tested `src/engine/` that every later phase relies on for money, totals, the carry-forward chain and dates. No UI in this phase.

**Method:** write the tests first for each module, from spec §5 and arch §5, then implement until they pass.

### Tasks

- [x] **P1.1 Types and constants** (`engine/types.ts`, `engine/page.ts`): branded `Paise`, `IsoDate`, `Line`, `ChainInput`, `LINES_PER_PAGE = 10`, `MAX_PAISE = 99_999_999_999`, `MIN_PAISE = -99_999_999_999` (₹99,99,99,999.99; corrected 22/11/2026 to match spec §5). Helpers `addPaise`, `isWithinLimit`, both asserting `Number.isSafeInteger`.
- [x] **P1.2 `parseAmount`** (`engine/money.ts`), arch §5.2, string-only parsing. The full case list is edge-cases.md §1, §2 and §3 (`MON-*`, `PST-*`, `RND-*`). Test table at minimum:

  | Input | Result |
  |---|---|
  | `''`, `'   '` | empty |
  | `'450'` | 45000 |
  | `'450.5'` | 45050 |
  | `'1280.75'` | 128075 |
  | `'.5'` | 50 |
  | `'450.'` | 45000 |
  | `'0'`, `'0.00'`, `'-0'` | 0 (never negative zero) |
  | `'-300'` | −30000 |
  | `'(300.00)'` | −30000 |
  | `'₹1,280.75'`, `'Rs. 1280.75'`, `'1,00,000'` | 128075, 128075, 10000000 |
  | `'450,50'` (comma as decimal) | invalid (never ₹45,050) |
  | `'450.505'` | rejected: too-many-decimals |
  | `'99,99,99,999.99'` | 99999999999 |
  | `'100000000.00'` (₹10 crore) | 10000000000 (within the limit) |
  | `'1000000000.00'` (₹100 crore, one paisa over) | rejected: over-limit |
  | `'-99,99,99,999.99'` | −99999999999 |
  | `'abc'`, `'12a'`, `'1.2.3'`, `'--5'`, `'1e5'`, `'0x10'`, `'Infinity'`, `'NaN'` | invalid |
  | `'0.1'` + `'0.2'` summed | exactly 30 paise |

- [x] **P1.3 `formatPaise`** (arch §5.3), string-based Indian grouping, brackets for negatives, `style` option (`'brackets'` default, `'minus'`). Tests: `0 → 0.00`, `5 → 0.05`, `-5 → (0.05)`, `100000 → 1,000.00`, `10000000 → 1,00,000.00`, `99999999999 → 99,99,99,999.99`, `-30000 → (300.00)`, minus style `-30000 → -300.00`. Cross-check against `Intl.NumberFormat('en-IN')` in one test.
- [x] **P1.4 Property tests** (fast-check): for every integer in the limit, `parseAmount(formatPaise(x))` gives `x` (both styles); for random lists of amounts, `pageSum` equals a BigInt reference sum.
- [x] **P1.5 `pageSum` / `pageTotal` / line flags** (`engine/page.ts`): `null` amounts count as 0; `isFlagged(line)` is true when `amountText` is non-empty and `amountPaise` is null.
- [x] **P1.6 `recalculateChain`** (`engine/chain.ts`, arch §5.4). Tests:
  - Page 1 BF = 0; page N BF = total of N−1.
  - Chains of 50, 200 and 1000 pages; edit page 1 of a 50-page notebook and check every later BF and total to the paisa.
  - Negatives and refunds that bring a total below zero.
  - A Final page whose total changes gets `totalUpdatedOn = today`; one whose total does not change keeps its old value.
  - `changedIds` lists only pages whose cached values actually changed.
  - Over-limit on page 40 caused by an edit on page 1 returns `error.pageNumber === 40`.
  - Totals exactly at ±MAX are allowed; one paisa beyond is an error.
- [x] **P1.7 `renumber`**: after deleting page 3 of 7, numbers are 1..6, and the chain is correct when re-run.
- [x] **P1.8 Dates** (`engine/dates.ts`, arch §5.5): `toDisplay`, `fromDisplay` (rejects 31/02/2026, 29/02/2027; accepts 29/02/2028), `toFileDate` (`DD-MM-YYYY`), `todayIso(clock)` with an injected clock. Test a date near midnight in a non-UTC zone (set `TZ` in the test) to prove local dates.
- [x] **P1.9 Search** (`engine/search.ts`, arch §5.6): `normalise` and `matches`; cases for notebook name, page title, the "Page N" default title, line description, accented text, multiple spaces, no match.
- [x] **P1.10 Contrast** (`engine/contrast.ts`, arch §5.7): `contrastRatio` against known WCAG reference pairs (black/white = 21). The full colour test is in phase 4, once `theme/colours.ts` exists.
- [x] **P1.11 Coverage gate:** 100% lines and branches for `src/engine/**` in the Vitest config; CI fails below it.
- [x] **P1.12 Engine README** (`src/engine/README.md`, short): public functions and the paise rule.

### Exit criteria

- [ ] Full engine suite passes in CI, including every spec §5 edge case and the spec §10 cases (50+ page chains, negatives, edits to page 1, ±₹99.99 crore).
- [ ] 100% engine coverage.
- [ ] Lint guards confirm the engine imports nothing outside itself.

---

## Phase 2 — Page editor and storage

**Goal:** a working page editor backed by IndexedDB. Plain styling is fine (system font, canary colour); polish comes in phase 4.

**Note on scope:** the editor needs a notebook to exist, but the library screen is phase 3. This phase therefore includes a minimal `createNotebook` in the repository, and a temporary start screen that opens (or creates) a "My notebook" and goes to its last page. Phase 3 replaces the start screen.

### Tasks

- [x] **P2.1 Dexie schema** (`db/schema.ts`, `db/types.ts`), version 1 exactly as arch §4.2. A single `db` instance and a `resetDb()` helper for tests.
- [x] **P2.2 `mutatePages`** (`db/repo/pages.ts`, arch §6.1): one `rw` transaction; load → change → renumber → `recalculateChain` → abort on error → `bulkPut` only changed pages → bump `notebook.updatedAt`. Uses fake-indexeddb tests:
  - A failing chain (over-limit) writes nothing.
  - Editing page 1 of a 50-page notebook updates all later pages in one transaction.
- [x] **P2.3 Page operations:** `createNotebook` (with page 1), `updateLine`, `updatePageHeader`, `appendPage`. Each new page has 10 empty lines, today's date, `title: null`, `status: 'draft'`.
- [x] **P2.4 Routing** (`routes.tsx`): `/n/:notebookId/p/:pageNumber` for the editor, temporary `/` start screen; unknown page number redirects to the last page.
- [x] **P2.5 Editor layout** (`features/editor/PageEditor.tsx`): header (date in DD/MM/YYYY, title placeholder "Page N", "Page 3 of 7"), read-only brought-forward row, 10 lines (description + amount), fixed total row. Amount cells right-aligned with tabular figures.
- [x] **P2.6 Local editor state and live total:** typing updates local state; total = BF from DB + `pageSum(local lines)`, recomputed on each keystroke with the engine.
- [x] **P2.7 Amount input behaviour** (arch §5.2): `invalid` saves with `amountPaise: null` and shows the subtle flag; `rejected` shows the message under the field and keeps the last valid value. The field shows formatted value on blur (`1,280.75`) and the raw text on focus.
- [x] **P2.8 Autosave** (arch §7.2): 400 ms debounce per page; flush on blur, route change, `visibilitychange` and `pagehide`; "Saving…" / "Saved" indicator; a chain error from the repository shows a message and keeps local state so nothing typed is lost.
- [x] **P2.9 Keyboard navigation** (arch §7.3): focus index model; Enter on description → amount; amount → next line's description; line 10 amount → flush, `appendPage`, navigate, focus line 1 (or go to the next existing page). `enterkeyhint="next"`, `inputmode="decimal"` on amounts.
- [x] **P2.10 New page button**: same as Enter on line 10, always appends at the end.
- [x] **P2.11 Phone editing bar** (arch §7.3): pinned above the on-screen keyboard using `visualViewport`, shown while an amount is focused, with **±** and **Next ↵**. Hidden on devices with a physical keyboard (no `visualViewport` resize).
- [x] **P2.12 Accessibility basics:** each input labelled ("Line 3 description", "Line 3 amount"); total announced via an `aria-live="polite"` region (throttled, so it does not chatter on every keystroke).
- [x] **P2.13 Storage persistence request:** call `navigator.storage.persist()` once after the first save (`platform/storage.ts`). Full status display comes in phase 7.
- [x] **P2.14 Input details** (arch §7.3): amount `type="text"`, 20-character cap; description 120-character cap with newlines and tabs turned into spaces, `dir="auto"`; DD/MM/YYYY text date field with picker (not a native date input); IME composition ignored on Enter; in-flight guard on page creation; inputs ≥ 16 px.
- [x] **P2.15 Several tabs** (arch §6.5): per-line last write wins with the "changed in another window" notice; `versionchange` handling; `BroadcastChannel` listener (used by restore in phase 6).
- [x] **P2.16 Defensive reads** (arch §6.6): pad malformed pages, correct cached totals that disagree with the engine; log in development.
- [x] **P2.17 No-IndexedDB screen** (STO-01).

### Tests

- Component tests (Testing Library): focus order across all 10 lines; Enter on line 10 creates page 2 and focuses its line 1; rejected input keeps last valid value; flagged amount shows the mark.
- E2E `editor.spec.ts`: on all three Playwright projects, fill **three pages using only the keyboard** (Enter key on desktop; the editing bar's Next on the iPhone project), check page 3's BF equals page 2's total, **reload, and check every value is still there**.
- E2E: edit page 1 after filling three pages; pages 2 and 3 update immediately without reload.

### Manual checks

- [ ] Real Android phone (Chrome): keyboard "Next" key moves fields; minus available or via ±.
- [ ] Real iPhone (Safari): editing bar appears above the keypad and works; page does not jump when the keyboard opens.

### Exit criteria

- [ ] A user can fill three pages by keyboard alone (e2e passes on all projects; checked by hand on a real iPhone and Android phone).
- [ ] Data survives a reload.

---

## Phase 3 — Library, pages list and page lifecycle

**Goal:** the full navigation of the app: notebooks home, pages list with Archive, Draft/Final/Reopen, deleting Drafts, search and recent activity.

### Tasks

- [x] **P3.1 Notebook repository** (`db/repo/notebooks.ts`): `createNotebook(name, colour)` with validation (1–60 chars, trimmed), `renameNotebook`, `recolourNotebook`, `deleteNotebook` (arch §6.2 rules, if the decision in §0.4 stays "yes").
- [x] **P3.2 Activity repository** (`db/repo/activity.ts`, arch §6.3): append inside the same transaction as the change; pre-rendered text such as "Page 3 of Pune trip claims marked Final, 20/11/2026"; trim to latest 200.
- [x] **P3.3 Lifecycle operations** through `mutatePages`: `finalisePage` (sets `status`, `finalisedOn`; **refused while any amount is invalid**, decided 22/11/2026, LIF-18), `reopenPage` (pushes today to `reopenedOn`), `deleteDraftPage` (refuses Final pages in the repository; renumbers; recalculates).
- [x] **P3.4 Bottom navigation** (`ui/BottomNav.tsx`): Notebooks · New page · Settings (Settings is a stub until phase 4). "New page" appends to `settings.lastOpenedNotebookId`, or opens the new-notebook dialog if there is none. Add the `settings` repository with just this field for now.
- [x] **P3.5 Notebooks library** (`features/library/`): notebook stacks (name, page count, latest page total, colour), the visually distinct "Add a new book" tile, new-notebook dialog (name + colour from the seven presets), recent activity (last 5). Replaces the phase 2 start screen.
- [x] **P3.6 Search** on the library using `engine/search.ts`: results grouped by notebook, each page result opening the editor at that page; empty state "No notebooks or pages match".
- [x] **P3.7 Pages list** (`features/notebook/`): header (name, colour, `+ New page`, rename and colour actions), Draft pages newest first as cards (badge, date, title, first two lines, total), collapsed **Archive** of Final pages, dotted "Add a new page" card. Export buttons are present but disabled with "Coming soon" until phase 5.
- [x] **P3.8 Editor lifecycle UI:** "Mark as Final" (confirmation; disabled with "N amounts are not numbers. Fix them before marking this page Final." while any amount is invalid), read-only Final page with **Reopen**, "Reopened on DD/MM/YYYY" note, "Total updated from earlier page on DD/MM/YYYY" note, "Delete page" on Drafts (confirmation naming the page and saying later pages will be renumbered).
- [x] **P3.9 `ConfirmDialog`** (`ui/`) on the native `<dialog>` element; focus returns to the trigger on close.

### Tests

- Repository tests: Final pages cannot be deleted; reopen history; activity trimming; delete renumbers and recalculates.
- E2E, one spec per flow, all three projects:
  - `notebooks.spec.ts` — create, rename, recolour (and delete, if kept).
  - `search.spec.ts` — finds by notebook name, page title and line description.
  - `final-reopen.spec.ts` — mark Final → appears in Archive, inputs read-only → Reopen → back in Drafts with "Reopened on".
  - `final-recalc.spec.ts` — edit page 1 while page 2 is Final → page 2 shows the new total and "Total updated from earlier page on …".
  - `delete-draft.spec.ts` — delete page 2 of 4 → pages renumber to 1–3 and carry-forwards are correct.
  - `activity.spec.ts` — the last 5 changes appear on the library in order.

### Exit criteria

- [ ] End-to-end tests for each flow pass in CI.

---

## Phase 4 — Look, colours, fonts and settings

**Goal:** the sticky-note look from spec §4, the four bundled fonts, and the Settings screen (font + about; backup UI arrives in phase 6).

### Tasks

- [x] **P4.1 Colour tokens** (`theme/colours.ts`): the seven slips (paper + ruled) and the two inks, as the single source for CSS variables and the export renderer.
- [x] **P4.2 Contrast test** (`theme/colours.test.ts`): every slip × {ink, secondary ink} ≥ 4.5:1 using `engine/contrast.ts`. (Pre-check in arch §5.7: lowest is lavender at 8.96 and 6.65.)
- [x] **P4.3 Fonts.** Add WOFF2 files for Carlito, Atkinson Hyperlegible, Caladea, Merriweather (regular + bold each) and Work Sans (regular, medium, semibold), from Fontsource packages or vendored. `@font-face` with `font-display: swap`. Copy each family's `OFL.txt` to `public/fonts/LICENSES/`. Check each slip font renders digits, `₹`, brackets and comma; note any missing glyph in the README.
- [x] **P4.4 Font registry** (`theme/fonts.ts`): setting label, family name, files, preload flag. Preload Work Sans and the selected slip font only (arch §14).
- [x] **P4.5 `Slip` component** (arch §7.4): paper colour, ruled lines via `repeating-linear-gradient`, soft shadow, square-ish proportions, `--slip-font`. Use it in the editor, page cards and notebook stacks.
- [x] **P4.6 Notebook stack and "Add a new book" tile** styling: thick border and shadow vs thin border, no shadow and `+`.
- [x] **P4.7 Per-page colour override:** colour dot in the editor header; `null` inherits the notebook colour.
- [x] **P4.8 Chrome styling:** Work Sans, neutral off-white background, 44 × 44 px minimum on all interactive elements, visible focus rings.
- [x] **P4.9 Settings screen** (`features/settings/`): Font picker with four choices and a live preview slip; About and privacy (app version from `package.json`, "Made by Spearman" link to spearman.in, the privacy statement from spec §7). Placeholders for Backup/Restore.
- [x] **P4.10 Settings persistence:** `font` in the settings row; applied on app start before first paint to avoid a flash of the wrong font.
- [ ] **P4.11 Minus-sign style** — only if decided "yes" in §0.4; otherwise skip.

### Tests

- Contrast unit test (all 14 pairs).
- E2E `settings-font.spec.ts`: choose each font → editor uses it (computed `font-family`) → reload → still chosen.
- E2E `touch-targets.spec.ts`: every button, link and input on each screen is at least 44 × 44 px.
- Playwright screenshots of the editor in each colour (committed baselines) to catch styling regressions.

### Exit criteria

- [ ] Contrast test passes for all colours.
- [ ] Font choice persists across reloads.

---

## Phase 5 — Export (JPEG, PDF, share)

**Goal:** any page exports as JPEG or PDF that looks like the on-screen slip, through the share menu on phones and as a download on desktops.

### Tasks

- [x] **P5.1 Shared layout constants** (`features/export/layout.ts`): margins, line height, column widths, font sizes, as numbers used by the renderer and as CSS variables used by `Slip`, so both share proportions (arch §8.1).
- [x] **P5.2 `buildSlipModel(page, notebook, settings)`**: pure function using engine formatters; unit-tested (brackets, Indian grouping, "Page N" default title, flags).
- [x] **P5.3 `renderSlip(ctx, model)`**: Canvas 2D at 1080 × 1350 logical px; waits for `document.fonts.load` of the slip font and Work Sans; ruled lines, header, BF row, 10 lines with ellipsis truncation, total, footer "Made with Note-Add · spearman.in".
- [x] **P5.4 `toJpeg`**: `canvas.toBlob('image/jpeg', 0.92)`.
- [x] **P5.5 `toPdf`** (decided 22/11/2026, arch §8.2): pdf-lib draws the slip as **real selectable text** from the same `SlipModel` and layout constants, on a page with the slip's aspect ratio. The slip font (regular + bold), Work Sans and a Noto Sans Devanagari fallback are **embedded** from the bundled font files with `@pdf-lib/fontkit` (`subset: true`). Text runs are split by glyph coverage (EXP-12).
- [x] **P5.6 File names**: `<notebook>-<page title>-<DD-MM-YYYY>.pdf|.jpg`, unsafe characters replaced, capped at 100 characters; unit-tested.
- [x] **P5.7 `shareOrDownload`** (`platform/share.ts`, arch §8.3): `canShare` → `share`, `AbortError` silent, `NotAllowedError` → "Your file is ready" with a second-tap **Share** button; otherwise download.
- [x] **P5.8 Lazy loading**: export code and pdf-lib loaded with `import()` on first tap; a short "Preparing…" state.
- [x] **P5.9 Wire up buttons**: Export PDF / Export JPEG on page cards (enable the phase 3 placeholders) and in the editor.

### Tests

- Unit: slip model, file names, share fallback logic (with mocked `navigator`).
- E2E `export.spec.ts` (desktop Chromium, where share is unavailable): both buttons trigger a download with the right name and type; PDF bytes start with `%PDF`; JPEG decodes at 1080 × 1350.
- **PDF text** (unit and e2e): text extracted from the PDF with `pdfjs-dist` matches the on-screen strings exactly (notebook name, title, date, page label, brought forward, every description and amount, total, footer); the fonts are embedded (no reliance on viewer fonts).
- Visual baselines: render a fixture page in each of the four fonts and compare to committed images (small tolerance).
- E2E: Hindi text in a description renders (no exception; pixel check that the area is not blank).

### Manual checks

- [ ] Android Chrome: share sheet opens; send to WhatsApp and email; the file opens correctly.
- [ ] iPhone Safari (installed and not installed): share sheet opens, or the second-tap fallback works.
- [ ] Desktop Chrome/Edge: file downloads.
- [ ] Side-by-side comparison of the export and the on-screen page for each font and two colours, attached to the PR.

### Exit criteria

- [ ] Exports match the on-screen page on phone and desktop.

---

## Phase 6 — Backup, restore and reminder

**Goal:** a single-file backup that restores everything exactly, a safety net for a mistaken restore, and a gentle 30-day reminder.

### Tasks

- [ ] **P6.1 Backup format + Zod schema** (`db/repo/backup.ts`, arch §9.1): `format`, `version: 1`, `appVersion`, `exportedAt`, `summary`, `data`.
- [ ] **P6.2 `createBackup()`**: reads all tables except `safetyBackups` in one read transaction; returns the JSON document. File name `note-add-backup-<DD-MM-YYYY>.json`; uses `shareOrDownload`; sets `lastBackupAt` and logs a `backup` activity entry on success (not on cancel).
- [ ] **P6.3 `inspectBackup(file)`**: steps 2–5 of arch §9.2: JSON parse, format check, version check (newer → clear message; older → `migrateBackup`), Zod validation, recompute every chain and refuse mismatches. Returns the summary or a user-facing error.
- [ ] **P6.4 `restoreBackup(doc)`**: write a safety backup of current data (keep latest 3), then clear and bulk-insert in **one transaction**; log a `restore` entry.
- [ ] **P6.5 Undo last restore**: in Settings while a safety backup exists; restores it through the same pipeline; also offers "Download this safety copy".
- [ ] **P6.6 Settings UI**: Backup button with "Last backup: DD/MM/YYYY" (or "Never"); Restore flow with file picker → summary ("3 notebooks, 21 pages, last changed 20/11/2026") → confirmation that current data will be replaced → done message.
- [ ] **P6.7 Backup reminder banner** on the library (arch §9.5): shown when there is data and no backup for 30 days; dismissible for 30 days; its button starts a backup.
- [ ] **P6.8 Fixtures** (`tests/fixtures/backups/`): valid v1 backup (3 notebooks, 21 pages, negatives, Final pages, reopened pages, overridden colours, non-default font), invalid JSON, wrong format, future version, tampered totals, missing notebook reference, decimal and string amounts, duplicate IDs, byte-order mark, oversized strings.
- [ ] **P6.9 Old-backup policy** (arch §9.4, edge-cases.md §14.1 `OLD-*`): `migrateBackup` chain with one test per version step; the **v1 fixture made by the real v1.0 app is committed and must restore in every later release** (a permanent regression test); a property test that migration never changes an amount, line, page number or status.
- [ ] **P6.10 Restore hygiene:** 0-byte and 20 MB checks, byte-order mark stripping, strict money vs forgiving cosmetic fields, `lastBackupAt` set to the file's `exportedAt`, `BroadcastChannel` reload of other tabs, undo takes its own safety backup.

### Tests

- Repository: **round trip** — seed fixture → backup → wipe → restore → deep-equal every notebook, page, colour and setting.
- Each bad fixture gives its specific message and leaves current data untouched.
- A restore that fails midway (forced error) leaves current data untouched (transaction rollback).
- Safety backup: restore → undo → original data back exactly.
- Reminder: shown at 31 days with a mocked clock, hidden after dismissal, hidden with no data.
- E2E `backup-restore.spec.ts`: create data in the UI → backup (download) → clear site data → restore that file → everything visible again; then undo.

### Exit criteria

- [ ] Round-trip test (backup → wipe → restore) reproduces everything.
- [ ] A mistaken restore can be undone.

---

## Phase 7 — PWA, offline, accessibility and performance

**Goal:** installable on Android, iPhone and desktop; works fully offline; meets the accessibility and speed targets.

### Tasks

- [ ] **P7.1 vite-plugin-pwa** (arch §10.1): `generateSW`, precache all build output including fonts and the lazy export chunk, `navigateFallback: index.html`, `registerType: 'prompt'`, registration through the plugin's virtual module (not an inline script, because of the phase 0 CSP).
- [ ] **P7.2 Update prompt**: "New version available — Reload" toast; never reloads by itself.
- [ ] **P7.3 Manifest and icons** (arch §10.2): name, short name, standalone, start URL and scope from `VITE_BASE`, theme and background colours, icons 192/512, maskable 512, `apple-touch-icon` 180, iOS meta tags. Generate icons from one source SVG.
- [ ] **P7.4 Persistent storage status** (arch §10.3): result shown in Settings › About ("Storage: protected" / "may be cleared by the browser — keep backups").
- [ ] **P7.5 iPhone install hint** (arch §10.4) on the library when iOS Safari and not standalone, shown on first visit before data is entered, with the "back up first, then restore inside the installed app" variant when Safari already has notes (STO-05); dismissible. `beforeinstallprompt` "Install app" button in Settings for Chromium browsers.
- [ ] **P7.5a Data-loss banners** (arch §10.5): in-app browser (SHR-07) and private window (STO-02).
- [ ] **P7.6 Vercel headers check**: service worker served with `Cache-Control: no-cache`; hashed assets cached long-term; CSP still passes with the service worker registered.
- [ ] **P7.7 Accessibility pass**: axe checks in Playwright on every screen (`@axe-core/playwright`), keyboard-only walkthrough, screen reader spot checks (TalkBack and VoiceOver) on the editor, focus management in dialogs, `prefers-reduced-motion` respected.
- [ ] **P7.8 Performance pass** (arch §14): bundle size limit in CI (initial ≤ 150 KB gzip; export chunk ≤ 250 KB), font preloading as planned, no layout shift when fonts load. Test the 200-page recalculation timing in a repository benchmark test.
- [ ] **P7.9 Lighthouse CI** (`@lhci/cli`) on `main` with the mobile preset: accessibility ≥ 95, performance ≥ 90, best practices ≥ 90.

### Tests

- E2E `pwa.spec.ts` (Chromium): manifest fields and icons load; a service worker controls the page after first load (this replaces the old Lighthouse PWA category; see arch §12).
- E2E `offline.spec.ts`: load once → `context.setOffline(true)` → reload → create a notebook, fill a page, export a JPEG, all working.
- E2E `privacy.spec.ts`: full user journey with request logging; fails on any request to another origin.
- axe e2e on every screen with zero serious or critical violations.

### Manual device checks (record results in the PR)

| Check | Android Chrome | iPhone Safari | Desktop Chrome/Edge |
|---|---|---|---|
| Installs to home screen / app list | [ ] | [ ] | [ ] |
| Opens in standalone window | [ ] | [ ] | [ ] |
| Airplane mode: open, edit, export | [ ] | [ ] | [ ] |
| Data still there after closing and reopening | [ ] | [ ] | [ ] |
| Update prompt appears after a new deploy | [ ] | [ ] | [ ] |
| Loads in under 2 s on a mid-range phone (first visit, 4G) | [ ] | [ ] | n/a |

### Exit criteria

- [ ] Installability, offline, accessibility and performance checks pass (Lighthouse CI thresholds plus the PWA e2e tests).
- [ ] Works in airplane mode on Android and iPhone.

---

## Phase 8 — Publish and user testing

**Goal:** Note-Add live at its final address, linked from spearman.in, and proven with real users.

### Tasks

- [ ] **P8.1 Name check**: search app stores, the web, and the Indian trademark register (ipindia.gov.in) for "Note-Add". If there is a conflict, choose a new name before anything below (it affects the manifest, domain and README).
- [ ] **P8.2 Final address decision** (§0.4). For `notes.spearman.in`: add the domain in Vercel and create the DNS CNAME at the domain registrar. For `spearman.in/note-add`: build with `VITE_BASE=/note-add/` and set up the path on the spearman.in host.
- [ ] **P8.3 Production check** at the final address: HTTPS, headers, install, offline, update prompt (repeat the phase 7 device table quickly).
- [ ] **P8.4 README user guide** (spec §9.4): create a notebook, add lines, new page, Final and Reopen, export, back up and restore, install to the home screen (Android, iPhone, desktop). Include font licence credits and the privacy statement.
- [ ] **P8.5 spearman.in card** in the Ventures section: short description, "Open the app" button, privacy statement.
- [ ] **P8.6 Release**: tag `v1.0.0`, set `appVersion`, short release notes on GitHub.
- [ ] **P8.7 User testing with 3–5 people** (no instructions given): task "create a notebook, fill two pages, export a PDF and send it to yourself". Time each person; note where they hesitate. At least one tester on iPhone and one on Android.
- [ ] **P8.8 Fix round**: fix issues that block the 2-minute task; log everything else as GitHub issues for v1.1.

### Exit criteria

- [ ] Live at the chosen address.
- [ ] Testers complete the 2-minute task.

---

## Appendix A — Spec success criteria traceability

| Spec §10 success criterion | Proven by | Phase |
|---|---|---|
| Every calculation test passes; no total off by a paisa | Engine suite + property tests, 100% coverage | 1 |
| Create notebook, fill two pages, export PDF in < 2 min | P8.7 user testing | 8 |
| Installs and works offline on Android, iPhone, desktop | `offline.spec.ts`, `pwa.spec.ts`, device table | 7 |
| Editing an earlier page updates later pages immediately | `mutatePages` tests; editor and `final-recalc` e2e | 2, 3 |
| Export and backup: share menu on phones, download on desktop | `shareOrDownload` tests; export/backup e2e; device checks | 5, 6 |
| Restore reproduces everything; mistaken restore can be undone | Round-trip and undo tests | 6 |
| Ink and secondary text ≥ 4.5:1 on all slips | Contrast test | 4 |
| Lighthouse checks pass; loads < 2 s on mid-range phone | Lighthouse CI, PWA e2e, bundle budget, device timing | 7 |

## Appendix B — Risk checkpoints

These risks from arch §16 are checked at specific points rather than left to the end.

| Risk | Checkpoint |
|---|---|
| iPhone keypad lacks minus and Next | Real-iPhone check in phase 2 (P2.11) before moving on |
| `navigator.share` gesture timeout on iPhone | Real-iPhone check in phase 5 (P5.7) |
| iPhone data eviction when not installed | Install hint and storage status in phase 7; reminder in phase 6 |
| Hand-edited or corrupted backup | Tampered-totals fixture in phase 6 |
| Slow recalculation on long notebooks | 200-page benchmark test in phase 7 (P7.8); 1000-page engine test in phase 1 |
| Stale service worker | Update prompt checked on a real deploy in phase 7 |
| Name conflict | P8.1, before the domain is set up |
| OneDrive file locking during installs | P0.0e, before scaffolding |
