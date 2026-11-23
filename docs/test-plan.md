# Test Plan: Note-Add

Date: 22 November 2026 · Owner: Spearman · Status: draft for review before phase 0
Inputs: [problem-statement.md](problem-statement.md) ("spec"), [architecture.md](architecture.md) ("arch"), [implementation-plan.md](implementation-plan.md) ("plan"), [edge-cases.md](edge-cases.md) (case IDs like `MON-14`).

This document says what is tested, at which level, with which tools, when it runs, and what a person must check by hand on real devices. The edge-case catalogue says *what* can go wrong. This plan says *how* each case is caught.

**No eval suite.** Note-Add contains no AI or model calls, so there is no eval file. Every behaviour is deterministic and covered by ordinary tests.

---

## 1. Goals

In order of importance:

1. **No total is ever wrong by a paisa** (spec §10). Money parsing, formatting and the carry-forward chain get the deepest testing: example tables, property tests against an independent reference, and 100% coverage.
2. **No data is ever lost silently**: autosave, several tabs, restore, old backups, browser storage quirks.
3. **The main flows work on the phones people actually use**: Android Chrome and iPhone Safari, installed and not installed, online and offline.
4. **Nothing leaves the device**: no third-party requests, enforced by a test.
5. **Accessible and fast**: contrast, touch targets, screen readers, load time.

---

## 2. Test levels and where they run

| Level | Tool | Scope | Pre-commit hook | CI (every push) | CI (`main` only) |
|---|---|---|---|---|---|
| Unit | Vitest | `src/engine/**`, pure helpers in features | ✅ | ✅ | ✅ |
| Property | Vitest + fast-check | Engine money and chain | ✅ (100 runs) | ✅ (1,000 runs) | ✅ (10,000 runs, nightly-style) |
| Repository | Vitest + fake-indexeddb | `src/db/**` | ✅ | ✅ | ✅ |
| Component | Vitest + Testing Library (jsdom) | Editor, dialogs, settings | ✅ | ✅ | ✅ |
| End-to-end | Playwright: `chromium-desktop`, `pixel-7`, `iphone-14` (WebKit) | Full user flows on the built app, under the real CSP | — | ✅ | ✅ |
| Visual | Playwright screenshots | Slip styling and exports | — | ✅ (Linux only) | ✅ |
| Accessibility | `@axe-core/playwright` | Every screen | — | ✅ | ✅ |
| Performance | size-limit, Lighthouse CI | Bundle budget, load metrics | — | size-limit | ✅ Lighthouse |
| Manual | Real devices | Keyboards, share sheets, install, airplane mode, screen readers | — | — | Before each phase exit and release (§11) |

The pre-commit hook runs only fast suites (under about 30 seconds) so it is never tempting to skip. CI runs everything.

---

## 3. Conventions

- **Edge-case IDs in test names.** `it('MON-14: comma used as decimal separator is invalid', …)`. A search for an ID finds its test; a PR that adds a test marks the ID ✅ in edge-cases.md.
- **Bug → test first.** Every bug report gets a failing test (with a new edge-case ID if none fits) before the fix.
- **Injected clock.** Code that needs "today" or "now" takes a clock. Tests never depend on the real date. Playwright uses `page.clock` for reminder and date tests.
- **Fixed time zones.** Unit tests run under `TZ=Asia/Kolkata`; a second CI job runs the date suites under `TZ=America/Los_Angeles` and `TZ=Pacific/Kiritimati` (UTC+14) to catch local-vs-UTC mistakes. Set through the Vitest config, not by changing `process.env.TZ` mid-run.
- **Builders, not hand-written records.** `tests/builders.ts` has `aNotebook()`, `aPage({ amounts: ['450', '-300'] })`, `aChain(50)` so tests state only what matters.
- **No network.** Unit and component tests fail if `fetch` or `XMLHttpRequest` is called. E2E records requests (§7.6).
- **Determinism.** No `Math.random()` in tests except through fast-check, which prints its seed on failure; failing seeds are added as permanent example cases.

---

## 4. Unit tests: the calculation engine (phase 1)

Coverage gate: **100% lines and branches** for `src/engine/**`; CI fails below it.

### 4.1 `money.test.ts`: parsing

Table-driven: one row per input, expected result and edge-case ID. Must include every row of edge-cases.md §1 (`MON-*`) and §1.1 (`PST-*`). Groups:

