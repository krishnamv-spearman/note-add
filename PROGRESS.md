# PROGRESS — Note-Add build (phases 0–6)

Branch: `build/phases-0-6` (never pushed, never deployed; no `main` branch exists locally).
Run started 22/11/2026. Owner decisions of 22/11/2026 applied to the docs first: see [docs/decisions/001-owner-decisions-22-11-2026.md](docs/decisions/001-owner-decisions-22-11-2026.md).

## Status

| Phase | Status | Unit tests | E2E tests |
|---|---|---|---|
| 0 Harness | ✅ done | 3 | 3 |
| 1 Engine | ✅ done | 224 | 3 |
| 2 Editor | not started | | |
| 3 Library | not started | | |
| 4 Look | not started | | |
| 5 Export | not started | | |
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

---

## Manual tests for you

| # | Phase | Check |
|---|---|---|
| M0.1 | 0 | Create the GitHub repo `note-add`, add it as `origin`, create `main` from this branch when ready, push, and confirm CI is green (including the two time-zone jobs). |
| M0.2 | 0 | Link the repo in Vercel (framework Vite, output `dist/`); open the preview URL; DevTools → Network → document → Response headers shows `Content-Security-Policy`. Record the `*.vercel.app` address in the README. |
| M0.3 | 0 | (Optional) On your machine, `git commit` with a failing test is blocked by the hook. |
