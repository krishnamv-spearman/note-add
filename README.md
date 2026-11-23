# Note-Add

A pad of sticky notes for quick money calculations: write what you spent on ruled lines, the page adds itself up, totals carry forward from page to page, and any page can be shared as a PDF or image. An offline-first Progressive Web App by Spearman. No accounts, no server, no tracking: your notes stay on your device.

> Status: version 1 is feature-complete and tested (phases 0–7). It is not yet published: the release steps are in [docs/release-checklist.md](docs/release-checklist.md).

## User guide

Note-Add looks like a pad of sticky notes. Each **notebook** holds numbered **pages**; each page has ten ruled lines for a description and an amount. Everything is saved as you type, on your device.

### Create a notebook

On the first screen, tap the **Add a new book** card. Give the notebook a name and choose **Create**. You land on its first page.

### Add lines

Type what you spent in the description, then the amount. **Enter** moves description → amount → the next line, so you can write down the whole page without lifting your hands. The page total at the bottom adds itself up as you type.

- Amounts accept digits and one decimal point, for example `1,250.50`. A minus sign or brackets make a refund or credit: `-300` is shown as `(300.00)`.
- Amounts show with Indian digit grouping (`1,00,000.00`). Dates are DD/MM/YYYY.
- A line with something that is not a number is counted as zero and marked, so a typo never silently changes your total.
- Text is English (Latin letters, accents, ₹ and common punctuation) in version 1.

### Start a new page

On the notebook screen, tap **New page**. The new page starts with **Brought forward**: the running total of every page before it. Change an earlier page and every later page updates by itself.

### Final and Reopen

When a page is complete, open it and choose **Mark as Final**. Final pages are locked against accidental edits and move to the **Archive** list at the bottom of the notebook. To change one, open it and choose **Reopen**; the page shows when it was reopened, and the pages after it recalculate.

### Export and share

Open a page and choose **Export PDF** or **Export JPEG**. On a phone you can send it straight to WhatsApp, Mail or any app you choose from the share sheet; on a computer it downloads. The export looks like the page on screen, in the font you picked, and PDF text can be selected and copied.

### Back up and restore

Open **Settings**.

- **Back up** saves one file with all your notebooks. Keep it somewhere safe (email it to yourself, put it in cloud storage). Note-Add reminds you when your last backup is old.
- **Restore from a backup file** reads that file back. You are asked to confirm because it **replaces** the notes on this device. **Undo last restore** brings the previous notes back if you change your mind.
- Backups made by any earlier version of Note-Add can always be restored.

### Install to the home screen

Installing makes Note-Add open like an app, work with no connection, and (on iPhone) stops Safari from clearing your notes if you do not visit for weeks.

- **Android (Chrome):** open the site, tap **Install app** in Settings (or the browser menu ⋮ → _Install app_ / _Add to Home screen_).
- **iPhone and iPad (Safari):** tap the **Share** button, then **Add to Home Screen**, then **Add**. This must be Safari; other iPhone browsers cannot install. Note-Add shows an "Install to keep your notes safe" hint until you do.
- **Windows, Mac or Chromebook (Chrome or Edge):** click **Install app** in Settings, or the install icon at the right of the address bar.

After the first visit the whole app works in airplane mode.

### Change the look

**Settings → Font** offers four slip fonts (Calibri-style, Verdana-style, Cambria-style, Classic serif). Each notebook and page also has a colour.

## Privacy

Note-Add stores your notes only on your device. Nothing is sent to Spearman or anyone else. Backups and exports go only where you choose to send them.

No accounts, no server of ours, no cookies, no analytics, no third-party requests, no web fonts from a CDN. If you clear the site's data your notes are cleared with it, so back up. The same text is in the app under **Settings → Read the full privacy page** (`/privacy`).

## Run it locally

Requires Node.js 26 LTS (see `.nvmrc`).

```sh
npm ci
npm run dev          # http://localhost:5173
npm test             # unit, repository and component tests
npx playwright install chromium webkit
npm run test:e2e     # end-to-end tests on the production build
```

## Documentation

- [Problem statement](docs/problem-statement.md)
- [Architecture](docs/architecture.md)
- [Implementation plan](docs/implementation-plan.md)
- [Edge cases](docs/edge-cases.md)
- [Test plan](docs/test-plan.md)
- [Decisions](docs/decisions/)
- [Release checklist](docs/release-checklist.md)
- [Progress](PROGRESS.md)

## Deployment

Static files on Vercel (`vercel.json` holds the SPA rewrite, security headers and cache rules). The Vercel address will be recorded here once the project is linked (not done yet); every step to publish is in [docs/release-checklist.md](docs/release-checklist.md).

## Fonts

All fonts are bundled with the app (no network) and licensed under the SIL Open Font Licence: Carlito (Calibri-style, default), Atkinson Hyperlegible (Verdana-style), Caladea (Cambria-style), Merriweather (classic serif) for descriptions and amounts; Work Sans for the interface and as the fallback for any letter a slip font lacks.

**Glyph check (LOOK-03):** every slip font has the digits, brackets, comma and full stop used in amounts. The rupee sign `₹` is included in Carlito, Merriweather and Work Sans but **not** in Atkinson Hyperlegible or Caladea; with those two fonts a `₹` typed in a description is drawn with bundled Work Sans, on screen and in exports. Amounts never show `₹`, so totals are unaffected.

**English only in version 1** (decided 23/11/2026): descriptions, page titles and notebook names accept Latin-script text (including accented letters, `₹` and common punctuation). Other scripts and emoji are removed with the message "Only English text is supported for now". Amounts still accept Devanagari digits.

## Licences

Code: MIT (see `LICENSE`). Fonts: SIL Open Font Licence; each family's licence is in `public/fonts/LICENSES/`.
