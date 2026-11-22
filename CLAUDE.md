# CLAUDE.md — rules for working on Note-Add

Read `docs/architecture.md` before changing a module. The phase plan is `docs/implementation-plan.md`; corner cases (IDs used in test names) are in `docs/edge-cases.md`; how things are tested is in `docs/test-plan.md`. Progress and decisions to review are in `PROGRESS.md`.

## Rules (arch §13.1)

- **Money is integer paise only.** Never use `parseFloat`, `toFixed`, `Math.round` or floating-point arithmetic on amounts. All parsing and formatting goes through `src/engine/money.ts`.
- **`src/engine/` is pure:** no UI, DOM, React or Dexie imports. Every engine change has tests. Coverage for `src/engine/**` is 100% (lines, branches, functions, statements) and enforced.
- **All page writes go through `mutatePages`** (`src/db/repo/pages.ts`) so the carry-forward chain is always recalculated in the same transaction.
- **Dates:** DD/MM/YYYY in the UI, ISO `YYYY-MM-DD` (local calendar date) in storage. "Today" comes from an injected clock.
- **Indian digit grouping** (`1,00,000.00`); negatives in accounting brackets `(300.00)`.
- **No network:** no requests, third-party scripts, CDN fonts, analytics or cookies. The CSP in `vercel.json` is also applied to `vite preview`, so e2e runs under it.
- **Never commit unless lint, type check and all tests pass. Never skip hooks** (`--no-verify` is forbidden).
- **Never weaken or delete a test to make it pass.**
- One phase at a time; each phase ends with its exit criteria demonstrated.
- Test names start with the edge-case ID they cover, e.g. `it('MON-14: comma used as decimal separator is invalid')`.

## Commands

| Command             | What it does                                              |
| ------------------- | --------------------------------------------------------- |
| `npm run dev`       | Dev server                                                |
| `npm run build`     | Type check + production build to `dist/`                  |
| `npm run preview`   | Serve `dist/` with the production headers (CSP)           |
| `npm run lint`      | ESLint (type-aware, architecture and money guards)        |
| `npm run typecheck` | `tsc --noEmit`                                            |
| `npm test`          | Vitest unit/repository/component tests with coverage      |
| `npm run test:e2e`  | Playwright: chromium-desktop, pixel-7, iphone-14 (WebKit) |
| `npm run format`    | Prettier                                                  |

Environment variables for tests: `FC_RUNS` (fast-check runs, default 100), `TEST_TZ` (default `Asia/Kolkata`).

## Folder map

```
src/engine/    pure money, page, chain, dates, search, contrast (no imports from outside)
src/db/        Dexie schema, record types, repositories (imports engine only)
src/features/  screens: library, notebook, editor, settings, export, pwa
src/ui/        shared components (imports engine and theme only)
src/theme/     colours (single source), fonts, global CSS
src/platform/  share/download, storage persistence
tests/e2e/     Playwright specs, one per flow
tests/fixtures/ backups and other fixtures
```

Dependency direction: features → ui, db, engine, theme, platform; db → engine; ui → engine, theme; engine → nothing.
