# 002 — English-only text for version 1

Status: accepted · Date: 23/11/2026

## Context

Phase 5 made exports handle Hindi with a bundled Noto Sans Devanagari fallback and a `regenerator-runtime` workaround for fontkit's Indic shaper. pdf-lib still could not shape Devanagari properly, emoji became `?` in PDFs, and the extra font and runtime added weight and risk to the export path.

## Decision

Version 1 is **English only**.

1. **Descriptions, page titles and notebook names** accept Latin-script text only: Basic Latin, Latin-1 Supplement and Latin Extended-A, plus `₹` and common punctuation (– — ‘ ’ ‚ “ ” „ • … ′ ″ ‹ ›). Two characters in those blocks are left out because no bundled font draws them or they are invisible: the soft hyphen (U+00AD) and the deprecated `ŉ` (U+0149). The Unicode hyphens U+2010/U+2011 are not included (no bundled glyph; the ASCII hyphen is used).
2. When typed or pasted text contains other characters (Devanagari, Arabic, emoji, CJK, Cyrillic, Greek…), they are **removed** and **"Only English text is supported for now"** is shown under the field. Text is composed (NFC) first, so a letter typed with a combining accent is kept.
3. **Amount fields are unchanged:** Devanagari and full-width digits are still accepted and converted to ASCII (MON-25).
4. **Exports** use only the bundled slip fonts and Work Sans. Noto Sans Devanagari and the `regenerator-runtime` workaround are removed. Every allowed character has a glyph in each export font chain (slip font latin + latin-ext, then Work Sans latin + latin-ext); a test checks this.
5. **Backups:** on restore, a notebook name, page title or line description containing unsupported characters **refuses the whole file** with a clear message (strict, like money). Recent-activity entries with such text are cosmetic: they are left out, with a note in the summary.

## Consequences

- Engine: `src/engine/text.ts` (`filterSupportedText`, `isSupportedText`, `isSupportedCodePoint`, `UNSUPPORTED_TEXT_MESSAGE`), 100% covered.
- The rule is applied in the editor (descriptions, title), the notebook name dialog and, as a backstop, the repository (`updateLines`, `updatePageHeader`, `createNotebook`, `renameNotebook`).
- Screen font stacks put bundled Work Sans before system fonts, so letters a slip font lacks (for example some Latin Extended-A letters and `₹` in Atkinson Hyperlegible) match the PDF.
- Edge cases EDT-08, SRC-07, EXP-03, EXP-12, NB-04 were rewritten; new cases TXT-01 to TXT-07.
- Search no longer needs to handle non-Latin scripts. IME composition handling (KBD-07) is kept, because accent and predictive-text keyboards still compose.
- Lifting the rule later needs: a font strategy for other scripts in the PDF (shaping), relaxing the backup validator (old v1 files stay valid either way), and removing the filter.
