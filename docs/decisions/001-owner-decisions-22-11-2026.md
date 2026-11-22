# 001 — Owner decisions of 22/11/2026

Status: accepted · Date: 22/11/2026

## Context

edge-cases.md §18.1 listed open questions with proposed defaults, and architecture.md §15 proposed an image-only PDF. The owner ruled on them before phase 0.

## Decisions

1. **All proposed defaults in edge-cases.md §18.1 are accepted**, except as below.
2. **MON-25:** Devanagari digits (`४५०`) are accepted and converted to ASCII. Full-width digits keep the proposed default (also accepted).
3. **PST-07:** the Indian "only" suffix `/-` is accepted and stripped (`450/-` → ₹450.00).
4. **LIF-18 (changed):** a page cannot be marked Final while any amount on it is invalid. The repository refuses it; the editor explains how many amounts need fixing.
5. **Exports (changed):** the JPEG is drawn with Canvas 2D (unchanged). The **PDF contains real, selectable text drawn with pdf-lib**, with the bundled fonts embedded (via `@pdf-lib/fontkit`, subset), instead of an embedded image.
6. **Environment:** the project lives at `C:\Projects\AI Projects\002_Note-Add` (outside OneDrive); Node.js 26 LTS is installed, so `engines` and `.nvmrc` use 26.

## Consequences

- architecture.md §2, §5.2, §6.2, §8.2, §14, §15, §16 updated; implementation-plan.md P0.0a, P0.0e, P0.2, P0.13, P3.3, P3.8, P5.5 updated; test-plan.md export and Final suites updated; new edge cases EXP-11 and EXP-12.
- The PDF needs a fallback font for Hindi descriptions: Noto Sans Devanagari (OFL) is bundled and embedded only into PDFs that need it.
- pdf-lib does not shape complex scripts, so Hindi conjuncts may be simplified in the PDF (still selectable). The JPEG uses the browser's shaping.