| Group | Examples | IDs |
|---|---|---|
| Plain values | `450`, `450.5`, `1280.75`, `.5`, `450.`, `007.50` | MON-02–09 |
| Zero | `0`, `0.00`, `-0`, `-0.00` (never negative zero) | MON-10 |
| Negatives | `-300`, `(300.00)`, `−300` (U+2212), `–300`, `+300`, `-(300)` invalid | MON-11–13, 20–22 |
| Grouping | `1,00,000`, `100,000`, `12,34,567.89`; `450,50`, `1,0,0`, `1 280` invalid | MON-14–16, 19 |
| Prefixes | `₹`, `Rs.`, `rs`, `INR`; `₹` alone invalid | MON-17–18 |
| Non-ASCII digits (accepted, decided 22/11/2026) | `४५०`, `４５０` | MON-25 |
| Not numbers | `abc`, `12a`, `1.2.3`, `1e5`, `0x10`, `Infinity`, `NaN`, `1.5L`, `5k` | MON-23–24, 26 |
| Decimals | `450.505`, `450.500`, `10.005` rejected (never rounded) | MON-05–06, RND-01 |
| Limits | `99,99,99,999.99` ok; `1000000000.00` (one paisa over) rejected; same for negatives; 30-digit paste | MON-27–30 |
| Paste junk | NBSP, thin space, zero-width space, LRM, BOM, trailing tab/newline | PST-01–03 |
| Pasted formats | `(₹1,280.75)`, `-₹300`, `Rs.-300`, `450/-`; `450 only`, `1,280.75 Dr`, `1.234,56` invalid; `1,234.567` rejected | PST-04–11 |
| Float traps | `0.29`, `1.15`, `4.35`, `8.20`, `19.99` → exact paise | RND-02 |

### 4.2 `money.test.ts`: formatting

Every Indian grouping boundary (999.99 → 1,000.00 → 99,999.99 → 1,00,000.00 → 9,99,999.99 → 10,00,000.00 → 1,00,00,000.00 → 99,99,99,999.99), 0, ±1 paisa, both styles, plus one cross-check against `Intl.NumberFormat('en-IN')` for 1,000 random values. IDs FMT-01 to FMT-05.

### 4.3 `page.test.ts`

`pageSum` and `pageTotal`: all empty (TOT-01), mixed valid/empty/invalid (TOT-02), page total over the limit from 10 large amounts (TOT-04), exactly at the limit (TOT-05), negative limit (TOT-06). `isFlagged`: text present and unparseable → true; empty → false.

### 4.4 `chain.test.ts`

| Case | IDs |
|---|---|
| One page; page 1 BF is 0 | CHN-01 |
| 50, 200 and 1,000 pages; edit page 1, check every page | CHN-02 |
| Edit on page 1 pushes page 40 over the limit → error names page 40, nothing changed | CHN-03 |
| Final page BF change sets `totalUpdatedOn`; unchanged Final page keeps it | CHN-04, CHN-05 |
| Description edit and same-value amount edit change no other page | CHN-06, CHN-07 |
| Sign flip, valid → invalid, total exactly 0 | CHN-12, CHN-13, CHN-18 |
| Mixed Draft/Final pages after page 1 edit | CHN-16 |
| Edit then delete; renumbering keeps lines with their pages | CHN-17, LIF-06, LIF-07 |
| Delete that pushes a later total over the limit → refused | LIF-08 |

### 4.5 Property tests (fast-check)

These compare the engine with an **independent reference** written separately in the test file: a plain loop using `BigInt`, with no shared code. A bug would have to appear identically in both to slip through.

| Property | Generator | IDs |
|---|---|---|
| `parseAmount(formatPaise(x)) === x`, both styles | any integer in ±99,999,999,999 | MON-32 |
| `pageSum` equals BigInt sum | 10 random amounts, some null | TOT-07 |
| Sum of displayed line amounts (parsed back) + BF equals displayed total | random page | RND-04 |
| Page N BF string equals page N−1 total string | random notebook, 1–300 pages | RND-05 |
| `recalculateChain` equals the reference after any sequence of edits, appends and deletes | random notebook + random operation list | CHN-19 |
| Any operation that would put a total out of range is reported and changes nothing | random near-limit amounts | CHN-03, TOT-04 |
| Formatting never contains `-` in brackets style, never `(` in minus style | any integer | FMT-04 |

