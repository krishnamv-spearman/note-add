# Problem Statement: Note-Add (sticky-note expense pages, as an installable web app)

Date: 22 November 2026 · Owner: Spearman · Status: ready for "Implement phase 0"

## 1. Overview and objective

Build a small, free, offline-first **Progressive Web App (PWA)** that works like a pad of sticky notes for quick money calculations: you write what you spent on ruled lines, the page adds up by itself, totals carry forward from page to page, and any page can be shared as a PDF or image.

**Practical use:** an employee jotting travel claims, office petty cash, grocery runs or trip expenses gets a neat, totalled page in seconds, without opening a spreadsheet, and can send it to whoever needs it.

**Why it exists for Spearman:** a polished, free "first app by Spearman" that visitors can open from spearman.in, and a small, safe project on which to practise the full build process (spec, phases, tests, CI, deploy) before the larger accounting product. It is not expected to earn money.

**Guiding principle:** quick and obvious. No accounts, no setup, no learning curve. Everything works offline on the user's device, and every total is exactly right to the paisa.

**Objective.** Design and implement an app that:

- Organises pages into colour-coded **notebooks**, each a stack of sticky-note slips
- Gives each page **10 ruled lines** of description and amount, with a live **total** that includes the amount **brought forward** from the previous page
- Moves line to line with the keyboard's Enter/Next key and **starts a new page automatically** after line 10
- **Recalculates every later page** when an earlier page changes
- Lets the user mark a page **Final** (locked and archived) and **Reopen** it if needed
- **Exports** any page as PDF or JPEG through the device's share menu
- **Backs up and restores** all data as a single file through the share menu
- **Installs** to the home screen on Android, iPhone and desktop, and works fully offline

**User:** one person on their own phone or computer. No sign-in, no server, no sharing between users.

**Out of scope for version 1:** text in scripts other than Latin (decided 23/11/2026), user accounts, cloud sync, Google Play or App Store listing, currencies other than INR, claim statuses or approval workflows, receipt scanning, handwriting fonts, ads, analytics or tracking of any kind.

## 2. Screens and flow

```
Notebooks library ──> Notebook (pages list) ──> Page editor
      │                      │                        │
      └── Settings           └── Archive              └── Export (PDF/JPEG) via share menu
                                                       
Settings ──> Font · Backup · Restore · About and privacy
```

Bottom navigation: **Notebooks**, **New page**, **Settings**.

## 3. Scope of work: the screens

### 3.1 Notebooks library (home)

- Search box: "Find a notebook or page…", matching notebook names, page titles and line descriptions.
- Each notebook appears as a small stack of slips in its colour, with name, number of pages and the latest page's total.
- An **"Add a new book"** tile with a thin border, no shadow and a `+` icon, clearly different from existing notebooks (thick border and shadow).
- Creating a notebook asks for a **name** and a **colour** (section 4).
- **Recent activity** at the bottom: the last 5 changes (for example "Page 3 of Pune trip claims marked Final, 20/11/2026").

### 3.2 Notebook (pages list)

- Header: notebook name, colour, `+ New page`.
- Pages listed newest first, each card showing: Draft or Final badge, date, title, the first two lines as a preview, and the page total.
- Per-page actions: **Export PDF**, **Export JPEG**.
- An **Archive** section (collapsed by default) holding Final pages.
- A dotted **"Add a new page"** card at the end of the list.

### 3.3 Page editor

- Header fields: **date** (DD/MM/YYYY, defaults to today), **title** (optional; defaults to "Page N"), page number ("Page 3 of 7").
- **Brought forward** row at the top: the previous page's total, read-only. Page 1 of a notebook starts at 0.00.
- **10 ruled lines**, each with **description** (text) and **amount** (number).
- **Total row** fixed at the bottom: brought forward plus all amounts on the page, updated live as the user types.
- Keyboard: Enter/Next on a description moves to its amount; Enter/Next on an amount moves to the next line's description. On line 10's amount, Enter/Next **creates the next page** and moves to its line 1, with this page's total carried forward. A **New page** button does the same.
- Saving is automatic (no Save button needed); a small "Saved" indicator confirms it.
- **Mark as Final** button: locks the page (read-only) and moves it to the notebook's Archive.
- On a Final page, a **Reopen** button turns it back into a Draft and records "Reopened on DD/MM/YYYY" on the page.

