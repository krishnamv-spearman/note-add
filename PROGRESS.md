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
| 6 Backup | not started | | |

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
| D38 | 5 | `regenerator-runtime` is loaded in the export chunk because fontkit's Indic shaper (Hindi text in PDFs) expects a global `regeneratorRuntime`; without it a Hindi description crashed the PDF export. | Found by the EXP-12 unit test. |
| D39 | 5 | pdf-lib does not shape complex scripts fully: Hindi in the PDF is drawn with the Devanagari fallback font but conjuncts and vowel-sign positions may be simplified (the text stays selectable). The JPEG uses the browser's shaping. | Documented in arch §8.2. |
| D40 | 5 | Header text (notebook name, title, date line, notes, footer) uses Work Sans and the lines/BF/total use the slip font, as on screen. Final pages also show "Final since DD/MM/YYYY" among the notes. | Matches the screen. |
| D41 | 5 | Three or more notes wrap onto two lines; anything still too long gets an ellipsis. | Found by test: three notes did not fit one line. |
| D42 | 5 | EXP-09 (canvas size limits on old iPhones) no longer applies: the PDF is vector, not a 2× raster; the JPEG canvas is 1.5 MP. Left ➕ for a manual check on an old iPhone. | Decision of 22/11/2026 removed the large PDF canvas. |
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
| **M5.5** | **5** | Side by side, the export and the on-screen page for each of the 4 fonts and two colours (E4). Also a page with a Hindi description in the PDF (D39) and the oldest available iPhone (EXP-09). |