### 4.6 Other engine suites

- `dates.test.ts`: display ↔ ISO round trips, invalid dates (`31/02/2026`, `29/02/2027`, `29/02/2100`), leap years (`29/02/2028`), the 1900–2099 range, midnight near a day boundary in each test time zone. IDs DAT-01–04, EDT-10–12.
- `search.test.ts`: names, titles, default "Page N" titles, descriptions, accents, Latin Extended-A, regex characters taken literally. IDs SRC-02–07.
- `text.test.ts` (decided 23/11/2026): English-only rule — Latin, accents, `₹` and punctuation kept; Devanagari, Arabic, emoji, CJK removed; invisible marks removed; combining accents composed; code point boundaries. IDs TXT-01–04.
- `contrast.test.ts`: WCAG reference pairs (black on white = 21:1); then, in phase 4, all 7 slips × 2 inks ≥ 4.5:1 (LOOK-01).

---

## 5. Repository tests (fake-indexeddb)

Each test starts with a fresh database (`resetDb()`).

| Suite | Key cases | IDs | Phase |
|---|---|---|---|
| `pages.repo.test.ts` | `mutatePages` writes only changed pages; a chain error writes nothing; editing page 1 of 50 updates all in one transaction; defensive reads pad bad pages and fix stale totals | CHN-02, 03, 09, 10 | 2 |
| `lifecycle.repo.test.ts` | Finalise, reopen history, re-finalise; Final pages refuse line/header edits and deletion; deleting the only page refused; renumbering and default titles | LIF-02–11, 14 | 3 |
| `notebooks.repo.test.ts` | Validation, duplicate names, delete rules, fallback for "New page" target | NB-01–07 | 3 |
| `activity.repo.test.ts` | Entries in the same transaction as the change; line edits create none; trimmed to 200 | ACT-02, 03, 05 | 3 |
| `backup.repo.test.ts` | **Round trip**: seed the full fixture → backup → wipe → restore → deep-equal (except `lastBackupAt`, RES-15); safety backup and undo (and undo of undo); forced failure mid-restore leaves data untouched; every bad fixture refused with its own message | BAK-*, RES-*, LIF-16 | 6 |
| `old-backups.test.ts` | Every committed fixture in `tests/fixtures/backups/vN/` restores; migration never changes money fields (property test); migrated chains match the file | OLD-* | 6 |
| `upgrade.test.ts` | Open a database at each previous Dexie schema version with fixture data, upgrade, check data; `versionchange` closes old connections | MTB-04 | 2, and every schema change |
| `perf.repo.test.ts` | Recalculation plus write for a 200-page notebook under 50 ms (median of 20 runs, CI tolerance ×2) | CHN-15 | 7 |

---

## 6. Component tests (Testing Library)

| Suite | Key cases | IDs |
|---|---|---|
| `PageEditor.keyboard.test.tsx` | Focus order across 10 lines; line 10 → new page; later page exists → go to it; empty page does not create one; double Enter creates one page; Enter during IME composition ignored; Final page never creates | KBD-01–09 |
| `PageEditor.amount.test.tsx` | Flagged invalid amount; rejected value keeps last valid and blocks Enter; leaving a rejected field reverts it; intermediate `-` and `.` not flagged while typing; formatted on blur, raw on focus; ± button on empty and invalid | MON-05, EDT-02–04, FMT-06, KBD-11 |
| `PageEditor.fields.test.tsx` | Description cap and newline stripping; title cap and default; date mask, invalid and cleared dates; input attributes (`type`, `inputmode`, `autocomplete`, font size) | EDT-01, 05–17 |
| `PageEditor.save.test.tsx` | Debounce; flush on blur, `visibilitychange`, before Mark Final and Export; save failure keeps typing with Retry; external change while editing shows the notice | SAV-01–07, LIF-04, MTB-02 |
| `PageEditor.a11y.test.tsx` | Labels; bracket amounts read as "minus … rupees"; throttled live total; new-page announcement | A11Y-01–04 |
| `ConfirmDialog.test.tsx` | Focus in, trap, return; Escape closes | A11Y-05 |
| `RestoreFlow.test.tsx` | Unsupported text refused (TXT-05); summary text; "older than your current notes" warning; cosmetic fallback notes | OLD-12, RES-09 |

---

## 7. End-to-end tests (Playwright)