### 3.4 Settings

- **Font** (section 4): four choices with a live preview.
- **Backup** and **Restore** (section 6).
- **About and privacy:** app version, "Made by Spearman" with a link to spearman.in, and the privacy statement (section 7).

## 4. Look and feel

**Slip colours.** The user picks a colour for each notebook from seven presets; an individual page may override it. Pages look like sticky notes: square-ish slips, faint ruled lines in a darker shade of the paper, a soft shadow.

| Colour | Paper | Ruled lines |
|---|---|---|
| Canary yellow (default) | `#FFF4A3` | `#E8D96B` |
| Mint green | `#D8F3DC` | `#A9D8B3` |
| Blush pink | `#FADADD` | `#E9AEB5` |
| Lavender | `#E6DDF7` | `#C3B3E6` |
| Sky blue | `#D6ECFA` | `#A6CDE8` |
| Peach | `#FFE0C2` | `#F0B98A` |
| Light grey | `#ECECEA` | `#C9C9C4` |

**Ink.** All text and numbers use one ink colour on every slip: dark olive charcoal `#363A27`. Secondary text uses `#4A4D3A`. Both must pass 4.5:1 contrast on every slip colour (checked by a test).

**Fonts.** One font is used for both descriptions and amounts. The user chooses from four, all free (SIL Open Font Licence) and **bundled with the app** so they work offline and look identical on every device:

| Setting label | Font | Notes |
|---|---|---|
| Calibri-style (default) | Carlito | Metric-compatible with Calibri; familiar to office users |
| Verdana-style | Atkinson Hyperlegible | Wide, open spacing; 1/l/I and 0/O always distinct |
| Cambria-style | Caladea | Metric-compatible with Cambria |
| Classic serif | Merriweather | Serif designed for screens |

Amounts use tabular, lining figures so digits line up in a column, and are right-aligned.

**Interface chrome** (navigation, buttons, labels) uses Work Sans. Touch targets are at least 44 × 44 px.

**Design reference:** the Note-Add design canvas (handwriting study and the "Four clear fonts, one ink colour" board).

## 5. Money rules (the calculation engine)

The calculation logic lives in one pure module with no user-interface code, so it can be tested completely.

- **Input:** the user types ordinary decimals (`450`, `450.5`, `1280.75`). Up to 2 decimal places; a third is rejected with a message.
- **Storage:** every amount is stored as an **integer number of paise** (`450.50` → `45050`). All arithmetic is integer arithmetic. No floating-point numbers are ever stored or summed.
- **Currency:** INR only. Display uses **Indian digit grouping**: `1,00,000.00`, not `100,000.00`.
- **Negative amounts** (refunds, corrections): typed with a minus sign (`-300`), displayed in **accounting brackets** `(300.00)` in the same ink colour, and subtracted from the total.
- **Limits:** any single amount and any total must stay within ±99,99,99,999.99 (₹99.99 crore). Larger values are rejected with a message.
- **Empty or non-numeric amounts** count as zero and are flagged with a subtle mark; a description with no amount is allowed. A page **cannot be marked Final** while any amount on it is non-numeric (decided 22/11/2026).
- **Pasted forms accepted** (decided 22/11/2026): Devanagari digits (`४५०`) are converted to ASCII, and the Indian "only" suffix (`450/-`) is stripped.
- **English-only text in version 1** (decided 23/11/2026): descriptions, page titles and notebook names accept Latin-script text only (Basic Latin, Latin-1 Supplement and Latin Extended-A, plus ₹ and common punctuation). Other characters (Devanagari, Arabic, emoji and so on) are removed with the message "Only English text is supported for now". Amount fields still accept Devanagari digits.
- **Page total** = brought forward + the sum of that page's 10 amounts.
- **Brought forward** on page N = total of page N−1 in the same notebook. Page 1 = 0.
- **Recalculation:** any change to a page immediately recalculates every later page's brought-forward and total in that notebook, including Final pages (their amounts cannot change, but their brought-forward can, and a Final page whose total changes this way shows "Total updated from earlier page on DD/MM/YYYY").
- **Deleting** a page (Drafts only, with confirmation) renumbers later pages and recalculates their carry-forwards.

