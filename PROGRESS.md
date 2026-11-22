# PROGRESS — Note-Add build (phases 0–6)

Branch: `build/phases-0-6` (never pushed, never deployed; no `main` branch exists locally).
Run started 22/11/2026. Owner decisions of 22/11/2026 applied to the docs first: see [docs/decisions/001-owner-decisions-22-11-2026.md](docs/decisions/001-owner-decisions-22-11-2026.md).

## Status

| Phase     | Status      | Commit        |
| --------- | ----------- | ------------- |
| 0 Harness | ✅ done     | see `git log` |
| 1 Engine  | not started |               |
| 2 Editor  | not started |               |
| 3 Library | not started |               |
| 4 Look    | not started |               |
| 5 Export  | not started |               |
| 6 Backup  | not started |               |

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
- Husky + lint-staged pre-commit: lint-staged → typecheck → unit tests (POSIX sh, DEV-04).
- `.gitignore`, `.gitattributes` (`eol=lf`, DEV-02), `CLAUDE.md`, `README.md`, `LICENSE` (MIT), `.github/workflows/ci.yml` (lint, typecheck, format check, unit with coverage and 1,000 property runs, a second time-zone job, build, Playwright with browser cache, report upload on failure).
- Placeholder page "Note-Add — Coming soon · Made by Spearman" in plain CSS, no external fonts.

**Tests:** unit 3 passed (2 files); e2e 3 passed (smoke × 3 projects).

**Exit criteria**

- CI green on `main`: ⚠️ **not possible in this run** (pushing is forbidden). Replaced by running every CI step locally: lint, typecheck, format check, unit tests, build and all e2e projects pass.
- Placeholder live on Vercel with the CSP header: ⚠️ **not possible in this run** (deploying is forbidden). The CSP header is verified by the e2e smoke test against `vite preview` with the production headers. → manual test M0.2.

---

## Decisions to review

| #   | Phase     | Decision                                                                                                                                                                                     | Why                                                                    |
| --- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| D1  | 0         | The repository was initialised directly on `build/phases-0-6`; no `main` branch was created.                                                                                                 | Instruction: never touch main. Create `main` when you push.            |
| D2  | 0         | No GitHub repo, push, Vercel link or deploy. Phase 0 exit criteria are shown locally instead.                                                                                                | Instruction: never push or deploy.                                     |
| D3  | 0         | Kept **Vite 6** (as arch §2 says) although Vite 8 is current; `@vitejs/plugin-react` 5 (the latest major supporting Vite 6); `@testing-library/jest-dom` 6 (7+ requires Vitest 4); Vitest 3. | Follow the documented stack; upgrade as one deliberate change later.   |
| D4  | 0         | One `tsconfig.json` and `tsc --noEmit` instead of project references with `tsc -b`.                                                                                                          | Simpler; same strictness. Scripts: `build` = typecheck + `vite build`. |
| D5  | 0         | `npm test` always runs with coverage, so the 100% engine gate applies in the hook as well as in CI.                                                                                          | Gate cannot be skipped by accident.                                    |
| D6  | 0         | Scaffold files written by hand rather than `npm create vite` (which is interactive).                                                                                                         | Same result, deterministic.                                            |
| D7  | 0         | npm 11's install-script gate: approved only `esbuild` (needed by Vite), recorded in `package.json` `allowScripts`.                                                                           | Minimum needed.                                                        |
| D8  | 0         | Prettier does not reformat `docs/`.                                                                                                                                                          | Keep the owner's documents byte-stable.                                |
| D9  | decisions | MON-25: you named Devanagari digits; full-width digits keep the proposed default (also accepted).                                                                                            | §18.1 default covered both.                                            |

---

## Manual tests for you

| #    | Phase | Check                                                                                                                                                                                                              |
| ---- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M0.1 | 0     | Create the GitHub repo `note-add`, add it as `origin`, create `main` from this branch when ready, push, and confirm CI is green.                                                                                   |
| M0.2 | 0     | Link the repo in Vercel (framework Vite, output `dist/`); open the preview URL; DevTools → Network → document → Response headers shows `Content-Security-Policy`. Record the `*.vercel.app` address in the README. |
| M0.3 | 0     | (Optional) Confirm the pre-commit hook runs on your machine: `git commit` with a failing test is blocked. (Checked once in this run: a staged failing test made the hook exit 1 and no commit was created.)        |