Run against the **production build** served by `vite preview` with the **same headers as Vercel** (CSP included). Projects: `chromium-desktop`, `pixel-7`, `iphone-14` (WebKit). Each test starts with empty storage unless it seeds data through a fixture helper.

### 7.1 Suites

| Spec file | Flow | Projects | IDs | Phase |
|---|---|---|---|---|
| `smoke.spec.ts` | App loads, shows the library | all | — | 0 |
| `editor.spec.ts` | Fill **three pages by keyboard alone** (Enter on desktop; editing bar Next on iPhone); page 3 BF = page 2 total; reload; everything still there | all | KBD-03, 10, SAV-02 | 2 |
| `carry-forward.spec.ts` | Fill 3 pages; edit page 1 (amount, sign flip, invalid text); pages 2 and 3 update without reload; strings match digit for digit | all | CHN-02, 12, 13, RND-05 | 2 |
| `two-tabs.spec.ts` | Two pages in one context: edit page 1 in tab A, page 3 in tab B updates; same line edited in both shows the notice | chromium | MTB-01, 02, CHN-11 | 2 |
| `notebooks.spec.ts` | Create, rename, recolour, delete (with Final-page second confirmation); empty library | all | NB-01–07 | 3 |
| `search.spec.ts` | Notebook name, title, default title, description, Archived pages, no match | all | SRC-* | 3 |
| `final-reopen.spec.ts` | Mark Final refused while an amount is flagged; after fixing it → Archive, read-only → Reopen → Draft with "Reopened on" | all | LIF-01–03, 18 | 3 |
| `final-recalc.spec.ts` | Page 2 Final; edit page 1 → page 2 total changes with "Total updated from earlier page on …"; reopen clears the note | all | CHN-04, 08 | 3 |
| `delete-draft.spec.ts` | Delete page 2 of 4; delete page 1; delete only page refused | all | LIF-05–10 | 3 |
| `activity.spec.ts` | Last 5 entries in order; deleted notebook entries not links | chromium | ACT-* | 3 |
| `navigation.spec.ts` | Deep links to missing notebook/page, malformed URLs, in-app back controls | all | NB-09, 10, PWA-05 | 3 |
| `totals-consistency.spec.ts` | Same page's total identical in library, pages list and editor | chromium | RND-06 | 3 |
| `settings-font.spec.ts` | Each font applies and persists after reload | all | LOOK-08 | 4 |
| `layout-small.spec.ts` | 320 px wide, widest font, `(99,99,99,999.99)` fits; 200% zoom reflows | chromium | FMT-08, LOOK-05 | 4 |
| `touch-targets.spec.ts` | Every interactive element ≥ 44 × 44 px on every screen | pixel-7, iphone-14 | A11Y-07 | 4 |
| `export.spec.ts` | PDF and JPEG download with correct names; PDF starts with `%PDF`; **PDF text is selectable and its extracted text matches the on-screen page**, fonts embedded; JPEG is 1080 × 1350; flush before export; Draft label; text with other scripts removed exports exactly as shown, no `?`, no fallback font (TXT-06) | chromium | EXP-*, FN-*, SAV-06 | 5 |
| `backup-restore.spec.ts` | Create data → backup → clear site data → restore → everything back; undo; bad files refused; other tab reloads | chromium | BAK-*, RES-*, MTB-03 | 6 |
| `old-backup.spec.ts` | Restore the committed v1 fixture through the real UI | chromium | OLD-01 | 6 |
| `reminder.spec.ts` | `page.clock` at +31 days → banner; dismiss → hidden 30 days; empty notebook → no banner | chromium | REM-*, DAT-05 | 6 |
| `pwa.spec.ts` | Manifest fields and icons; service worker controls the page; update prompt waits for typing and export | chromium | PWA-02–04, 07 | 7 |
| `offline.spec.ts` | Load once → offline → reload → create, edit, export | chromium, pixel-7 | PWA-02, EXP-08 | 7 |
| `privacy.spec.ts` | Full journey; any request to another origin fails the test; no cookies set | all | SEC-01 | 7 |
| `csp.spec.ts` | No CSP violation reported during a full journey (catches `eval`, inline scripts) | chromium | SEC-02–04 | 7 |
| `install.spec.ts` | iPhone hint before data / with notes in Safari ("back up first" + Back up now) / dismissed / installed; "Install app" via `beforeinstallprompt`; standalone hides it; private-window and in-app-browser banners; Settings storage status | iphone-14 (hint), chromium, pixel-7 | STO-02, 04, 05, SHR-07, PWA-07 | 7 |
| `base-path.spec.ts` | Build with `VITE_BASE=/note-add/`; app, router, manifest and service worker work under the path | chromium | PWA-09 | 7 |
| `a11y.spec.ts` | axe on every screen: zero serious or critical violations | all | A11Y-* | 7 |