## 6. Export, backup and restore

**Export a page** (PDF or JPEG; decided 22/11/2026: the JPEG is drawn on a canvas, and the PDF contains real, selectable text with the bundled fonts embedded): notebook name, page title, date, page number, brought forward, the 10 lines, the total, in the page's colour and font, with a small "Made with Note-Add · spearman.in" footer. The file opens the device's **share menu** (Web Share API) so the user can send it by email, WhatsApp or any app; where sharing is unavailable (some desktops), the file downloads instead. File name: `<notebook>-<page title>-<DD-MM-YYYY>.pdf`.

**Backup:** one JSON file containing every notebook, page and setting, with a format version number. Opens the share menu (Google Drive, OneDrive, email and so on) or downloads. File name: `note-add-backup-<DD-MM-YYYY>.json`.

**Restore:** the user picks a backup file. The app checks the file is a valid Note-Add backup of a supported version, shows a summary ("3 notebooks, 21 pages, last changed 20/11/2026"), and on confirmation **replaces** all current data. Before replacing, it automatically saves a backup of the current data so a mistaken restore can be undone.

**Backup reminder:** if the user has data and has not backed up for 30 days, a gentle banner suggests it (dismissible).

## 7. Constraints

**Platform.** A PWA: one web codebase that installs from the browser on Android, iPhone, iPad, Windows and Mac, and works offline after the first visit (service worker caches the app and fonts). Hosted as static files on Vercel. Suggested address: `notes.spearman.in` (or `spearman.in/note-add`); linked from the Ventures section of spearman.in with an "Open the app" button.

**Data stays on the device.** Stored in the browser's IndexedDB. The app asks the browser for persistent storage (`navigator.storage.persist()`) so data is not cleared under storage pressure. iPhones can clear data of sites not used for weeks if the app is **not installed** to the home screen; the app shows an "Install to keep your notes safe" hint on iPhone, and the backup reminder covers the rest.

**Privacy.** No accounts, no server, no cookies, no analytics, no third-party requests after install (fonts are bundled). Privacy statement shown in Settings and on the website: "Note-Add stores your notes only on your device. Nothing is sent to Spearman or anyone else. Backups and exports go only where you choose to send them."

**Suggested technology** (Claude Code may propose alternatives in the architecture document, with reasons):
- Vite, React and TypeScript
- Dexie for IndexedDB
- vite-plugin-pwa for the service worker and install manifest
- A client-side library for PDF (for example pdf-lib or jsPDF) and for page images (for example html-to-image)
- Vitest for unit tests; Playwright for end-to-end tests

**Cost.** Zero running cost: free Vercel hosting for a non-commercial free app, no server, no paid APIs.

**Build process (the harness).** From phase 0 the repo has:
- `CLAUDE.md` with the rules: money is integer paise only; the calculation engine has no UI code; never commit without all tests passing; dates are DD/MM/YYYY in the UI; Indian digit grouping.
- A pre-commit check (hook) that runs lint, type check and unit tests.
- GitHub Actions CI running lint, type check, unit tests and end-to-end tests on every push.
- `.gitignore` covering `node_modules/`, `dist/`, `.env*`.

## 8. Red flags

