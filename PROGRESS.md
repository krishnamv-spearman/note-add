# PROGRESS — Note-Add build (phases 0–6)

Branch: `build/phases-0-6` (never pushed, never deployed; no `main` branch exists locally).
Run started 22/11/2026. Owner decisions of 22/11/2026 applied to the docs first: see [docs/decisions/001-owner-decisions-22-11-2026.md](docs/decisions/001-owner-decisions-22-11-2026.md).

## Status

| Phase | Status | Unit tests | E2E tests |
|---|---|---|---|
| 0 Harness | ✅ done | 3 | 3 |
| 1 Engine | ✅ done | 224 | 3 |
| 2 Editor | ✅ done | 291 | 23 (+4 skipped) |
| 3 Library | ✅ done | 321 | 55 (+8 skipped) |
| 4 Look | ✅ done | 338 | 67 (+38 skipped) |
| 5 Export | ✅ done | 362 | 73 (+62 skipped) |
| 6 Backup | ✅ done | 407 (+1 opt-in generator) | 82 (+80 skipped) |
| English-only (23/11) | ✅ done | 429 (+1 opt-in generator) | 82 (+80 skipped) |
| 7 PWA (branch `build/phase-7`) | in progress | see Phase 7 section | see Phase 7 section |

(Counts are cumulative totals after the phase. E2E counts are tests × projects.)

---

## Phase 0 — Harness and placeholder