### 7.2 Limits of emulation

The `iphone-14` project uses Playwright's WebKit build with an iPhone viewport and user agent. It does **not** reproduce the real iPhone keyboard, the share sheet, home-screen install, separate storage for installed apps, or storage eviction. Those are covered only by the manual checklist (§10).

---

## 8. Visual tests

- **Slip baselines:** the editor in each of the 7 colours and 4 fonts (28 images) at a fixed viewport.
- **Export baselines:** the rendered JPEG of a fixture page in each font.
- Baselines are created and compared **only on CI Linux** (font rendering differs between operating systems); a tolerance of 0.1% of pixels absorbs anti-aliasing.
- A baseline is updated only in a PR whose description says why the look changed.

---

## 9. Non-functional tests

| Area | Check | Threshold | Where |
|---|---|---|---|
| Contrast | All slips × both inks | ≥ 4.5:1 | Unit (phase 4) |
| Accessibility | axe; Lighthouse accessibility | 0 serious/critical; ≥ 95 | E2E; LHCI on `main` |
| Performance | Initial JS (gzip); export chunk | ≤ 150 KB; ≤ 250 KB | size-limit in CI |
| Performance | Lighthouse mobile performance | ≥ 90 | LHCI on `main` |
| Performance | 200-page recalculation and write | < 50 ms | `perf.repo.test.ts` |
| Performance | First load, mid-range phone, 4G | < 2 s | Manual (§10.9) |
| Best practices | Lighthouse | ≥ 90 | LHCI on `main` |
| Privacy | Third-party requests | 0 | `privacy.spec.ts` |
| Installability | Manifest and service worker | Present and controlling | `pwa.spec.ts` (Lighthouse no longer has a PWA category) |

---

## 10. Manual device checklist

### 10.1 Devices

At least one of each. Note the exact model and OS version in the run record.

| Code | Device | Browser / mode |
|---|---|---|
| **A** | Mid-range Android phone (around ₹12,000–18,000, Android 13+) | Chrome, in the browser |
| **A-i** | Same phone | Installed app |
| **I** | iPhone on a current iOS version (plus the oldest iPhone available, for EXP-09) | Safari, in the browser |
| **I-i** | Same iPhone | Installed to the home screen |
| **D** | Windows laptop | Chrome or Edge, browser and installed |
| **D2** (optional) | Mac | Safari |

Keyboards to try on Android: Gboard and the phone maker's own keyboard (for example Samsung Keyboard). On both phones, also try a Hindi keyboard: Hindi letters are removed with "Only English text is supported for now" (decided 23/11/2026), and Devanagari digits in amounts still work.

### 10.2 How to run

- Use the **Vercel preview URL** (HTTPS), never a `http://192.168…` LAN address: service workers and `crypto.randomUUID` need HTTPS (STO-08).
- Start each device with cleared site data unless the check says otherwise.
- Record each run as a copy of this checklist in the PR (or `docs/test-runs/DD-MM-YYYY-phaseN.md`), with ✅, ❌ (and an issue link) or n/a.

### 10.3 Money entry (phase 2; repeat before release)

| # | Check | A | A-i | I | I-i | D |
|---|---|---|---|---|---|---|
| M1 | Type `450`, `450.5`, `1280.75` on the on-screen keypad; total correct | [ ] | [ ] | [ ] | [ ] | [ ] |
| M2 | Enter a negative: minus key where it exists, otherwise the ± button; shown as `(300.00)`; total drops | [ ] | [ ] | [ ] | [ ] | [ ] |
| M3 | Type `450.505` → message, last valid value kept | [ ] | [ ] | [ ] | [ ] | [ ] |
| M4 | Type a letter in an amount → subtle flag, counts as zero | [ ] | [ ] | [ ] | [ ] | [ ] |
| M5 | `99,99,99,999.99` accepted; one more digit refused with the crore message; fits on screen | [ ] | [ ] | [ ] | [ ] | [ ] |
| M6 | Paste an amount copied from a WhatsApp message (`₹1,280.75`) and from a bank SMS → correct or clearly flagged, never a wrong number | [ ] | [ ] | [ ] | [ ] | [ ] |
| M7 | Paste `450,50` → flagged invalid (not ₹45,050) | [ ] | [ ] | [ ] | [ ] | [ ] |
| M8 | Hindi keyboard: type a Hindi description → letters removed with the English-only message; confirm a word with Enter → focus does not jump; Devanagari digits in an amount are accepted | [ ] | [ ] | [ ] | [ ] | n/a |
| M9 | iPhone zoom: focusing an input does not zoom the page | n/a | n/a | [ ] | [ ] | n/a |