**GREEN.** Personal data: none collected; the user's own notes never leave the device. No regulated activity, no payments, no content rights issues (all fonts are open-licensed and bundled with their licences). Platform dependency: low (standard web features; iPhone storage behaviour handled as above). Before publishing, check the name "Note-Add" for existing apps or trademarks with the same name.

## 9. Deliverables

1. A public GitHub repo `note-add` with the app, tests, `CLAUDE.md`, README and font licences.
2. The app deployed at the chosen address, installable and working offline.
3. A Note-Add card on spearman.in with an "Open the app" link and the privacy statement.
4. A short user guide in the README: create a notebook, add lines, new page, Final and Reopen, export, back up and restore, install to the home screen.

## 10. Success criteria

- Every calculation test passes, including carry-forward chains of 50+ pages, negatives, edits to page 1 of a long notebook, and the ±₹99.99 crore limits. No total is ever off by a paisa.
- A user can create a notebook, fill two pages and export a PDF in under 2 minutes without instructions.
- The app installs and works fully offline (airplane mode) on Android Chrome, iPhone Safari and desktop Chrome or Edge.
- Editing an earlier page updates every later page's brought-forward and total immediately.
- Export and backup open the share menu on phones and download on desktops.
- Restoring a backup reproduces every notebook, page, colour and setting exactly; a mistaken restore can be undone.
- Ink and secondary text pass 4.5:1 contrast on all seven slip colours.
- Lighthouse PWA and accessibility checks pass; the app loads in under 2 seconds on a mid-range phone.

## 11. Phases

| Phase | Work | Exit criteria |
|---|---|---|
| 0 | Repo, Vite + React + TypeScript scaffold, `CLAUDE.md`, lint, type check, pre-commit hook, CI, deploy a placeholder page to Vercel | CI green; placeholder live on a Vercel address |
| 1 | Calculation engine: paise parsing and formatting (Indian grouping, brackets), page totals, carry-forward chain, recalculation, limits | Full unit-test suite passes, including the edge cases in section 5 |
| 2 | Page editor: 10 lines, live total, brought forward, Enter/Next navigation, automatic new page, autosave to IndexedDB | A user can fill three pages by keyboard alone; data survives a reload |
| 3 | Notebooks library and pages list: create, rename and colour notebooks, search, Draft/Final, Archive, Reopen, delete Drafts, recent activity | End-to-end tests for each flow pass |
| 4 | Look and settings: slip styling, seven colours, four bundled fonts, contrast test | Contrast test passes for all colours; font choice persists |
| 5 | Exports: PDF and JPEG per page via share menu or download | Exports match the on-screen page on phone and desktop |
| 6 | Backup, restore, automatic pre-restore backup, 30-day reminder | Round-trip test: backup → wipe → restore reproduces everything |
| 7 | PWA: install manifest, icons, offline caching, persistent storage, iPhone install hint, accessibility and performance pass | Lighthouse checks pass; works in airplane mode on Android and iPhone |
| 8 | Publish: domain, privacy statement, Note-Add card on spearman.in, test with 3–5 real users | Live at the chosen address; testers complete the 2-minute task |

## 12. Open questions

- Name: keep "Note-Add" after a name check, or choose another?
- Address: `notes.spearman.in` or `spearman.in/note-add`?
- Should a page title be required, or is "Page N" an acceptable default?
- Is 10 lines per page right for phones, or should the number of lines be a setting (for example 10 or 15)?
- Should the brackets style for negatives also be offered as a minus-sign style in Settings?

## 13. Sources and references

- Note-Add design canvas (Spearman): handwriting study and "Four clear fonts, one ink colour" boards
- Original Note-Add handoff document (screens, "Digital Vellum" metaphor, Play Store notes, now deferred)
- Fonts: Carlito, Atkinson Hyperlegible, Caladea, Merriweather, Work Sans (Google Fonts, SIL Open Font Licence)