**Built**
- Vite 6 + React 19 + TypeScript 5 (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`), `@/` alias, exact versions pinned, lockfile, `engines: node >=26`, `.nvmrc` 26.
- Folder skeleton from arch §3 with `index.ts` placeholders.
- ESLint 9 flat config (type-aware typescript-eslint, react-hooks, jsx-a11y) with the **architecture guards** (engine imports nothing outside itself and no DOM globals; db imports engine only; ui imports engine/theme only) and **money guards** (`parseFloat`, `Number.parseFloat`, `.toFixed(`, `Math.round` banned in engine and db). Each guard confirmed to fire on a deliberately broken sample file, which was then deleted.
- Prettier with `format` / `format:check`.
- Vitest with two projects (`node` for engine/db, `jsdom` for UI), v8 coverage with a 100% gate on `src/engine/**`, `TZ` set via config (`TEST_TZ` override), `FC_RUNS` for fast-check, and a setup that **fails any unit test that touches the network**.
- Playwright with `chromium-desktop`, `pixel-7`, `iphone-14` (WebKit); `webServer` builds and runs `vite preview`.
- `vercel.json` with SPA rewrite and security headers including the CSP (arch §11); `vite.config.ts` applies the same headers to `vite preview` (SEC-02), and the smoke e2e asserts the CSP header is present.
- Husky + lint-staged pre-commit: lint-staged → typecheck → unit tests (POSIX sh, DEV-04). Verified once: a staged failing test made the hook exit 1 and no commit was created.
- `.gitignore`, `.gitattributes` (`eol=lf`, DEV-02), `CLAUDE.md`, `README.md`, `LICENSE` (MIT), `.github/workflows/ci.yml` (lint, typecheck, format check, unit with coverage and 1,000 property runs, a second time-zone job, build, Playwright with browser cache, report upload on failure).
- Placeholder page "Note-Add — Coming soon · Made by Spearman" in plain CSS, no external fonts.

**Tests:** unit 3 passed; e2e 3 passed (smoke × 3 projects).

**Exit criteria**
- CI green on `main`: ⚠️ **not possible in this run** (pushing is forbidden). Every CI step was run locally instead and passes (lint, typecheck, format check, unit tests, build, all e2e projects). → manual test M0.1.
- Placeholder live on Vercel with the CSP header: ⚠️ **not possible in this run** (deploying is forbidden). The CSP header is checked by the e2e smoke test against `vite preview` with the production headers. → manual test M0.2.
- Plan tasks P0.1 (GitHub repo part) and P0.16 (Vercel) are left unticked for the same reason.

---

## Phase 1 — Calculation engine

**Built** (`src/engine/`, pure, 100% coverage)
- `types.ts`: branded `Paise`, `MAX_PAISE`/`MIN_PAISE` (±99,999,999,999), `asPaise`, `addPaise`, `isWithinLimit` (all assert safe integers; −0 normalised to 0).
- `money.ts`: `parseAmount` (string-only; invisible-character removal, Devanagari and full-width digits, Unicode minus and en dash, `₹`/`Rs`/`Rs.`/`INR` prefixes, `/-` suffix, `+`/`-`/brackets in any order but never sign + brackets, strict Indian/Western comma grouping, ≤ 2 decimals, digit-string length check before any conversion); `formatPaise` (string-built Indian grouping, brackets or minus style); `spokenPaise` for screen readers; `REJECT_MESSAGES`.
- `page.ts`: `LINES_PER_PAGE`, `pageSum`, `pageTotal`, `isFlagged`, `countFlagged`, `isPageEmpty`, `emptyLines`, `defaultTitle`, `displayTitle`.
- `chain.ts`: generic `recalculateChain` (BF/total, `totalUpdatedOn` for Final pages, over-limit error naming the first page, `changedIds` only for changed cached values), `renumber`, `chainErrorMessage`.
- `dates.ts`: injected `Clock`, `todayIso`, `isoFromDate`, `toDisplay`, `fromDisplay` (strict DD/MM/YYYY, 1900–2099, leap years), `toFileDate`, `isValidIso`, `epochToDisplay`.
- `search.ts`: `normalise` (Latin diacritics removed, Hindi untouched), literal `textMatches`, `pageMatches` (title or default "Page N", descriptions), `search` (grouped by notebook, highest page number first).
- `contrast.ts`: WCAG `contrastRatio`.
- `src/engine/README.md`; `tests/builders.ts` (`aLine`, `linesOf`, `aPage`, `aChain`).

**Tests:** 224 unit tests pass (engine 223 + placeholder 1), including the full parse table (every MON-* and PST-* row in the plan), formatting at every grouping boundary plus an `Intl en-IN` cross-check on 1,000 values, chains of 50/200/1,000 pages, and 8 property suites against independent BigInt references (MON-32, FMT-04, TOT-07, RND-03, RND-04, RND-05, CHN-19, CHN-03/TOT-04). Property suites also passed once at **10,000 runs**; engine suites pass under `America/Los_Angeles` and `Pacific/Kiritimati`.

**Exit criteria**
- ✅ Full engine suite passes, including every spec §5 edge case and the spec §10 cases (50+ page chains, negatives, edits to page 1, ±₹99.99 crore). (Locally; CI not available.)
- ✅ 100% engine coverage (lines, branches, functions, statements), enforced by the Vitest threshold.
- ✅ Lint guards confirm the engine imports nothing outside itself.

---

## Phase 2 — Page editor and storage

**Built**
- `src/db/`: Dexie schema version 1 exactly as arch §4.2, single `db`, `resetDb()`, `versionchange` → close + "Note-Add was updated — reload" banner (MTB-04); injected clock (`setClock`, `now`, `today`) read on every call (DAT-03); `newId()` with a fallback when `crypto.randomUUID` is unavailable (STO-08).
- `mutatePages` (arch §6.1): one `rw` transaction; load → change → renumber → `recalculateChain` → abort on error (a `Refusal` or chain error writes nothing) → write only changed pages → bump `notebook.updatedAt` → append activity (trimmed to 200).
- Operations: `createNotebook` (with page 1), `updateLines`/`updateLine` (per-line writes), `updatePageHeader` (date validated, title trimmed/capped at 60, cleared → null), `appendPage` (always at the end); Final pages refuse line and header edits at the repository (LIF-14). Defensive reads: `normalisePage` pads to 10 lines without dropping content; `verifyNotebook` re-runs the chain and corrects stale totals, logging in development (CHN-09/10).
- Editor (`src/features/editor/`): `EditorSession` (plain class, subscribed with `useSyncExternalStore`) holds local text, the last valid value per line, 400 ms debounced autosave of only dirty lines, flush on blur / route change / `visibilitychange` / `pagehide`, "Saving…"/"Saved", error banner with Retry (SAV-04) or the chain message naming the page (SAV-05), and per-line conflict handling with "This page was changed in another window" (MTB-02, SAV-07).
- `PageEditor`: header (notebook name, "Page N of M" with previous/next links, DD/MM/YYYY text date field with a picker button, title with "Page N" placeholder), read-only brought-forward row, 10 lines, live total row; amounts right-aligned with tabular figures; formatted on blur, raw on focus; subtle flag with the label "Not a number, counted as zero"; rejected messages under the field; screen-reader text "minus … rupees"; throttled `aria-live` total; "Page N started, brought forward …" announcement.
- Keyboard model by focus index; Enter on line 10 flushes, appends, opens and focuses line 1, or goes to the existing next page; empty page shows "Add a line before starting a new page"; in-flight guard; IME composition ignored; **New page** button.
- Phone **editing bar** (± and Next ↵) above the on-screen keyboard via `visualViewport`.
- `navigator.storage.persist()` requested once after the first save (`platform/storage.ts`); `BroadcastChannel('note-add')` listener that reloads on a restore message (`platform/broadcast.ts`); full-screen "This browser can't store notes…" when IndexedDB is missing (STO-01).
- Routes: `/` temporary start screen (opens the latest notebook or creates "My notebook"), `/n/:notebookId/p/:pageNumber`; malformed or missing page numbers redirect to the last page with a notice; missing notebooks redirect home.

**Tests:** 291 unit tests (22 repository, 24 `EditorSession`, 20 editor component, 2 app boot, engine as before). E2E: 23 passed + 4 skipped (the two chromium-only two-tab tests on the phone projects): `editor.spec.ts` (6 tests × 3 projects), `two-tabs.spec.ts` (2, chromium), `smoke.spec.ts` (× 3).

**Exit criteria**
- ✅ A user can fill three pages by keyboard alone: `editor.spec.ts` passes on chromium-desktop (Enter), pixel-7 (Enter) and iphone-14 WebKit (the editing bar's Next on amounts). Real-device checks → manual tests M2.1–M2.2.
- ✅ Data survives a reload (same test reloads and checks descriptions, amounts and totals).
- ✅ Editing page 1 updates pages 2 and 3 immediately without a reload (`editor.spec.ts`, `two-tabs.spec.ts`).

---

## Phase 3 — Library, pages list and page lifecycle

**Built**
- Repository: `renameNotebook` (activity keeps the old name, ACT-03), `recolourNotebook` (page overrides kept, EDT-18), `deleteNotebook` (pages and notebook in one transaction; a second explicit confirmation when any page is Final, NB-07; clears `lastOpenedNotebookId`), `notebookSummaries` (page count, Final count, latest total). `mutatePages` now passes the notebook to the change so activity text is pre-rendered ("Page 3 of Pune trip claims marked Final, 20/11/2026").
- Lifecycle through `mutatePages`: `finalisePage` (**refused while any amount is invalid**, LIF-18), `reopenPage` (every reopen date kept), `deleteDraftPage` (refuses Final pages and the only page; renumbers; recalculates; refused if a later total would go over the limit). Finalising and reopening clear "Total updated…" (CHN-08). `repoErrorMessage` gives user-facing text for every repository error.
- Settings repository (`getSettings`, `updateSettings`, `newPageTarget` with the NB-06 fallback); `lastOpenedNotebookId` set when a notebook or page is opened.
- UI components (`src/ui/`): `Dialog` and `ConfirmDialog` on native `<dialog>` (focus returns to the trigger, Escape closes), `ColourPicker` (7 swatches, 44 px), `StatusBadge` (text, never colour alone), `NotebookStack` (thick border + offset shadow), `AddBookTile` (thin border, no shadow, `+`), `BottomNav` (Notebooks · New page · Settings). `src/theme/colours.ts` created early as the single colour source.
- Library (`/`): search box (results grouped by notebook, page results open the editor, Final badge, empty state saying what is searched), notebook stacks, "Add a new book" dialog (name + colour) that lands on page 1, recent activity (last 5; links only while the notebook exists).
- Pages list (`/n/:id`): back link, name and colour, + New page, Rename, Colour, Delete notebook; Draft cards newest first (badge, date, title, first two lines, total) in batches of 50; empty Drafts state; dotted "Add a new page" card; collapsed Archive of Final pages (opened automatically when every page is Final); Export PDF/JPEG buttons present but disabled ("Coming soon").
- Editor: back link to the notebook; Mark as Final (confirmation; flushes first; disabled with "N amounts are not numbers…" while any amount is invalid); read-only Final page with Reopen; "Final since…", "Reopened on…", "Total updated from earlier page on…" notes; Delete page (confirmation; refused for the only page with a reason). Settings route is a stub until phase 4.

**Tests:** 321 unit tests (+30: 20 lifecycle/notebook/settings repository tests, 10 component tests for dialogs, Final/Reopen/Delete UI, library and pages list). E2E: 55 passed + 8 skipped (chromium-only specs on the phone projects): `notebooks`, `search`, `final-reopen`, `final-recalc`, `delete-draft`, `navigation` on all three projects; `activity`, `totals-consistency`, `two-tabs` on chromium-desktop; editor and smoke as before.

**Exit criteria**
- ✅ End-to-end tests for each flow pass (locally on all three projects; CI not available in this run).

---

## Phase 4 — Look, colours, fonts and settings

**Built**
- `theme/colours.ts`: the seven slips (paper + ruled) and the two inks, used by CSS, the colour pickers and (next phase) the exports. Contrast test: all 14 slip × ink pairs ≥ 4.5:1 (lowest lavender 8.96 / 6.65, as arch §5.7).
- Fonts bundled from Fontsource (no network): Carlito, Atkinson Hyperlegible, Caladea, Merriweather (400 + 700) and Work Sans (400/500/600) as WOFF2 with per-subset `unicode-range`, `font-display: swap`; Noto Sans Devanagari added for the phase 5 PDF fallback. OFL licence for each family in `public/fonts/LICENSES/`, linked from Settings.
- Glyph check with fontkit (LOOK-03): all slip fonts have digits, brackets, comma and full stop; `₹` is missing from Atkinson Hyperlegible and Caladea (falls back) — noted in the README.
- `theme/fonts.ts` registry (label, family, fallback stack, preload URL); `applySlipFont` sets `--slip-font` and preloads only Work Sans and the selected slip font. Applied at boot after reading settings and before the router renders (no flash of the wrong font), and live when the setting changes.
- `ui/Slip` (paper colour, rule colour, soft shadow, slip font; ruled background on decorative slips) used by the editor, page cards and the font preview. Notebook stack (thick border, offset second slip, shadow) vs "Add a new book" (thin border, no shadow, `+`).
- Per-page colour override: colour dot in the editor header opens a picker with "Use notebook colour".
- Chrome in Work Sans on an off-white background; 44 × 44 px targets; visible focus rings; `color-scheme: light`; forced-colours borders on rows (LOOK-06); tighter padding at ≤ 360 px so the widest amount fits at 320 px.
- Settings: font picker (four choices, each shown in its own font, with a live preview slip; the choice is optimistic so the radio follows the tap at once), backup placeholder, About and privacy (version from `package.json`, "Made by Spearman" link opening outside the app, the spec §7 privacy statement, font licences).

**Tests:** 338 unit tests (+17 colour/contrast). E2E: 67 passed + 38 skipped: `settings-font` (each font applies and persists after reload, font file actually loaded; About section) on all projects; `touch-targets` on pixel-7 and iphone-14 (every button, link, input and summary on every screen and in the new-notebook dialog ≥ 44 × 44); `layout-small` on chromium (320 px widest amounts in Atkinson, 200% text, dark mode, Hindi/emoji/Arabic descriptions). `visual.spec.ts` (7 colour baselines) runs only on CI Linux (DEV-03) and was skipped here.

**Exit criteria**
- ✅ Contrast test passes for all colours (14/14).
- ✅ Font choice persists across reloads (all three projects).

---

## Phase 5 — Export (JPEG, PDF, share)

**Built** (`src/features/export/`, `src/platform/share.ts`)
- `layout.ts`: one set of layout constants (1080 × 1350 logical px, margins, row pitch, column widths, font sizes) for both renderers; PDF page 108 × 135 mm; shared `fitText` (ellipsis) and `wrapNotes` (notes on up to two lines).
- `model.ts`: pure `buildSlipModel` using the engine formatters (same strings as the screen): notebook, title ("Page N" default), DD/MM/YYYY date, "Page 3 of 7", **Draft/Final label** (EXP-04), notes "Final since…", "Reopened on…", "Total updated from earlier page on…" (EXP-05), brought forward, 10 lines with flags, total, effective page colour, chosen font, footer "Made with Note-Add · spearman.in". `exportFileName`: `<notebook>-<page title>-<DD-MM-YYYY>.pdf|.jpg`, unsafe characters → "-", fallback name, trailing dots/spaces trimmed, reserved Windows names guarded, ≤ 100 characters.
- **JPEG**: Canvas 2D renderer after `document.fonts.load` of the slip font and Work Sans; ruled lines, header, BF row, 10 lines with ellipsis, total, footer; `toBlob('image/jpeg', 0.92)`. Non-Latin scripts use the browser's fallback fonts.
- **PDF (decided 22/11/2026)**: pdf-lib draws **real, selectable vector text** from the same model and constants. The slip font (regular + bold), Work Sans and Noto Sans Devanagari are **embedded as subsets** from the bundled WOFF files (fetched from the app's own origin). Every character goes to the first font in a fallback chain that has it; characters no bundled font covers (emoji) become `?` in the PDF only (EXP-12). Saved without object streams for wide viewer compatibility.
- `shareOrDownload`: `canShare({files})` → `navigator.share`; `AbortError` → silent; `NotAllowedError` → "Your file is ready" with a second-tap **Share** button (`shareAgain`, which downloads if refused again); no share or unsupported type → `<a download>`.
- `ExportControls` (Export PDF / Export JPEG with "Preparing…") on every page card and in the editor; the editor flushes pending typing first (EXP-07, SAV-06). The export code, pdf-lib and fontkit are a lazy chunk loaded on first tap; if it cannot load (offline before it was ever fetched) the message is "Export needs one online visit first…" (EXP-08).

**Tests:** 362 unit tests (+24): `tests/unit/pdf.test.ts` builds real PDFs in Node from the bundled fonts and reads them back with pdfjs — **the extracted text equals the on-screen strings exactly, in reading order**, fonts are embedded (`/FontFile2`, `/BaseFont /Carlito-Regular-…`, no Helvetica/Times/Courier), each slip font embeds, Hindi uses the Devanagari fallback, emoji become `?`, long text gets an ellipsis, notes wrap, empty pages export; model, file-name and fitting tests; share logic with a mocked `navigator` (shared, cancelled, needs-tap → second tap, refused again → download, no share → download, unsupported type → download, other errors → download). E2E `export.spec.ts` (chromium, 6 tests): PDF download name, `%PDF`, **PDF text compared with strings read from the live page**, embedded fonts, no CSP violations; JPEG 1080 × 1350; Hindi/emoji/Arabic pixels drawn; page-card export; **emulated share menu** (file passed to `navigator.share`, NotAllowedError → "Your file is ready" → Share, AbortError silent); offline chunk message. 4 export baselines per font added to `visual.spec.ts` (CI Linux only).

**Exit criteria**
- ✅ Exports match the on-screen page on desktop: automated text equality for the PDF and pixel checks for the JPEG on chromium-desktop; the share-menu path is exercised in emulation.
- ⚠️ "On phone": real share sheets cannot be automated → manual tests M5.1–M5.5.

---

## Phase 6 — Backup, restore and reminder

**Built**
- `db/repo/backup.ts` (loaded lazily, so Zod stays out of the first load; Zod in jitless mode for the CSP, SEC-03): backup format v1 (`format`, `version`, `appVersion`, `exportedAt`, `summary`, `data`), `createBackupDocument` (one read transaction; safety backups excluded), `backupFileName` (`note-add-backup-<DD-MM-YYYY>.json`), `markBackedUp` (sets `lastBackupAt`, logs a `backup` entry — only when shared or downloaded, never on cancel).
- `inspectBackup`: 0-byte and 20 MB checks before reading; byte-order mark stripped; JSON, format and version checks (newer → "Update the app", 0/negative/non-integer → unsupported); `migrateBackup` chain (v1 step fills fields early files could miss); Zod validation — **money strict** (safe integers within the limit; decimals and strings refused), 10 lines, valid ISO dates, string length limits; duplicate IDs, missing notebooks, gaps in page numbers refused; **cosmetic forgiving** (unknown colours/fonts fall back, unknown fields dropped, unreadable activity entries left out — each with a note); **every chain recomputed and compared — any mismatch refuses the file** (money is never silently "fixed"). The summary is recomputed, never trusted.
- `restoreBackup`: **one transaction** that saves the current data as a safety backup (latest 3 kept), clears the tables, inserts the backup, sets `lastBackupAt` to the file's `exportedAt`, and logs a `restore` entry; any failure rolls everything back. `undoLastRestore` goes through the same pipeline (so old safety copies migrate too) and saves the current data first, so an undo can be undone.
- `db/repo/reminder.ts`: pure `shouldShowReminder` (data = a line with content; 30 days since the last backup or the first data; dismissed for 30 days; a clock moved backwards shows nothing).
- Settings › Backup and restore: "Last backup: DD/MM/YYYY" or "Never"; **Back up** (share menu or download, second-tap Share, disabled with "Nothing to back up yet" when empty); **Restore from a backup file** → summary dialog ("3 notebooks, 21 pages, last changed 03/11/2026"), "older than your current notes" warning, fallback notes, "replaces all your current notes; a safety copy is kept" → done message; **Undo last restore** and **Download this safety copy** while a safety backup exists. Other tabs are told to reload after a restore or undo.
- Library: the reminder banner with **Back up now** and **Not now**.
- Fixtures (`tests/fixtures/backups/`), generated by the app's own code with a fixed clock (`GENERATE_FIXTURES=1 npx vitest run tests/unit/generate-fixtures.test.ts`): `v1/valid-3-notebooks-21-pages.json` (3 notebooks, 21 pages, negatives, Final, reopened and "total updated" pages, colour overrides, Merriweather font) plus 16 bad files.
- **Bug fixed on the way:** a restore made its own tab reload (a BroadcastChannel reaches other listeners in the same tab), so the success message vanished. Messages now carry a per-tab id.

**Tests:** 407 unit tests (+45): `backup.repo.test.ts` (40) — v1 fixture summary and restore; **round trip: seed fixture → backup → wipe → restore → every notebook, page, activity entry and setting deep-equal** (`lastBackupAt` = `exportedAt`, plus one restore entry); each of the 12 bad fixtures gives its own message **and leaves current data untouched**; size, BOM, `__proto__`, cosmetic fallbacks, over-limit; forced mid-restore failure rolls back; **restore → undo → original data back exactly**; undo of undo; latest 3 safety copies; migration property test (OLD-04); old safety copy validated (OLD-13); reminder rules. `RestoreFlow.test.tsx` (5). E2E (chromium): `backup-restore.spec.ts` — **create data in the UI → back up (download) → brand-new browser profile → restore that file → notebook, colour, Final page, amounts, font all back → undo → empty again**; wrong file refused; tampered file refused; other tab reloads; backup through an emulated share menu (cancel ≠ backup); `old-backup.spec.ts` (committed v1 fixture through the UI); `reminder.spec.ts` (31 days, dismissal, banner backup, empty notebook, clock moved back).

**Exit criteria**
- ✅ Round-trip test (backup → wipe → restore) reproduces everything — repository and e2e.
- ✅ A mistaken restore can be undone — repository and e2e.

---

## Change of 23/11/2026 — English-only text for v1 (ADR 002)

Owner decision: version 1 is English only. One commit on `build/phases-0-6`: "English-only text for v1".

**Built**
- `src/engine/text.ts`: `filterSupportedText` (NFC, then keeps Basic Latin, Latin-1 Supplement, Latin Extended-A, `₹` and common punctuation; excludes the soft hyphen and `ŉ`), `isSupportedText`, `UNSUPPORTED_TEXT_MESSAGE` = "Only English text is supported for now". Engine coverage stays 100%.
- Descriptions (editor session), the page title field and the notebook name dialog remove other characters as they are typed or pasted and show the message under the field. The repository applies the same filter as a backstop (`updateLines`, `updatePageHeader`, `createNotebook`, `renameNotebook`). **Amount fields unchanged** (Devanagari and full-width digits still accepted).
- Export: **Noto Sans Devanagari and the `regenerator-runtime` workaround removed** (packages uninstalled, licence file and Settings link removed). PDF font chains are now *slip font latin → latin-ext → Work Sans latin → latin-ext*. Screen font stacks put bundled Work Sans before system fonts, so a letter a slip font lacks looks the same on screen and in exports.
- Restore: a notebook name, page title or description with unsupported characters **refuses the file** ("This backup contains text Note-Add can't show yet (line 5 of page 6 in “Pune trip claims”). Only English text is supported for now, so nothing was restored."). Activity entries with such text are left out with a note. Three new fixtures: `unsupported-text-description.json`, `unsupported-text-notebook-name.json`, `unsupported-text-title.json` (derived from the committed v1 file; the generator was updated to write them too).
- Docs: problem statement §1 and §5, architecture §4.1, §5.8 (new), §8.1–8.2, §9.2, §15, §16, edge cases (EDT-08, NB-04, SRC-07, EXP-03, EXP-12 rewritten; new §6.1 TXT-01–08), test plan, implementation plan, README, `docs/decisions/002-english-only-text-v1.md`.

**Tests replaced, not deleted**
| Old test | Replaced by |
|---|---|
| `search.test.ts` SRC-07 "Hindi text matches" | SRC-07 Latin Extended-A text matches in any case |
| `lifecycle.repo.test.ts` NB-04 "emoji allowed" | NB-04 with file-name-unsafe characters and Latin Extended-A; new TXT-02 test: emoji and Devanagari removed from names (create and rename) |
| `model.test.ts` NB-04 file name with emoji | the same check with accented Latin |
| `pdf.test.ts` EXP-12 "Hindi uses the Devanagari fallback; emoji become ?" | TXT-06 (× 4 fonts): accented Latin, `₹` and punctuation export exactly, no `?`, only the slip font and Work Sans embedded, no Noto; TXT-07: every allowed character has a glyph in every export font chain |
| `export.spec.ts` EXP-03 "Hindi, emoji and Arabic render in the JPEG" | TXT-06: mixed-script input is filtered in the fields with the message; the PDF text equals the field text with no `?`, no Noto font; the JPEG draws lines 1–3 |
| `layout-small.spec.ts` EDT-08 "Hindi, emoji and Arabic display and survive a reload" | TXT-01 / TXT-02: typed and pasted text in descriptions, the title and the notebook name dialog is filtered with the message; what remains survives a reload |

Also fixed a test race the full run exposed on WebKit: `settings-font.spec.ts` reloaded the page before the optimistic font choice was stored; it now waits until IndexedDB holds the new font (no assertion changed; passed 3× on every project).

New tests: `text.test.ts` (6), `EditorSession.test.ts` (4: removal + message, Latin kept, message clears and wins over "Cut to 120", Devanagari digits still work in amounts), `pages.repo.test.ts` (repository backstop), `backup.repo.test.ts` (3 refused fixtures, activity dropped with a note, Devanagari amount text still accepted), `RestoreFlow.test.tsx` (refusal message, no dialog).

**Results:** lint clean, type check clean, **429 unit/repository/component tests pass** (+1 opt-in fixture generator skipped; engine coverage 100%), **82 e2e tests pass** on chromium-desktop, pixel-7 and iphone-14 (80 skipped by design, as before). The build contains no Noto or Devanagari font files.

---

## Summary at the end of phase 6

All seven phases (0–6) are built and committed on `build/phases-0-6`. Final local gate: `npm run lint` clean, `npm run typecheck` clean, **407 unit/repository/component tests pass** (1 opt-in fixture generator skipped), **82 e2e tests pass** across chromium-desktop, pixel-7 and iphone-14 (80 skipped by design: CI-Linux-only visual baselines and specs the test plan runs on one project). Nothing was pushed or deployed. Phase 7 has not been started.

Open items carried forward: D37 (bundle budgets), D32 (LOOK-02 metric fallbacks), D33/M4.2 (visual baselines on CI), BAK-04 (1,000-page backup timing) and NB-08 (seeded 100+ notebooks / 1,000 pages e2e), which are still ➕ in edge-cases.md, plus the phase 7 items.

---

## Phase 7 — PWA, offline, accessibility and performance (branch `build/phase-7`)

Branch created from `build/phases-0-6`. Never pushed, never deployed. Steps are committed one at a time.

### Step 1 — Bundle budgets (D37) ✅

**Result:** initial JS **143.1 KB gzip** (budget 150) and export chunk **76.6 KB gzip** (budget 250). Both budgets are met, not just approached. `npm run size` (`scripts/check-bundle.mjs`) enforces them and runs in CI after the build.

**How**
- **Export chunk 515 KB → 77 KB.** fontkit was half of it, and its shaping and Unicode data are not needed for English-only text. Replaced by `src/features/export/ttf.ts`: reads the bundled WOFF files, subsets each font to the characters a page uses while **keeping glyph IDs**, and exposes the small font object pdf-lib's non-subset embedder needs. pdf-lib's unused standard-font metrics (about 100 KB) and PNG codec are stubbed at build time (`src/features/export/stubs/`, aliases in `vite.config.ts`). `@pdf-lib/fontkit` is now a dev dependency, used only by tests.
- **Initial chunk 154.5 KB → 143.1 KB.** The editor, the pages list and Settings are route-split (`lazy` routes with a loading fallback); the library screen stays in the first chunk. Path helpers moved to `src/features/paths.ts` so screens can link without importing each other.
- Checked the result **visually**: sample PDFs (Carlito and Merriweather, with accents, `₹`, ellipsis, notes and the flag dot) rendered with pdf.js in Chromium look correct.

**Tests (all pass, none weakened):** the 11 existing PDF tests (real text extraction, fonts embedded, glyph coverage for every allowed character, no `?`) pass unchanged on the new engine. New `tests/unit/ttf.test.ts` (20 tests): WOFF read agrees with fontkit on metrics, cmap and widths for 7 font files; subsets have **identical glyph outlines and widths** (compared with fontkit, per font); composite (accented) glyph components are kept; table set and checksum adjustment are valid; unmapped characters become `.notdef`; CFF and non-fonts are rejected.

**A flaky test, found and fixed (not an app bug).** Route-splitting exposed a race: about 1 run in 40 on the iPhone (WebKit) project lost an amount typed straight after creating a page. Playwright's `fill()` focuses the amount field and then inserts text into whatever is focused; the app's documented behaviour (KBD-03) moves focus to line 1 of the new page right after navigation, so occasionally the text went into the description. Proven with a temporary trace of the save path (removed). The `newPageFromEditor` / `newPageFromNav` helpers now wait for that focus (which also strengthens the check of KBD-03). 360 runs (10 repeats × 5 specs × 3 projects): 0 failures. I also tightened the amount field's focus handler so it never overwrites text that already changed (it was not the cause; it is harmless and kept).

### Step 2 — PWA core: service worker, manifest, icons, update prompt, header rules ✅

**Built**
- **Service worker** (`vite-plugin-pwa` 2.0 + Workbox 7, `generateSW`, `registerType: 'prompt'`). Precache: **70 entries, 2.2 MB** — HTML, every JS chunk (the lazy export chunk and the route chunks included, so every screen and both exports work offline), CSS, icons, font licences, and **only the latin and latin-ext font subsets** as WOFF2 and WOFF (D30): 44 font files cached, 38 other-subset files deliberately not. `navigateFallback` serves `index.html` for deep links. Registered after the first paint from a lazily loaded **script file** (`injectRegister: false`), so the CSP needs no inline script; a failed or blocked registration is silent (PWA-10). Updates are looked for hourly and when the app returns to the foreground.
- **Update prompt** (`platform/pwa.ts`, `features/pwa/UpdatePrompt`): "New version available — Reload" toast; **never reloads by itself**. Tapping Reload (1) flushes every open editor's pending typing (PWA-03), (2) waits for an export, backup or restore in progress (PWA-04: those mark themselves busy), (3) saves again, (4) reloads. The toast shows "Saving your notes…", "Finishing what is running…", "Reloading…". First install shows a dismissible "Note-Add is ready to work offline."
- **Manifest and icons:** `id`, name, short name, standalone, `start_url` and `scope` from `VITE_BASE`, theme colour `#FFF4A3`, background `#FAFAF7`, 192, 512 and maskable-512 icons, `apple-touch-icon` (180), favicon (SVG and 32 px), iOS meta tags (`apple-mobile-web-app-capable`, title, status bar) and `mobile-web-app-capable`. All icons come from **one source SVG** (`scripts/icons/icon.svg`: a canary slip with writing lines and a plus) rendered by `npm run icons` with Playwright's Chromium (no native image library); the PNGs are committed. The maskable icon keeps everything inside the safe zone (checked by eye).
- **Headers (P7.6):** `vercel.json` gained `/workbox-*.js` (immutable) and `/manifest.webmanifest` (correct type, no-cache) next to the existing `/sw.js` (no-cache), `/assets/*` (immutable) and the security headers. `vite preview` now applies **every per-path rule** from `vercel.json` (before it applied only the global ones), so the e2e tests run under the real production headers.
- **Base path (PWA-09):** `npm run test:e2e:base` builds with `VITE_BASE=/note-add/` and tests that manifest scope/start_url/id, icons, `apple-touch-icon`, every loaded asset, the router, the service-worker scope and an offline deep link all follow the path. Runs in CI as its own job.
- **CI:** `npm run size` after the build, the base-path e2e job, and a Lighthouse job on `main`.

**Tests (all pass):** 467 unit tests (+18: update logic incl. PWA-03/04, the prompt component, `vercel.json` headers/CSP/rewrite rules). E2E **102 passed** (was 82) + 90 skipped by design, plus the base-path run (1 passed):
- `pwa.spec.ts` (chromium + pixel-7): manifest fields and every icon loads at its declared size; iPhone tags and the 180 px touch icon; a worker controls the page after first load; the **precache contains the app, the lazy chunks and only latin/latin-ext fonts**; the **update flow against a real waiting worker** (prompt appears, nothing reloads by itself, Reload saves un-blurred typing first and the value survives the reload); PWA-10 with the worker blocked.
- `offline.spec.ts` (chromium + pixel-7, ×3 repeats, 12/12): load once → network off → reload → **create a notebook, fill and total two pages, export JPEG and PDF, open Settings, back up (download), change the font, deep-link and reload — all offline**.
- `privacy.spec.ts` (all three projects): a full journey (create, edit, new page, both exports, search, settings, backup, bad restore) makes **no request to any other origin**, sets no cookies and uses no local or session storage.
- `csp.spec.ts` (chromium): no CSP violation, console CSP error, page error or failed request across a journey that includes worker registration, both exports and a Zod-validated restore.
- Playwright now **blocks service workers by default** and only these specs opt in, so the worker cannot cache or bypass `page.route` in the other 70 tests.

**Lighthouse (production build, mobile preset, 3 runs each, local):** accessibility **1.00** and best-practices **1.00** on both screens; performance **0.98** on the library (FCP 0.75 s, LCP 2.4 s simulated, TBT 0, CLS 0.05) but only **0.89–0.90 on Settings (CLS 0.12, LCP 3.3 s)**. All assertions passed, but Settings is on the edge: the cause is the font swap shifting the layout and the lazy-loaded chunk waterfall. **Fixed in step 5** (performance pass). Lighthouse has no PWA category any more; installability is covered by `pwa.spec.ts` and the manual device checks.

---

## Decisions to review

| # | Phase | Decision | Why |
|---|---|---|---|
| **D10** | **1** | **Money limit corrected to ±99,999,999,999 paise (₹99,99,99,999.99).** The docs disagreed: spec §5, every display string and the error message say ₹99.99 crore, but arch §5.1/plan P1.1 gave `MAX_PAISE = 9_999_999_999` (₹9.99 crore) and plan P1.2 expected `100000000.00` (₹10 crore) to be rejected. I followed the spec and corrected arch §5.1, plan P1.1–P1.3, edge-cases MON-27/28 and test-plan §4.1/§4.5. `100000000.00` is now accepted; `1000000000.00` (₹100 crore, one paisa over) is rejected. | The spec is the source of truth and the success criteria say ±₹99.99 crore. Still exact: the largest page sum (~1.1 × 10¹²) is far below 2⁵³. |
| D1 | 0 | The repository was initialised directly on `build/phases-0-6`; no `main` branch was created. | Instruction: never touch main. Create `main` when you push. |
| D2 | 0 | No GitHub repo, push, Vercel link or deploy. Phase 0 exit criteria are shown locally instead. | Instruction: never push or deploy. |
| D3 | 0 | Kept **Vite 6** (as arch §2 says) although Vite 8 is current; `@vitejs/plugin-react` 5 (latest major supporting Vite 6); `@testing-library/jest-dom` 6 (7+ needs Vitest 4); Vitest 3. | Follow the documented stack; upgrade later as one deliberate change. |
| D4 | 0 | One `tsconfig.json` and `tsc --noEmit` instead of project references with `tsc -b`. | Simpler; same strictness. `build` = typecheck + `vite build`. |
| D5 | 0 | `npm test` always runs with coverage, so the 100% engine gate applies in the hook as well as in CI. | The gate cannot be skipped by accident. |
| D6 | 0 | Scaffold files written by hand rather than `npm create vite` (which is interactive). | Same result, deterministic. |
| D7 | 0 | npm 11's install-script gate: approved only `esbuild` (needed by Vite), recorded in `package.json` `allowScripts`. | Minimum needed. |
| D8 | 0 | Prettier does not reformat `docs/` or `PROGRESS.md`. | Keep your documents byte-stable. |
| D9 | docs | MON-25: you named Devanagari digits; full-width digits keep the proposed default (also accepted). | The §18.1 default covered both. |
| D11 | 1 | `IsoDate` is a plain `string` alias, not branded (plan P1.1 said branded). Validation is by `isValidIso`/`fromDisplay`. | Branding dates adds casts in storage and backup code with little safety gain; `Paise` is the brand that matters. |
| D12 | 1 | Search removes only Latin combining accents (U+0300–036F), not all combining marks. | Removing all marks would strip Hindi vowel signs and create false matches (SRC-07). |
| D13 | 1 | `+-5`, `₹₹50`, `,100`, `100,`, `()` and `/-` alone are invalid; `450 /-` (space before the suffix) is accepted. | Consistent with "money fields are strict" while honouring the `/-` decision. |
| D14 | 1 | `recalculateChain` processes pages in the order given (the repository sorts by number); it does not sort. | Keeps the function simple and lets `renumber` define the order after deletes. |
| D15 | 2 | **Focusing an amount that shows a formatted value (`1,280.75`) selects the raw text (`1280.75`)**, so typing replaces it. A second tap places the caret as usual. | Swapping formatted → raw on focus otherwise loses the selection and appends text (found by e2e: `100` became `100-100`). Common behaviour for amount fields. |
| D16 | 2 | "Last valid value" (arch §5.2) means the last value that parsed while typing, not the last saved one: typing `450.50` then a third decimal keeps ₹450.50; a paste of `450.505` over `450` keeps ₹450.00. While an amount is focused and not a number (`-`, `.`, `(`), the total uses that last valid value and nothing is saved for that amount until the field is left (EDT-04). | Matches "the last valid value stays in the database and the total". |
| D17 | 2 | The editing bar shows while an amount is focused when an on-screen keyboard is detected (`visualViewport` shrinks) **or** the primary pointer is coarse (touch). | Lets the iPhone e2e test use it (emulation has no keyboard) and covers phones whose keyboard does not resize the visual viewport. A tablet with a physical keyboard may still show it (KBD-12 is a manual check). |
| D18 | 2 | Amount fields have no hard `maxLength`; text over 20 characters is kept and marked invalid with "Too long (20 characters at most)" (PST-12). Descriptions are cut at 120 with "Cut to 120 characters". Title uses `maxLength=60`. | PST-12 says never cut a pasted amount silently. |
| D19 | 2 | Shift+Enter does nothing (focus stays); Tab follows the natural order (KBD-08). | One reading of "does nothing special". |
| D20 | 2→3 | Activity entries are written for: notebook created, notebook renamed, page marked Final, page reopened, page deleted (backup and restore come in phase 6). **New pages are not logged** (corrected in phase 3; phase 2 said they were). | Logging every new page would push the lifecycle events the spec describes out of the 5-item Recent activity. |
| D23 | 3 | On a Final page the editor hides its own New page button (Enter on line 10 never creates a page, KBD-09); the bottom-nav **New page** still appends after a Final last page (LIF-17). | Keeps KBD-09 and LIF-17 both true. |
| D24 | 3 | Deleting a notebook writes no activity entry (there is no `notebook-deleted` kind in arch §4.1); earlier entries for it become plain text (ACT-04). | Follows the data model as written. |
| D25 | 3 | Recent activity links open the page if it still exists, otherwise the notebook. | Pages can be renumbered or deleted after the entry was written. |
| D26 | 3 | Creating a notebook from the library opens its page 1 straight away. | Arch §6.2: "so the user lands on a usable page"; fastest path to the 2-minute task. |
| D27 | 3 | The Archive `<details>` opens automatically when every page is Final (LIF-13 "Archive expanded hint"); otherwise it starts collapsed. | Spec: collapsed by default. |
| D28 | 3 | Mark as Final uses `aria-disabled` (not `disabled`) while blocked, so the reason stays reachable by keyboard and screen readers; clicking it does nothing. | Accessible disabled state with an explanation. |
| D29 | 3 | `src/theme/colours.ts` was created in phase 3 (plan: P4.1) because the colour picker needs the presets. | Single source from the start. |
| D30 | 4 | Fonts come from the Fontsource npm packages (not vendored copies); Vite fingerprints and bundles them. All subsets are emitted into `dist/` but browsers fetch only the subsets a page needs. Phase 7 should limit the service-worker precache to latin and latin-ext. | Fewer binary files in git; exact versions are pinned. |
| D31 | 4 | Editor ruled lines are per-row borders in the rule colour rather than one `repeating-linear-gradient`; the gradient is used on decorative slips (page cards, font preview). | Editor rows can grow when a message appears under a field, which would put a fixed gradient out of step. Borders also stay visible in forced colours (LOOK-06). |
| D32 | 4 | LOOK-02 is partly done: every slip font has a similar system fallback stack (Calibri, Verdana, Cambria, Georgia…), but no `size-adjust` metric overrides were added. Left ➕ in edge-cases.md. | Metric-matched fallbacks need per-font measurements; low value while fonts are bundled and preloaded. |
| D33 | 4 | Visual baselines (`visual.spec.ts`) run only when `CI` is set on Linux (DEV-03); none were created in this run. | Font rendering differs between Windows and Linux. → manual test M4.2. |
| D34 | 4 | The long three-page keyboard e2e is marked `test.slow()` (3× time limit). It passes in 11 s alone but went over 45 s on WebKit with four parallel workers. No assertion changed. | Timeout under load, not a defect. |
| D35 | 4 | P4.11 (minus-sign style) skipped: the §0.4 default "brackets only" stands. | Plan says skip unless decided yes. |
| **D36** | **5** | **PDF fonts are embedded from the WOFF files with `subset: true`.** WOFF2 subsetting crashes fontkit for several of the fonts, and non-subset embedding would put WOFF bytes into the PDF (invalid). The WOFF files are separate assets fetched only at export time. | Tested every font × format × subset combination. |
| **D37** | **5** | **Bundle budgets are exceeded (for phase 7 to fix):** initial JS is 152 KB gzip (budget 150 KB) and the lazy export chunk is 515 KB gzip (budget 250 KB) — fontkit brings its Unicode and shaping data. Options for phase 7: move the font registry's CSS imports out of the entry, trim React Router, or swap to a lighter subsetting path. | Not a phase 5 exit criterion; arch §14 makes it a phase 7 CI check. |
| D38 | 5 | ~~`regenerator-runtime` loaded in the export chunk for fontkit's Indic shaper.~~ **Superseded 23/11/2026 (D50): removed.** | v1 is English only. |
| D39 | 5 | ~~Hindi in the PDF drawn with a Devanagari fallback font, simplified shaping.~~ **Superseded 23/11/2026 (D50): no Devanagari font; other scripts cannot be entered.** | v1 is English only. |
| D40 | 5 | Header text (notebook name, title, date line, notes, footer) uses Work Sans and the lines/BF/total use the slip font, as on screen. Final pages also show "Final since DD/MM/YYYY" among the notes. | Matches the screen. |
| D41 | 5 | Three or more notes wrap onto two lines; anything still too long gets an ellipsis. | Found by test: three notes did not fit one line. |
| D42 | 5 | EXP-09 (canvas size limits on old iPhones) no longer applies: the PDF is vector, not a 2× raster; the JPEG canvas is 1.5 MP. Left ➕ for a manual check on an old iPhone. | Decision of 22/11/2026 removed the large PDF canvas. |
| **D50** | **23/11** | **English-only text for v1 (owner decision, ADR 002).** Allowed: Basic Latin, Latin-1 Supplement, Latin Extended-A, `₹`, and the punctuation – — ‘ ’ ‚ “ ” „ • … ′ ″ ‹ ›. I left out the soft hyphen U+00AD (invisible), `ŉ` U+0149 (deprecated; no bundled font draws it) and the Unicode hyphens U+2010/U+2011 (no bundled glyph), and did not add € or ™ ("common punctuation" read narrowly). | Every allowed character then has a glyph in every export font chain (tested, TXT-07). |
| D51 | 23/11 | The message shows on the edit that removed characters and clears on the next clean edit; when both apply, "Only English text…" wins over "Cut to 120 characters". Text that is only composed (letter + combining accent → `é`) shows no message. | Clear, low-noise feedback. |
| D52 | 23/11 | Restore refuses names, titles and descriptions with unsupported characters (strict); recent-activity entries are treated as cosmetic and dropped with a note; typed amount text keeps any characters (Devanagari digits are valid amounts). | As instructed for text fields; activity text is generated, not user data. |
| D53 | 23/11 | The repository also filters names, titles and descriptions, so no code path can store unsupported text. | Same rule as money: enforced below the UI. |
| **D54** | **7** | **D37 resolved: budgets met.** Initial JS 143 KB, export chunk 77 KB (see Phase 7 step 1). The export chunk got there by replacing fontkit with an in-house TrueType subsetter (`export/ttf.ts`) and stubbing pdf-lib's unused standard-font and PNG data. | Closest figure was not needed. Trade-off: no kerning or shaping in the PDF (fine for Latin text and amounts; the PDF is 100% consistent with ADR 002). |
| D55 | 7 | The first chunk now holds only the library screen; the editor, pages list and Settings are separate chunks fetched on first navigation (precached once the service worker is active). A cold start directly on an editor URL costs one extra request. | The only way to keep React + router + Dexie + app under 150 KB with room for the PWA code. |
| D56 | 7 | Sizes use zlib's default gzip level (what Vite reports), which is slightly larger than level 9, so the check is conservative. | Same figure as the build report. |
| D57 | 7 | PWA stack: `vite-plugin-pwa` 2.0 with Workbox 7 (`generateSW`), as arch §2 plans. Registration is deferred until after `load` and imported lazily so it stays out of the initial chunk; `virtual:pwa-register` only exists in production builds. | Keeps the first paint and the 150 KB budget clean. |
| D58 | 7 | Playwright **blocks service workers by default**; `pwa`, `offline`, `privacy`, `csp` and `base-path` specs opt in. | A worker would cache assets and bypass `page.route` (e.g. the EXP-08 test), making other tests order-dependent. |
| D59 | 7 | The update-prompt e2e installs a second worker script (`/sw.js?v=2`) rather than editing the served `sw.js`: Playwright cannot intercept worker-script fetches by default. It exercises the real prompt, flush and reload path against a real waiting worker; **whether a real deploy is noticed** (hourly or on foreground) is a manual check (M7.4). | Deterministic and honest about its limit. |
| D60 | 7 | `vite preview` applies the per-path header rules of `vercel.json` through a small plugin in `vite.config.ts` (it previously applied only the global ones). | e2e now sees the real cache headers for `/sw.js`, `/assets/*` and the manifest. |
| D61 | 7 | Update checks: hourly and when the app is brought back to the foreground after an hour. | Installed apps are not "navigated", so they would otherwise miss updates. |
| D62 | 7 | Icon design: a canary slip with ink writing lines and a plus badge; theme colour `#FFF4A3` (status bar), background `#FAFAF7`. Generated by a script from one SVG using Playwright's Chromium instead of `sharp`. | Matches "one source SVG" without a native dependency (npm 11 install-script gate). **Please look at the icons** (`public/icons/`) and tell me if you want a different design. |
| D63 | 7 | Lighthouse is run through `scripts/run-lhci.mjs` (sets `CHROME_PATH` from Playwright's Chromium) and `scripts/lhci-summary.mjs` prints the scores. The LHCI config also covers `/settings`. | LHCI's healthcheck ignores the config's `chromePath`. |
| D44 | 6 | The safety backup is written **inside the same transaction** as the replacement, so a failed restore also leaves no stray safety copy. | Simplest guarantee that a failure changes nothing. |
| D45 | 6 | Undo deletes the safety copy it used; the restore it runs saves the current data as a new one, so "Undo last restore" always means "go back one step". | RES-14 (undo is undoable) without ping-pong confusion. |
| D46 | 6 | A notebook with no pages, unreadable activity entries and an unknown `lastOpenedNotebookId` are handled as: refused / left out with a note / reset to none. Invalid dates and statuses are refused (strict). | Pages are needed for a usable notebook; activity and the last-opened pointer are cosmetic. |
| D47 | 6 | The fixtures were generated by this build's code (v1 format) rather than a released v1.0 app, which does not exist yet. Re-generate and commit them from the real v1.0 release before shipping, then never change them (OLD-01). | Plan P6.9 asks for a fixture "made by the real v1.0 app". |
| D48 | 6 | "Clear site data" in the e2e round trip is a brand-new browser profile (empty storage), not deleting IndexedDB in place. | Equivalent and deterministic; the open Dexie connection would otherwise block deletion. |
| D49 | 6 | String limits in backups: descriptions 120, titles and notebook names 60, typed amount text 1,000 characters (amount text may legitimately exceed 20, PST-12). | RES-10 needs limits; these follow the editor's rules. |
| D43 | 5 | In e2e the download tests remove `navigator.share` to emulate a desktop without Web Share (Chromium on Windows has it). The share path is tested separately with a scripted `navigator.share`. | Deterministic; both paths covered. |
| D21 | 2 | Previous/next page links were added to the editor header. | Needed to move between pages before the phase 3 pages list, and for "no browser back button" in installed mode (PWA-05). |
| D22 | 2 | A test-only shim in `tests/setup/dom.ts` drops `AbortSignal` from `Request` because jsdom's signal is rejected by Node's `Request` in React Router data routers. | Test environment only; no app code affected. |

---

## Manual tests for you

| # | Phase | Check |
|---|---|---|
| M0.1 | 0 | Create the GitHub repo `note-add`, add it as `origin`, create `main` from this branch when ready, push, and confirm CI is green (including the two time-zone jobs). |
| M0.2 | 0 | Link the repo in Vercel (framework Vite, output `dist/`); open the preview URL; DevTools → Network → document → Response headers shows `Content-Security-Policy`. Record the `*.vercel.app` address in the README. |
| M0.3 | 0 | (Optional) On your machine, `git commit` with a failing test is blocked by the hook. |
| M2.1 | 2 | Real Android phone (Chrome, Gboard and the maker's keyboard): fill three pages using only the keyboard's Next key; the minus key or ± enters a refund; Hindi input: confirming a word with Enter does not jump fields (test-plan §10.3 M1–M8, §10.4 K1–K5). |
| M2.2 | 2 | Real iPhone (Safari): the editing bar sits just above the decimal keypad, ± and Next ↵ work, the page does not jump or zoom when the keyboard opens, the focused line stays visible (EDT-15, EDT-16, K2). |
| M2.3 | 2 | Tablet with a physical keyboard: note whether the editing bar appears (see D17, KBD-12). |
| M3.1 | 3 | On a phone and desktop (test-plan §10.5 C1–C5): fill 5 pages, change page 1, pages 2–5 update; mark page 3 Final, edit page 1, see "Total updated from earlier page on…"; Reopen page 3; delete Draft page 2 of 5; a large refund on page 1 shows brackets everywhere. |
| M3.2 | 3 | Screen reader spot check of the dialogs (Mark as Final, Delete page, Delete notebook): focus moves in and returns to the button afterwards. |
| M4.1 | 4 | Phone and desktop (test-plan §10.6 L1–L4): all 7 colours and 4 fonts look right and amounts line up; phone in dark mode keeps paper-coloured slips; largest system text size clips nothing; Windows High Contrast still shows the rows. |
| M4.2 | 4 | After pushing, let CI (Linux) create the 7 slip baselines (`npx playwright test visual.spec.ts --update-snapshots` in CI or the Playwright Docker image), review the images and commit them. |
| M4.3 | 4 | Settings › About: the spearman.in link opens in the browser, not inside the installed app (PWA-06). |
| **M5.1** | **5** | **Android Chrome (browser and installed):** Export PDF → the share sheet opens → send to WhatsApp and to email → the PDF opens on the receiving device, text can be selected and searched, numbers match the screen (test-plan §10.7 E1). |
| **M5.2** | **5** | **Android Chrome:** Export JPEG → share to email → the attachment opens, 1080 × 1350, matches the screen (E2). |
| **M5.3** | **5** | **iPhone Safari, in Safari and installed to the home screen:** Export PDF and JPEG → the share sheet opens; if it does not open on the first tap, "Your file is ready" appears and its **Share** button opens the sheet (SHR-02, SHR-06). Cancelling the sheet shows no error (E5). |
| **M5.4** | **5** | **Desktop Edge/Chrome on Windows and Safari on Mac:** note whether the system share sheet appears (SHR-05, acceptable) or the file downloads; either way the file name is `<notebook>-<title>-<DD-MM-YYYY>`. Firefox downloads (SHR-04). |
| **M6.1** | **6** | **Backup through the share menu** (test-plan §10.8 B1): on Android save the backup to Google Drive, on iPhone to Files, on desktop it downloads. "Last backup" then shows today; cancelling the sheet leaves it unchanged. |
| M6.2 | 6 | B2–B4: clear the site data (or reinstall), restore that file → every notebook, page, colour and the font are back; restore a photo or a PDF → clear message, nothing changed; Undo last restore → previous data back. |
| M6.3 | 6 | B5–B6: back up on Android, restore on iPhone, totals identical; restore `tests/fixtures/backups/v1/valid-3-notebooks-21-pages.json` on each device. |
| M6.4 | 6 | With two tabs open, restore in one: the other reloads by itself and shows the restored notes. |
| **M7.1** | **7** | **Install on Android (Chrome):** open the deployed (or preview) HTTPS address → Chrome offers "Install app" (or ⋮ → Install app) → it appears in the app list with the yellow note icon → opens in its own window without the address bar. Also check the maskable icon looks right in the launcher's round/squircle shape. |
| **M7.2** | **7** | **Install on iPhone (Safari):** Share → Add to Home Screen → the icon and the name "Note-Add" → opens full screen. Remember iPhone keeps **separate storage** for the installed app (see the install hint, next step). |
| **M7.3** | **7** | **Install on desktop (Chrome/Edge):** the install icon in the address bar → standalone window. |
| **M7.4** | **7** | **Update after a deploy:** with the app installed, deploy a change (or a new preview), reopen the app → within about an hour or when you bring it back to the foreground "New version available — Reload" appears; type something without leaving the field, tap Reload → the page reloads and your typing is there. |
| **M7.5** | **7** | **Airplane mode:** open the installed app once online (wait for "ready to work offline"), then switch on airplane mode, close and reopen it → create a notebook, fill a page, change the font, export a JPEG and a PDF (they go to the share sheet), back up. On Android and iPhone. |
| **M5.5** | **5** | Side by side, the export and the on-screen page for each of the 4 fonts and two colours (E4), including a description with accented letters and `₹` (e.g. `Café ₹50 — Łódź`), and the oldest available iPhone (EXP-09). |