### 10.4 Keyboard flow and pages (phase 2)

| # | Check | A | A-i | I | I-i | D |
|---|---|---|---|---|---|---|
| K1 | Fill three pages using only the keyboard's Next/Enter (or the editing bar's Next on iPhone) | [ ] | [ ] | [ ] | [ ] | [ ] |
| K2 | Editing bar sits just above the keyboard, does not cover the focused line, and disappears when the keyboard closes | [ ] | [ ] | [ ] | [ ] | n/a |
| K3 | Line 10 → new page opens with the right brought forward | [ ] | [ ] | [ ] | [ ] | [ ] |
| K4 | Fast double-tap on New page creates one page | [ ] | [ ] | [ ] | [ ] | [ ] |
| K5 | Close the app mid-typing (swipe away), reopen → at most the last moment of typing lost | [ ] | [ ] | [ ] | [ ] | [ ] |

### 10.5 Carry-forward and Final pages (phase 3)

| # | Check | A | I | D |
|---|---|---|---|---|
| C1 | Fill 5 pages; change an amount on page 1; pages 2–5 update immediately | [ ] | [ ] | [ ] |
| C2 | Mark page 3 Final; edit page 1; page 3 shows the new total and "Total updated from earlier page on DD/MM/YYYY" | [ ] | [ ] | [ ] |
| C3 | Reopen page 3: "Reopened on DD/MM/YYYY" shown; it is editable | [ ] | [ ] | [ ] |
| C4 | Delete Draft page 2 of 5; pages renumber; totals correct | [ ] | [ ] | [ ] |
| C5 | Add a large refund on page 1 that makes a later total negative → shown in brackets everywhere | [ ] | [ ] | [ ] |

### 10.6 Look (phase 4)

| # | Check | A | I | D |
|---|---|---|---|---|
| L1 | All 7 colours and 4 fonts look right; amounts line up in a column | [ ] | [ ] | [ ] |
| L2 | Phone in dark mode: slips still paper-coloured, inputs readable | [ ] | [ ] | [ ] |
| L3 | Largest system text size: nothing clipped | [ ] | [ ] | n/a |
| L4 | Windows High Contrast: rows still visible | n/a | n/a | [ ] |

### 10.7 Export and share (phase 5)

| # | Check | A | A-i | I | I-i | D |
|---|---|---|---|---|---|---|
| E1 | Export PDF → share sheet opens → send to WhatsApp → opens correctly on the receiving phone | [ ] | [ ] | [ ] | [ ] | n/a |
| E2 | Export JPEG → share to email → attachment opens | [ ] | [ ] | [ ] | [ ] | n/a |
| E3 | Desktop: both formats download with the right file names | n/a | n/a | n/a | n/a | [ ] |
| E4 | Export matches the on-screen page (colour, font, numbers) side by side | [ ] | [ ] | [ ] | [ ] | [ ] |
| E5 | Cancel the share sheet → no error | [ ] | [ ] | [ ] | [ ] | n/a |
| E6 | Oldest available iPhone: PDF export works (canvas size) | n/a | n/a | [ ] | n/a | n/a |

### 10.8 Backup and restore (phase 6)

| # | Check | A | I | D |
|---|---|---|---|---|
| B1 | Backup → save to Google Drive / Files / OneDrive through the share sheet (or download on desktop) | [ ] | [ ] | [ ] |
| B2 | Clear site data → restore that file → every notebook, page, colour and font back | [ ] | [ ] | [ ] |
| B3 | Restore the wrong file (a photo, a PDF) → clear message, nothing changed | [ ] | [ ] | [ ] |
| B4 | Undo last restore → previous data back | [ ] | [ ] | [ ] |
| B5 | Move notes between devices: back up on Android, restore on iPhone, totals identical | [ ] | [ ] | n/a |
| B6 | Restore the committed v1 fixture file on each device | [ ] | [ ] | [ ] |

