# Note-Add

A pad of sticky notes for quick money calculations: write what you spent on ruled lines, the page adds itself up, totals carry forward from page to page, and any page can be shared as a PDF or image. An offline-first Progressive Web App by Spearman. No accounts, no server, no tracking: your notes stay on your device.

> Status: in development (phases 0–6 built on branch `build/phases-0-6`). Not yet deployed.

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
- [Progress](PROGRESS.md)

## Deployment

Static files on Vercel (`vercel.json` holds the SPA rewrite and security headers). The Vercel address will be recorded here once the project is linked (not done yet).

## Fonts

All fonts are bundled with the app (no network) and licensed under the SIL Open Font Licence: Carlito (Calibri-style, default), Atkinson Hyperlegible (Verdana-style), Caladea (Cambria-style), Merriweather (classic serif) for descriptions and amounts; Work Sans for the interface; Noto Sans Devanagari as a fallback inside exported PDFs.

**Glyph check (LOOK-03):** every slip font has the digits, brackets, comma and full stop used in amounts. The rupee sign `₹` is included in Carlito, Merriweather and Work Sans but **not** in Atkinson Hyperlegible or Caladea; with those two fonts a `₹` typed in a description is drawn with the device's fallback font on screen. Amounts never show `₹`, so totals are unaffected. Hindi and other non-Latin descriptions use the device's fonts on screen.

## Licences

Code: MIT (see `LICENSE`). Fonts: SIL Open Font Licence; each family's licence is in `public/fonts/LICENSES/`.