### 10.9 Install, offline and storage (phase 7; repeat at release)

| # | Check | A | I | D |
|---|---|---|---|---|
| P1 | Install from the browser (Android/desktop prompt; iPhone Share → Add to Home Screen) | [ ] | [ ] | [ ] |
| P2 | Installed app opens in its own window with an in-app back control | [ ] | [ ] | [ ] |
| P3 | **Airplane mode**: open the installed app, create a notebook, fill a page, export | [ ] | [ ] | [ ] |
| P4 | Close and reopen after a day → data still there | [ ] | [ ] | [ ] |
| P5 | iPhone: install hint appears on first visit in Safari; notes typed in Safari do **not** appear in the installed app; hint explains backup → restore | n/a | [ ] | n/a |
| P6 | Open the app link from inside WhatsApp (in-app browser) → "Open in Chrome/Safari" banner | [ ] | [ ] | n/a |
| P7 | Private/incognito window → private-window banner | [ ] | [ ] | [ ] |
| P8 | Deploy a new version → "New version available" toast; Reload keeps everything | [ ] | [ ] | [ ] |
| P9 | First load on 4G (DevTools throttling on desktop as a cross-check) under 2 s | [ ] | [ ] | [ ] |
| P10 | Settings › About shows the storage status | [ ] | [ ] | [ ] |

### 10.10 Accessibility (phase 7)

| # | Check | A (TalkBack) | I (VoiceOver) | D (keyboard only) |
|---|---|---|---|---|
| X1 | Create a notebook and fill a page with the screen reader / keyboard only | [ ] | [ ] | [ ] |
| X2 | Negative amounts read as "minus … rupees"; flagged amounts announced | [ ] | [ ] | n/a |
| X3 | Total changes announced without chattering on every keystroke | [ ] | [ ] | n/a |
| X4 | Dialogs: focus moves in and returns afterwards | [ ] | [ ] | [ ] |

### 10.11 The 2-minute task (phase 8)

3–5 testers, at least one on iPhone and one on Android, no instructions: "Create a notebook, fill two pages, export a PDF and send it to yourself." Record for each: device, time taken, where they hesitated, whether the PDF arrived and was correct. Pass: every tester finishes in under 2 minutes, or the blocking issue is fixed and re-tested.

---

## 11. When tests run

| Moment | What runs |
|---|---|
| Every commit (hook) | Lint, type check, unit, property (100 runs), repository, component |
| Every push / PR (CI) | All of the above with 1,000 property runs, a second time zone job, build, all e2e projects, visual, axe, size-limit |
| Merge to `main` | All of the above, 10,000 property runs, Lighthouse CI |
| Phase exit | The phase's manual checklist rows (§10) on the listed devices |
| Release (v1.0 and every later version) | Full manual checklist §10.3–10.10 on A, I and D; restore of every committed backup fixture; P8 update test from the previous production version |

---

## 12. Phase exit: required tests

| Phase | Must pass before the phase closes |
|---|---|
| 0 | Smoke unit and e2e; hook blocks a failing commit; lint guard fires on an engine violation; CSP header present on the preview |
| 1 | §4 complete; 100% engine coverage; property suites at 10,000 runs locally once |
| 2 | `pages.repo`, `upgrade`, editor component suites; `editor`, `carry-forward`, `two-tabs` e2e; manual §10.3 and §10.4 |
| 3 | `lifecycle`, `notebooks`, `activity` repository suites; all phase 3 e2e; manual §10.5 |
| 4 | Contrast; `settings-font`, `layout-small`, `touch-targets`; visual baselines; manual §10.6 |
| 5 | `export` e2e; export baselines; manual §10.7 |
| 6 | `backup.repo`, `old-backups`, `RestoreFlow`; `backup-restore`, `old-backup`, `reminder` e2e; manual §10.8 |
| 7 | `pwa`, `offline`, `privacy`, `csp`, `base-path`, `a11y` e2e; `perf.repo`; Lighthouse thresholds; manual §10.9 and §10.10 |
| 8 | Release run (§11) at the final address; §10.11 user testing |
