# Edge Cases: Note-Add

Date: 22 November 2026 · Owner: Spearman · Status: draft for review before phase 0
Inputs: [problem-statement.md](problem-statement.md) ("spec"), [architecture.md](architecture.md) ("arch"), [implementation-plan.md](implementation-plan.md) ("plan", task IDs like P2.7). How each case is tested: [test-plan.md](test-plan.md).

**Most important sections:** money input (§1), pasted values (§1.1), rounding (§3.1), carry-forward and edits to early pages (§4), Final pages (§5), and old backups (§14.1). A mistake in any of these produces a wrong total, which is the one failure the spec does not allow.

This file lists every corner case found for Note-Add, the behaviour expected in each, the plan task that owns it, and how it is tested. Use it as a checklist while building each phase and when reviewing a pull request.

---

## How to read this file

**Columns**

- **ID**: stable reference, used in test names (for example `it('MON-14: comma used as decimal is invalid')`).
- **Scenario**: what the user or the system does.
- **Expected**: what the app must do.
- **Task**: the plan task that owns it.
- **Test**: `U` unit, `R` repository (fake-indexeddb), `C` component, `E` end-to-end (Playwright), `M` manual on a real device.
- **Status**:
  - ✅ **Covered**: already an explicit task or test in the plan.
  - ➕ **Add**: not yet in the plan; add the test (and any code) to the named task.
  - ❓ **Decide**: needs an owner decision; the expected behaviour shown is the proposed default.

**Principle used throughout:** money fields are strict (reject anything doubtful); cosmetic fields are forgiving (fall back to a default). No action may silently change an amount.

A summary of every ➕ and ❓ item, and the changes they imply for arch and plan, is at the end ([§18](#18-summary-of-gaps-and-follow-up-changes)).

---

## 1. Amount input and parsing (phase 1, `parseAmount`)

| ID | Scenario | Expected | Task | Test | Status |
|---|---|---|---|---|---|
| MON-01 | Empty or only spaces | `empty`; counts as 0; no flag | P1.2 | U | ✅ |
| MON-02 | Whole number `450` | 45000 paise | P1.2 | U | ✅ |
| MON-03 | One decimal `450.5` | 45050 | P1.2 | U | ✅ |
| MON-04 | Two decimals `1280.75` | 128075 | P1.2 | U | ✅ |
| MON-05 | Three decimals `450.505` | Rejected: "Up to 2 decimal places, for example 450.50"; last valid value kept | P1.2, P2.7 | U, C | ✅ |
| MON-06 | Trailing zeros beyond 2 places `450.500` | Rejected, same as MON-05 (simple, predictable rule) | P1.2 | U | ✅ |
| MON-07 | Leading point `.5` | 50 | P1.2 | U | ✅ |
| MON-08 | Trailing point `450.` | 45000 | P1.2 | U | ✅ |
| MON-09 | Leading zeros `007.50` | 750 | P1.2 | U | ✅ |
| MON-10 | Zero forms `0`, `0.00`, `-0`, `-0.00` | 0, never negative zero; displays `0.00`, not `(0.00)` | P1.2, P1.3 | U | ✅ |
| MON-11 | Negative `-300` | −30000; shown `(300.00)` | P1.2 | U | ✅ |
| MON-12 | Brackets `(300.00)` | −30000 (so a copied display value parses back) | P1.2 | U | ✅ |
| MON-13 | Leading plus `+300` | 30000 | P1.2 | U | ✅ |
| MON-14 | Comma used as decimal separator `450,50` | **Invalid**, flagged. Commas are only accepted in valid Indian (`1,00,000`) or Western (`100,000`) grouping positions. Blindly stripping commas (as arch §5.2 currently says) would turn ₹450.50 into ₹45,050 | P1.2 | U | ✅ |
| MON-15 | Valid Indian grouping `1,00,000` and Western `100,000` | Both 10000000 | P1.2 | U | ✅ |
| MON-16 | Badly placed commas `1,0,0`, `10,00,0` | Invalid | P1.2 | U | ✅ |
| MON-17 | Rupee sign and prefixes `₹1,280.75`, `Rs. 1280.75`, `rs 50`, `INR 50` | Prefix stripped; parsed normally | P1.2 | U | ✅ |
| MON-18 | Rupee sign alone `₹` | Invalid | P1.2 | U | ✅ |
| MON-19 | Spaces inside digits `1 280` | Invalid (ambiguous) | P1.2 | U | ✅ |
| MON-20 | Unicode minus `−300` (U+2212) or en dash `–300` (pasted from Excel/Word) | Treated as minus: −30000 | P1.2 | U | ✅ |
| MON-21 | Both forms `-(300)` or `(-300)` | Invalid | P1.2 | U | ✅ |
| MON-22 | Double minus `--5`, minus at end `5-` | Invalid | P1.2 | U | ✅ |
| MON-23 | Scientific / hex / special `1e5`, `0x10`, `Infinity`, `NaN` | Invalid | P1.2 | U | ✅ |
| MON-24 | Letters mixed in `12a`, `1.2.3`, `abc` | Invalid; counts 0; flagged | P1.2 | U | ✅ |
| MON-25 | Devanagari digits `४५०` or full-width digits `４５０` | Mapped to ASCII digits and parsed (Indian users on Hindi keyboards). Decided 22/11/2026 | P1.2 | U | ✅ decided |
| MON-26 | Lakh/crore shorthand `1.5L`, `2cr`, `5k` | Invalid (no shorthand in v1) | P1.2 | U | ✅ |
| MON-27 | Maximum `99,99,99,999.99` | 99999999999 paise (corrected 22/11/2026) | P1.2 | U | ✅ |
| MON-28 | One paisa over: `1000000000.00` (₹100 crore; corrected 22/11/2026, was `100000000.00`, which is ₹10 crore and within the limit) | Rejected: "Amounts must be under ₹99.99 crore" | P1.2 | U | ✅ |
| MON-29 | Minimum `-99,99,99,999.99`; one paisa under | Accepted; rejected | P1.2 | U | ✅ |
| MON-30 | Very long digit string (30+ digits, or `0000…0001`) | Over-limit check happens on digit strings before any numeric conversion, so there is no precision loss; input field capped at 20 characters | P1.2, P2.7 | U | ✅ |
| MON-31 | Classic float trap `0.1` + `0.2` | Exactly 30 paise | P1.2 | U | ✅ |
| MON-32 | Round-trip: every valid paise value formatted then parsed | Same value, both display styles | P1.4 | U (property) | ✅ |

### 1.1 Pasted values

People paste amounts from WhatsApp messages, bank SMS, emails, PDFs and spreadsheets. Pasted text carries characters a keyboard never types.

| ID | Scenario | Expected | Task | Test | Status |
|---|---|---|---|---|---|
| PST-01 | Leading or trailing spaces, including non-breaking space (U+00A0), thin space (U+2009) and narrow no-break space (U+202F) | Trimmed; parsed normally | P1.2 | U | ✅ |
| PST-02 | Invisible characters copied from WhatsApp or web pages: zero-width space (U+200B), left-to-right mark (U+200E), byte-order mark (U+FEFF) | Removed before parsing | P1.2 | U | ✅ |
| PST-03 | Trailing newline or tab (one cell copied from Excel or Google Sheets) | Removed; parsed normally | P1.2 | U | ✅ |
| PST-04 | Several cells or lines pasted into one amount (`450\t300`, `450\n300`) | Invalid, flagged; nothing is summed or split automatically | P1.2, P2.14 | U, C | ✅ |
| PST-05 | Accounting negative with symbol `(₹1,280.75)` or `₹(1,280.75)` | −128075 | P1.2 | U | ✅ |
| PST-06 | Symbol after the minus `-₹300`, `Rs.-300`, `₹-300` | −30000 | P1.2 | U | ✅ |
| PST-07 | Indian "only" suffix `450/-` or `₹ 450/-` (common on bills and in messages) | Suffix stripped: 45000. Decided 22/11/2026 | P1.2 | U | ✅ decided |
| PST-08 | Word suffixes `450 only`, `450 INR`, `1.5 Cr`, `₹450.00 (paid)` | Invalid (no guessing) | P1.2 | U | ✅ |
| PST-09 | Bank SMS style with trailing `Dr`/`Cr` (`1,280.75 Dr`) | Invalid; the user types the sign. Guessing debit/credit could flip a sign | P1.2 | U | ✅ |
| PST-10 | Number with Western grouping and 3 decimals from a foreign invoice `1,234.567` | Rejected: too-many-decimals | P1.2 | U | ✅ |
| PST-11 | European style `1.234,56` | Invalid (would otherwise read as ₹1.23456 or ₹123,456) | P1.2 | U | ✅ |
| PST-12 | Paste of more than 20 characters into the amount field | Pasted text kept (not cut silently, which could drop digits), field marked invalid with "Too long" | P2.14 | C | ✅ |
| PST-13 | Description pasted with an amount in it (`Taxi 450`) | Stays a description; amount not split out | P2.14 | C | ✅ |
| PST-14 | Value copied from the app's own total row (`1,00,000.00` or `(300.00)`) pasted into a line | Parses back exactly | P1.2 | U | ✅ |

## 2. Formatting and display (phase 1, `formatPaise`)

| ID | Scenario | Expected | Task | Test | Status |
|---|---|---|---|---|---|
| FMT-01 | 0, 5, −5 paise | `0.00`, `0.05`, `(0.05)` | P1.3 | U | ✅ |
| FMT-02 | Each grouping boundary: 999.99, 1,000.00, 99,999.99, 1,00,000.00, 9,99,999.99, 10,00,000.00, 1,00,00,000.00 | Correct Indian grouping at every boundary | P1.3 | U | ✅ |
| FMT-03 | Maximum and minimum | `99,99,99,999.99`, `(99,99,99,999.99)` | P1.3 | U | ✅ |
| FMT-04 | Minus style | `-300.00` | P1.3 | U | ✅ |
| FMT-05 | Output identical in every browser and Node | String-built, not `Intl`; `Intl` only a test cross-check | P1.3 | U | ✅ |
| FMT-06 | Field shows formatted value on blur, raw text on focus | `1280.75` typed → `1,280.75` shown after blur → `1280.75` when focused again | P2.7 | C | ✅ |
| FMT-07 | Negative page total | Total row shows brackets, same ink colour, no red | P2.5 | C | ✅ |
| FMT-08 | Widest values fit at 320 px screen width (iPhone SE), with brackets, in the widest font (Atkinson) | No overflow or clipping in amount column or total row | P4.5 | E (320 px viewport) | ✅ |

## 3. Totals and limits

| ID | Scenario | Expected | Task | Test | Status |
|---|---|---|---|---|---|
| TOT-01 | All lines empty | Total = brought forward | P1.5 | U | ✅ |
| TOT-02 | Mix of valid, empty and invalid amounts | Invalid and empty count as 0; only invalid ones are flagged | P1.5 | U | ✅ |
| TOT-03 | Description with no amount; amount with no description | Both allowed, neither flagged | P1.5, P2.7 | U, C | ✅ |
| TOT-04 | Each amount within limit but the page total over limit (10 × ₹99 crore) | Edit rejected with "This would make the page total more than ₹99.99 crore" | P1.6, P2.8 | U, C | ✅ |
| TOT-05 | Total exactly at the limit | Allowed | P1.6 | U | ✅ |
| TOT-06 | Negative total below −₹99.99 crore | Rejected the same way | P1.6 | U | ✅ |
| TOT-07 | Totals near the limit summed across 11 values | No precision loss (all safe integers) | P1.4 | U (property) | ✅ |

### 3.1 Rounding

**The rule:** Note-Add never rounds. Every value is exact to the paisa from the moment it is typed. Anything that would need rounding is refused instead.

| ID | Scenario | Expected | Task | Test | Status |
|---|---|---|---|---|---|
| RND-01 | Third decimal place `10.005` | Rejected, **not** rounded to 10.01 or 10.00 | P1.2 | U | ✅ |
| RND-02 | Values that break floating-point maths when multiplied by 100: `0.29`, `1.15`, `4.35`, `1.005`, `8.20`, `19.99` | Exactly 29, 115, 435, rejected, 820, 1999 paise (string-based parsing, never `x * 100`) | P1.2 | U | ✅ |
| RND-03 | Sum of many awkward values (`0.10` × 10, `0.01` × 1000 across 100 pages) | Exactly 100 and 1000 paise | P1.4 | U (property) | ✅ |
| RND-04 | The amounts shown on a page add up to the total shown | Always, for every page: property test over random pages comparing the sum of displayed strings (parsed back) with the displayed total | P1.4 | U (property) | ✅ |
| RND-05 | Brought forward shown on page N equals the total shown on page N−1, digit for digit | Always | P1.6 | U, E | ✅ |
| RND-06 | Total in the library, pages list, editor and export for the same page | Identical strings (all from `formatPaise`) | P3.5, P5.2 | E | ✅ |
| RND-07 | Export (JPEG/PDF) | Uses the same formatted strings as the screen; no re-formatting | P5.2 | U | ✅ |
| RND-08 | Backup file | Integers only; a restore never rounds a decimal, it refuses it (RES-07) | P6.3 | U | ✅ |
| RND-09 | Code-level guard | Lint bans `parseFloat`, `toFixed` and `Math.round` in engine and data code | P0.5 | Lint | ✅ |

## 4. Carry-forward chain and recalculation

| ID | Scenario | Expected | Task | Test | Status |
|---|---|---|---|---|---|
| CHN-01 | Notebook with one page | BF 0; total = page sum | P1.6 | U | ✅ |
| CHN-02 | Edit page 1 of 50, 200, 1000 pages | Every later BF and total correct to the paisa | P1.6, P2.2 | U, R | ✅ |
| CHN-03 | Edit on page 1 pushes page 40 over the limit | Whole edit rejected; message names page 40; nothing written | P1.6, P2.2 | U, R | ✅ |
| CHN-04 | Final page whose BF changes | Total updates; "Total updated from earlier page on DD/MM/YYYY" shown | P1.6, P3.8 | U, E | ✅ |
| CHN-05 | Final page whose BF changes and then changes back to the original value | Note stays (it records that a change happened), date updated to the latest change | P1.6 | U | ✅ |
| CHN-06 | Edit that does not change any total (for example, editing a description) | No later page rewritten; `changedIds` contains only the edited page | P1.6 | U | ✅ |
| CHN-07 | Editing an amount to the same value (retyping `450` as `450.00`) | No later page rewritten; no `totalUpdatedOn` set on Final pages | P1.6 | U | ✅ |
| CHN-08 | Reopen a Final page that has "Total updated…" | Note cleared on reopen and on re-finalising (the user has now reviewed it) | P3.3 | R | ✅ |
| CHN-09 | Cached totals in the database disagree with a recomputation (bug or manual tampering) | Dev mode logs the mismatch; on load the chain is recomputed and corrected, with no silent change to amounts | arch §4.3 | R | ✅ |
| CHN-10 | Stored page has the wrong number of lines (corrupt record) | Normalised on read to exactly 10 (pad with empty lines); never drop a line with content; log it | P2.16 | R | ✅ |

### 4.1 Edits to early pages

| ID | Scenario | Expected | Task | Test | Status |
|---|---|---|---|---|---|
| CHN-11 | Page 1 edited in one tab while page 50 is open in another | Page 50's brought forward and total update live, without reload | P2.15 | E | ✅ |
| CHN-12 | Sign flipped on page 1 (`300` → `-300`) | Every later total drops by exactly 600.00 | P1.6 | U | ✅ |
| CHN-13 | Amount on page 1 changed from valid to invalid text (`450` → `45o`) | Counts as 0 from then on; every later page drops by 450.00; the line is flagged | P1.6, P2.7 | U, C | ✅ |
| CHN-14 | Amount on page 1 changed to a rejected value (`450.505`) | Nothing changes anywhere; last valid value kept | P2.7 | C | ✅ |
| CHN-15 | Fast typing on page 1 of a 200-page notebook | One recalculation per save (debounced), not per keystroke; each save within the 50 ms budget | P2.8, P7.8 | R | ➕ |
| CHN-16 | Edit page 1 when later pages are a mix: Draft, Final, Draft, Final | Every page updates; only the Final ones get "Total updated…" | P1.6 | U | ✅ |
| CHN-17 | Edit an early page, then delete a page between it and the end | Chain correct after both; renumbered pages keep their own lines | P1.7 | U | ✅ |
| CHN-18 | Edit page 1 so that a later page's total becomes exactly 0 | Shows `0.00` (not `(0.00)`); no special case | P1.6 | U | ✅ |
| CHN-19 | Reference check: chain computed by `recalculateChain` vs an independent simple loop with BigInt, over random notebooks with random edits | Identical for every page | P1.6 | U (property) | ✅ |

## 5. Page lifecycle: Final, Reopen, Delete

| ID | Scenario | Expected | Task | Test | Status |
|---|---|---|---|---|---|
| LIF-01 | Mark as Final | Confirmation; page read-only; moves to Archive; activity entry | P3.3, P3.8 | E | ✅ |
| LIF-02 | Reopen | Back to Draft; "Reopened on DD/MM/YYYY"; history keeps every reopen date | P3.3 | R, E | ✅ |
| LIF-03 | Reopen and re-finalise several times | Each reopen date kept; latest shown | P3.3 | R | ✅ |
| LIF-04 | Mark Final while an autosave is pending | Pending edit flushed first, then finalised; final page contains the last keystroke | P3.8 | C | ✅ |
| LIF-05 | Delete a Draft in the middle (page 2 of 4) | Confirmation; later pages renumber; carry-forwards recalculated | P3.3 | R, E | ✅ |
| LIF-06 | Delete page 1 | Old page 2 becomes page 1 with BF 0 | P3.3 | R | ✅ |
| LIF-07 | Delete a Draft that sits before Final pages | Final pages renumber and their totals update with "Total updated…" | P3.3 | R | ✅ |
| LIF-08 | Delete a Draft when that pushes a later total over the limit (for example the deleted page held a large refund) | Delete refused with the page named | P3.3 | R | ✅ |
| LIF-09 | Delete a Final page | Not offered in the UI; repository refuses it too | P3.3 | R | ✅ |
| LIF-10 | Delete the only page in a notebook | Not allowed; message suggests deleting the notebook instead (a notebook always has at least one page) | P3.3 | R, C | ✅ |
| LIF-11 | Default titles after renumbering | Pages with no title follow their new number ("Page 3" becomes "Page 2"); custom titles unchanged | P3.3 | R | ✅ |
| LIF-12 | Custom title that clashes, for example a page titled "Page 5" that is page 3 | Allowed; it is the user's text | P2.3 | — | ✅ |
| LIF-13 | Finalising every page | Draft section shows an empty state plus the "Add a new page" card; Archive expanded hint | P3.7 | C | ✅ |
| LIF-14 | Any code path tries to change a Final page's lines, date, title or colour (`updateLine`, `updatePageHeader`, a stale autosave arriving after Mark Final) | Repository refuses; only the chain may change its brought forward and total | P3.3 | R | ✅ |
| LIF-15 | Final page whose total was updated by an earlier page, then exported | Export shows the new total and the "Total updated…" note | P5.2 | U | ➕ |
| LIF-16 | Final page in a backup | Restores as Final with `finalisedOn`, `reopenedOn` and `totalUpdatedOn` intact | P6.4 | R | ➕ |
| LIF-17 | Final page sits last, user presses New page | New Draft page appended with BF = the Final page's total | P2.10 | E | ✅ |
| LIF-18 | Mark Final on a page with flagged (invalid) amounts | **Refused** (decided 22/11/2026): "2 amounts are not numbers. Fix them before marking this page Final." Enforced in the UI and in the repository | P3.3, P3.8 | R, C, E | ✅ decided |

## 6. Page editor: layout, input and header fields

| ID | Scenario | Expected | Task | Test | Status |
|---|---|---|---|---|---|
| EDT-01 | Amount input type | `type="text"` with `inputmode="decimal"`, never `type="number"` (which accepts `e`, changes with the mouse wheel and arrow keys, and hides invalid input from JavaScript) | P2.5 | C | ✅ |
| EDT-02 | Rejected value, then the user presses Enter | Focus stays; message stays | P2.9 | C | ✅ |
| EDT-03 | Rejected value, then the user taps elsewhere or navigates away | Field reverts to the last valid value, with a brief "Not saved: …" message | P2.7 | C | ✅ |
| EDT-04 | Intermediate states while typing: `-`, `.`, `450.`, `(` | Not flagged until blur; total uses the last valid value meanwhile | P2.7 | C | ✅ |
| EDT-05 | Description longer than 120 characters (typed or pasted) | Cut at 120 with a short notice | P2.5 | C | ✅ |
| EDT-06 | Pasting multi-line or tab-separated text (from a spreadsheet) into a description | Newlines and tabs become single spaces | P2.5 | C | ✅ |
| EDT-07 | Description with only spaces | Trimmed to empty on save | P2.8 | C | ✅ |
| EDT-08 | Emoji, Hindi, Tamil, Urdu or Arabic text in a description | Displayed with system font fallback; right-to-left text uses `dir="auto"` | P2.5, P4.3 | E | ✅ |
| EDT-09 | Date field format | Shown and typed as DD/MM/YYYY on every device. A native `<input type="date">` shows the device's locale format (MM/DD/YYYY on US-English phones), so use a text field with a DD/MM/YYYY mask plus an optional picker button | P2.5 | E | ✅ |
| EDT-10 | Invalid date typed (`31/02/2026`, `00/01/2026`, `1/1/26`) | Message under the field; previous date kept | P2.5 | C | ✅ |
| EDT-11 | Date cleared | Reverts to the previous date (a page always has a date) | P2.5 | C | ✅ |
| EDT-12 | Year far in the past or future (`01/01/1850`, `01/01/2300`) | Accepted range 01/01/1900 to 31/12/2099 | P1.8 | U | ✅ |
| EDT-13 | Title cleared | Saved as `null`; shown as "Page N" | P2.3 | C | ✅ |
| EDT-14 | Title longer than 60 characters | Cut at 60 | P2.5 | C | ✅ |
| EDT-15 | Phone keyboard covers the focused line or the total row | Focused field scrolled into view above the keyboard and editing bar | P2.11 | M | ➕ |
| EDT-16 | iPhone zooms in when an input is focused | All inputs use a font size of at least 16 px | P2.5 | M | ✅ |
| EDT-17 | Browser autofill suggests values in amount fields | `autocomplete="off"`; no autocorrect or autocapitalise on amounts | P2.5 | C | ✅ |
| EDT-18 | Page colour overridden, then notebook colour changed | Page keeps its override | P4.7 | R | ✅ |
| EDT-19 | Final page | Inputs `readOnly` (text selectable, read by screen readers); Reopen visible; no editing bar | P3.8 | C | ✅ |

## 7. Keyboard navigation and new pages

| ID | Scenario | Expected | Task | Test | Status |
|---|---|---|---|---|---|
| KBD-01 | Enter on description k | Focus moves to amount k | P2.9 | C | ✅ |
| KBD-02 | Enter on amount k (k < 10) | Focus moves to description k+1 | P2.9 | C | ✅ |
| KBD-03 | Enter on amount 10, last page | Flush save, create page, open it, focus line 1 | P2.9 | C, E | ✅ |
| KBD-04 | Enter on amount 10, a later page exists | Go to the next page, line 1; no page inserted | P2.9 | C | ✅ |
| KBD-05 | Enter on amount 10 of a page with no entries at all | No new page created (avoids accidental empty pages); short hint "Add a line before starting a new page" | P2.9 | C | ✅ |
| KBD-06 | Enter pressed twice quickly on line 10, or New page tapped twice | Exactly one new page (in-flight guard) | P2.9, P2.10 | C, E | ✅ |
| KBD-07 | Enter during IME composition (Hindi or other input methods, or Android predictive text) | Composition is committed; focus does not move (`event.isComposing` / keyCode 229 ignored) | P2.9 | C, M | ✅ |
| KBD-08 | Shift+Enter, Tab, Shift+Tab | Tab follows natural order; Shift+Enter does nothing special | P2.9 | C | ✅ |
| KBD-09 | Enter on line 10 of a Final page | Goes to the next page if one exists; never creates a page | P2.9 | C | ✅ |
| KBD-10 | Editing bar on iPhone decimal keypad (no minus, no Next) | ± toggles sign; Next ↵ behaves exactly like Enter | P2.11 | E, M | ✅ |
| KBD-11 | ± on an empty or invalid amount | Empty: inserts `-` and waits for digits. Invalid: no change | P2.11 | C | ✅ |
| KBD-12 | Physical keyboard on a tablet | Editing bar hidden (no visual viewport shrink) | P2.11 | M | ✅ |
| KBD-13 | Android keyboard without a minus key | ± on the editing bar | P2.11 | M | ✅ |

## 8. Autosave and saving

| ID | Scenario | Expected | Task | Test | Status |
|---|---|---|---|---|---|
| SAV-01 | Typing quickly | One write per 400 ms pause; indicator "Saving…" then "Saved" | P2.8 | C | ✅ |
| SAV-02 | Navigate away, background the app, or close the tab during the debounce | Flushed on blur, route change, `visibilitychange`, `pagehide` | P2.8 | E | ✅ |
| SAV-03 | Browser killed by the OS within the 400 ms window | At most the last unsaved keystrokes are lost; documented, accepted | P2.8 | — | ✅ |
| SAV-04 | Save fails (storage full, database closed) | "Couldn't save — your typing is kept on screen" with Retry; local state kept | P2.8 | C | ✅ |
| SAV-05 | Save rejected by the chain (over-limit) | Message names the page; local state kept for correction | P2.8 | C | ✅ |
| SAV-06 | Export or Mark Final with a pending save | Flush first, then act | P5.9, P3.8 | C | ➕ |
| SAV-07 | Database changes underneath the open editor (another tab, restore, recalculation from an edit elsewhere) | Brought forward updates live. Line fields take the new values only when the user has no unsaved edits on that page; otherwise see MTB-02 | P2.6 | C | ✅ |

## 9. Dates and time

| ID | Scenario | Expected | Task | Test | Status |
|---|---|---|---|---|---|
| DAT-01 | Leap years: `29/02/2028` valid, `29/02/2027` and `29/02/2100` invalid | As stated (2100 is not a leap year) | P1.8 | U | ✅ |
| DAT-02 | New page created just after midnight | Gets the new day's date | P1.8 | U | ✅ |
| DAT-03 | App left open across midnight | New pages use the current date, not one cached at start-up | P2.3 | U | ✅ |
| DAT-04 | User travels or changes time zone | Stored dates (`YYYY-MM-DD`) never shift | P1.8 | U (TZ set) | ✅ |
| DAT-05 | Device clock wrong or moved backwards | Nothing crashes; reminder maths with a negative gap shows no banner | P6.7 | U | ➕ |
| DAT-06 | Pages dated out of order (page 3 dated before page 2) | Allowed; order is by page number, never by date | P3.7 | — | ✅ |
| DAT-07 | "Newest first" in the pages list | Means highest page number first, not latest date | P3.7 | E | ✅ |
| DAT-08 | Date tests on Windows dev machines | Time zone set through the Vitest config (`env: { TZ }`), not by changing `process.env.TZ` mid-test | P1.8 | U | ✅ |

## 10. Notebooks, search and recent activity

| ID | Scenario | Expected | Task | Test | Status |
|---|---|---|---|---|---|
| NB-01 | Name empty or only spaces | Rejected: "Give the notebook a name" | P3.1 | U, C | ✅ |
| NB-02 | Name over 60 characters | Cut at 60 | P3.1 | C | ✅ |
| NB-03 | Two notebooks with the same name | Allowed (colour tells them apart) | P3.1 | R | ✅ |
| NB-04 | Name with emoji or characters unsafe in file names (`/ \ : * ?`) | Allowed; sanitised only in export file names | P3.1, P5.6 | U | ✅ |
| NB-05 | No notebooks yet | Library shows only "Add a new book" and a one-line hint; bottom-nav New page opens the create dialog | P3.4, P3.5 | E | ✅ |
| NB-06 | "New page" when the last opened notebook has been deleted | Falls back to the most recently updated notebook; if none, the create dialog | P3.4 | C | ✅ |
| NB-07 | Delete a notebook that has Final pages | Second explicit confirmation naming the number of Final pages | P3.1 | E | ✅ |
| NB-08 | Many notebooks (100+) or a notebook with 1000 pages | Library and pages list stay responsive; pages list renders lazily or in batches | P3.5, P3.7 | E (seeded) | ➕ |
| NB-09 | Deep link to a deleted notebook or a page number that no longer exists | Redirect to the library or the last page, with a short notice | P2.4 | E | ✅ |
| NB-10 | Malformed URL (`/n/xyz/p/abc`, `/n/…/p/0`, `/n/…/p/-1`) | Redirect, no crash | P2.4 | E | ✅ |
| SRC-01 | Empty or whitespace-only query | Shows all notebooks (normal library) | P3.6 | C | ✅ |
| SRC-02 | Case and accents (`cafe` finds `Café`) | Match | P1.9 | U | ✅ |
| SRC-03 | Special characters `(`, `.`, `*`, `\` | Literal text match (no regular expressions) | P1.9 | U | ✅ |
| SRC-04 | Search for an amount (`450`) | Not matched (spec: names, titles, descriptions only); empty-state text says what is searched | P3.6 | C | ✅ |
| SRC-05 | Default title "Page 3" | Matches "page 3" | P1.9 | U | ✅ |
| SRC-06 | Matches on Archived (Final) pages | Included, with a Final badge | P3.6 | E | ✅ |
| SRC-07 | Hindi or other non-Latin text | Matches after Unicode normalisation | P1.9 | U | ✅ |
| ACT-01 | Fewer than 5 entries, or none | Shows what exists; none → section hidden | P3.5 | C | ✅ |
| ACT-02 | Line edits | Do not create activity entries (only lifecycle events) | P3.2 | R | ✅ |
| ACT-03 | Notebook renamed after an entry was written | Old entry keeps the old name (pre-rendered text) | P3.2 | R | ✅ |
| ACT-04 | Entry refers to a deleted notebook or page | Shown as plain text, not a link | P3.5 | C | ✅ |
| ACT-05 | More than 200 entries | Oldest trimmed | P3.2 | R | ✅ |

## 11. Look, colours and fonts

| ID | Scenario | Expected | Task | Test | Status |
|---|---|---|---|---|---|
| LOOK-01 | Ink and secondary ink on all seven slips | ≥ 4.5:1 (lowest: lavender 8.96 and 6.65) | P4.2 | U | ✅ |
| LOOK-02 | Selected font not yet loaded, or font file fails | Falls back to a similar system stack; layout does not jump (`size-adjust` fallback) | P4.3 | E | ➕ |
| LOOK-03 | A slip font lacks `₹` or another glyph | Checked per font in P4.3; missing glyphs fall back; noted in README | P4.3 | M | ✅ |
| LOOK-04 | Device in dark mode | v1 is light only; `color-scheme: light` so form controls and scrollbars do not turn dark on paper-coloured slips | P4.8 | E (emulated) | ✅ |
| LOOK-05 | Browser zoom 200% or Android "largest" text | Layout reflows; no clipped amounts or overlapping rows | P4.8, P7.7 | E | ✅ |
| LOOK-06 | Windows High Contrast (forced colours) | Ruled lines (background gradients) disappear, so rows also get a border visible in forced colours | P4.5 | M | ➕ |
| LOOK-07 | Draft/Final shown only by colour | Never; badges always carry text | P3.7 | C | ✅ |
| LOOK-08 | Font chosen, then app reloaded | Applied before first paint, no flash | P4.10 | E | ✅ |

## 12. Export (JPEG and PDF)

| ID | Scenario | Expected | Task | Test | Status |
|---|---|---|---|---|---|
| EXP-01 | Page with all lines empty | Exports normally | P5.3 | E | ➕ |
| EXP-02 | Long descriptions | Ellipsis, same rule as on screen | P5.3 | U, E | ✅ |
| EXP-03 | Hindi, emoji, right-to-left text | Rendered with browser fallback fonts | P5.3 | E | ✅ (RTL ➕) |
| EXP-04 | Draft page exported | Shows a small "Draft" label so a recipient does not mistake it for final | P5.3 | E | ❓ |
| EXP-05 | Final page with "Reopened on" or "Total updated…" notes | Notes included in a small line under the header | P5.3 | E | ❓ |
| EXP-06 | Page colour override and chosen font | Export uses the page's effective colour and the chosen font | P5.2 | U | ✅ |
| EXP-07 | Export immediately after typing | Pending save flushed first; export matches the screen | P5.9 | E | ➕ |
| EXP-08 | Export first used while offline, before the service worker has cached the export chunk (first visit) | Clear message "Export needs one online visit first"; no crash | P5.8 | E | ➕ |
| EXP-09 | Canvas size limits on older iPhones | 2160 × 2700 PDF render (5.8 MP) stays under the iOS limit (~16.7 MP); tested on the oldest supported iPhone | P5.5 | M | ➕ |
| EXP-10 | Fonts not loaded at draw time | `document.fonts.load` awaited before drawing | P5.3 | E | ✅ |
| EXP-11 | PDF text | Real, selectable text drawn with pdf-lib, the bundled slip font and Work Sans embedded (subset). Extracted text matches the on-screen strings exactly (decided 22/11/2026) | P5.5 | U, E | ➕ |
| EXP-12 | PDF text in a script the bundled slip fonts do not cover (Hindi) | Drawn with a bundled Noto Sans Devanagari fallback, embedded the same way; characters no bundled font covers (emoji) are replaced by `?` in the PDF only, never dropped silently from the JPEG | P5.5 | U | ➕ |
| FN-01 | No title | File name uses "Page 3" | P5.6 | U | ✅ |
| FN-02 | Name/title made only of unsafe characters | Falls back to `note-add-page-<DD-MM-YYYY>` | P5.6 | U | ➕ |
| FN-03 | Windows reserved names (`CON`, `NUL`, `COM1`), trailing dots or spaces | Prefixed or trimmed so the file saves on Windows | P5.6 | U | ➕ |
| FN-04 | Very long notebook name and title | Capped at 100 characters, extension kept | P5.6 | U | ✅ |
| FN-05 | Same page exported twice | Same name; the OS adds "(1)"; no app handling needed | — | — | ➕ (note) |

## 13. Share and download

| ID | Scenario | Expected | Task | Test | Status |
|---|---|---|---|---|---|
| SHR-01 | User closes the share sheet | No error, no toast | P5.7 | U | ✅ |
| SHR-02 | `navigator.share` rejected because file preparation outlasted the tap (iPhone) | "Your file is ready" with a second-tap Share button | P5.7 | U, M | ✅ |
| SHR-03 | Share supported but not for this file type (`canShare` false for PDF on some Android browsers) | Download instead | P5.7 | U | ✅ |
| SHR-04 | Firefox for Android, desktop Firefox, older browsers | Download | P5.7 | M | ✅ |
| SHR-05 | Desktop Safari or Edge on Windows with share support | Share sheet is used (acceptable); download fallback still available | P5.7 | M | ➕ |
| SHR-06 | Installed app on iPhone (standalone), where downloads are unreliable | Share sheet always used | P5.7 | M | ➕ |
| SHR-07 | Opened inside an in-app browser (WhatsApp, Instagram, Gmail link preview) | Downloads often fail there, **and its storage is separate from Chrome/Safari**, so notes appear "lost" later. Show a banner: "Open in Chrome/Safari to keep your notes" | P7.5 | M | ➕ |

## 14. Backup and restore

| ID | Scenario | Expected | Task | Test | Status |
|---|---|---|---|---|---|
| BAK-01 | Backup with no notebooks | Button disabled with "Nothing to back up yet" | P6.6 | C | ❓ |
| BAK-02 | Backup share cancelled | `lastBackupAt` not updated | P6.2 | U | ✅ |
| BAK-03 | Backup by download (no share) | Counted as done when the download starts (the app cannot know whether it was kept) | P6.2 | U | ➕ |
| BAK-04 | Large data (1000 pages) | File of a few MB; created without freezing the screen | P6.2 | R | ➕ |
| BAK-05 | Safety backups | Never included in a backup file | P6.2 | R | ✅ |
| RES-01 | File is not JSON (PDF, image), empty (0 bytes) or very large | Rejected before parsing; size cap 20 MB; "This is not a Note-Add backup file" | P6.3 | U | ✅ (size cap and 0 bytes ➕) |
| RES-02 | JSON with a byte-order mark (file opened and saved in Notepad) | BOM stripped; restores normally | P6.3 | U | ➕ |
| RES-03 | Valid JSON, wrong `format` | Rejected with the same message | P6.3 | U | ✅ |
| RES-04 | Newer `version` | "Made by a newer version of Note-Add. Update the app and try again." | P6.3 | U | ✅ |
| RES-05 | Older `version` | Migrated, then validated | P6.3 | U | ✅ |
| RES-06 | Tampered totals | Refused (money is never silently "fixed") | P6.3 | U | ✅ |
| RES-07 | Amount as a decimal (`450.5`) or as a string (`"45050"`) | Refused (money fields are strict) | P6.3 | U | ➕ |
| RES-08 | Duplicate IDs, gaps in page numbers, a page whose notebook is missing, lines ≠ 10 | Refused, with a specific message | P6.3 | U | ✅ (duplicate IDs ➕) |
| RES-09 | Unknown colour or font ID, unknown extra fields | Cosmetic fields fall back to defaults; extra fields dropped; restore continues with a note in the summary | P6.3 | U | ➕ |
| RES-10 | Oversized strings (a 10 MB description) or very deep nesting | Refused by schema length limits | P6.3 | U | ➕ |
| RES-11 | Keys such as `__proto__` or `constructor` in the file | Ignored; schema builds fresh objects | P6.3 | U | ➕ |
| RES-12 | Restore fails part-way (forced error, storage full) | Transaction rolls back; current data untouched; message | P6.4 | R | ✅ |
| RES-13 | Restore when current data is empty | Safety backup still taken (cheap; keeps the undo path uniform) | P6.4 | R | ➕ |
| RES-14 | Undo last restore | Current (restored) data is saved as a safety backup first, so the undo can itself be undone; latest 3 kept | P6.5 | R | ❓ |
| RES-15 | `lastBackupAt` after a restore | The restored settings hold an older `lastBackupAt` (the value before that backup was made). Proposed: set it to the file's `exportedAt`. The round-trip test then compares everything except this field | P6.4 | R | ❓ |
| RES-16 | Same file restored twice | Works; two safety backups | P6.4 | R | ➕ |
| RES-17 | Restore while the editor is open in another tab | Other tabs are told to reload (see MTB-03) before any pending autosave can write into the restored data | P6.4 | E | ➕ |
| REM-01 | Has data, never backed up | Reminder after 30 days from the first data | P6.7 | U | ✅ |
| REM-02 | Data means at least one line with content (an empty notebook does not count) | As stated | P6.7 | U | ➕ |
| REM-03 | Dismissed | Hidden for 30 days | P6.7 | U | ✅ |

### 14.1 Old backups

A backup made today may be restored years from now by a much newer app. arch §9.4 sets the policy; these are its cases.

| ID | Scenario | Expected | Task | Test | Status |
|---|---|---|---|---|---|
| OLD-01 | Format v1 backup made by the real v1.0 app | Committed fixture; restores in every later release (permanent regression test) | P6.9 | R | ➕ |
| OLD-02 | Backup from a later app version that still writes format v1 (for example 1.3) | Same v1 path; restores normally | P6.9 | R | ➕ |
| OLD-03 | Format v1 restored after v2 exists | Migrated v1 → v2; fields added in v2 get their defaults | P6.9 | R | ➕ (when v2 exists) |
| OLD-04 | Migration and money | No migration changes any amount, line text, page number or status (property test over random v1 documents) | P6.9 | U (property) | ➕ |
| OLD-05 | Migrated chain | Recomputed after migration; must equal the totals in the file, or the restore is refused | P6.9 | R | ➕ |
| OLD-06 | Old backup missing a field the current schema expects (for example `totalUpdatedOn`, `reopenedOn`) | Filled with the default (`null`, `[]`) by the migration, not by the validator | P6.9 | U | ➕ |
| OLD-07 | Old backup with a font or colour ID that was later renamed or removed | Mapped to the new ID, or the default, with a note in the summary | P6.9 | U | ➕ |
| OLD-08 | A future version allows 15 lines per page | Old 10-line pages stay 10 lines; nothing is padded or merged | P6.9 | U | ➕ (when it exists) |
| OLD-09 | Format version 0, negative, or not a whole number | Refused: "This file is not a supported Note-Add backup" | P6.3 | U | ➕ |
| OLD-10 | Newer format than the app knows | Refused with "Update the app" (RES-04) | P6.3 | U | ✅ |
| OLD-11 | Restoring an old backup | Safety backup of current data first, as always; undo available | P6.4 | R | ✅ |
| OLD-12 | Old backup whose `exportedAt` is older than current data's last change | Summary warns: "This backup is older than your current notes (last changed DD/MM/YYYY)" | P6.6 | C | ➕ |
| OLD-13 | Safety backups written by an older app version, then undone in a newer one | Go through the same migration path as a user backup | P6.5 | R | ➕ |

## 15. Storage, multiple tabs and browser data

| ID | Scenario | Expected | Task | Test | Status |
|---|---|---|---|---|---|
| STO-01 | IndexedDB unavailable or blocked (some private modes, locked-down browsers) | Full-screen message "This browser can't store notes. Open Note-Add in a normal Chrome or Safari window." | P2.1 | E (mocked) | ✅ |
| STO-02 | Private or incognito window (storage wiped when closed) | Best-effort banner: "Notes in a private window are deleted when it closes" | P7.5 | M | ➕ |
| STO-03 | Storage quota exceeded on write | See SAV-04 | P2.8 | R | ✅ |
| STO-04 | `navigator.storage.persist()` denied or unsupported | Information only (Settings shows "may be cleared"); no nagging | P7.4 | U | ✅ |
| STO-05 | **iPhone: notes typed in Safari do not appear after installing to the home screen** (installed web apps get separate storage) | Install hint shown early, before data is entered; if Safari already has data, the hint says "Back up first, then restore inside the installed app" | P7.5 | M | ➕ |
| STO-06 | iPhone home-screen app removed | Its data is deleted; README warns; backup reminder covers it | P8.4 | — | ➕ (doc) |
| STO-07 | User clears browser site data | Notes gone; README and About section say backups are the only protection | P8.4 | — | ➕ (doc) |
| STO-08 | `crypto.randomUUID` or the service worker unavailable because the app is opened over plain `http://` on a LAN IP during phone testing | Test on phones through the Vercel preview (HTTPS) only; add a fallback ID generator anyway | P0.16, P2.3 | U | ✅ |
| MTB-01 | Same notebook open in two tabs or windows | Edits in one appear in the other through live queries | P2.6 | E | ✅ |
| MTB-02 | Same page edited in two tabs at once | Last write wins per line. The tab that loses shows "This page was changed in another window" and takes the new values when the user leaves the field. Never a blind overwrite of the whole page | P2.6 | E | ✅ |
| MTB-03 | Restore, undo or database upgrade in one tab while another is open | `BroadcastChannel` tells other tabs to flush and reload | P6.4, P7.1 | E | ➕ |
| MTB-04 | A new app version upgrades the database schema while an old tab is open | Old tab closes its connection on Dexie's `versionchange` and shows "Note-Add was updated — reload"; the upgrade is not blocked | P2.1 | R | ✅ |

## 16. PWA, offline, updates and accessibility

| ID | Scenario | Expected | Task | Test | Status |
|---|---|---|---|---|---|
| PWA-01 | First ever visit while offline | Impossible to load; nothing to do (browser error) | — | — | ➕ (note) |
| PWA-02 | Offline after one visit: open, create, edit, export | All work | P7.1 | E | ✅ |
| PWA-03 | New version deployed while the user is typing | Prompt only; on Reload, pending saves flush first | P7.2 | E | ✅ (flush ➕) |
| PWA-04 | Update while a page is mid-export | Reload prompt waits until export finishes | P7.2 | C | ➕ |
| PWA-05 | No browser back button in installed mode (iPhone standalone) | Every screen except the library has an in-app back control | P3.7, P3.8 | E | ✅ |
| PWA-06 | spearman.in link in About, while installed | Opens in the browser (`target="_blank" rel="noopener"`), not inside the app | P4.9 | M | ✅ |
| PWA-07 | Already installed | "Install app" button hidden; iPhone hint not shown | P7.5 | E | ✅ |
| PWA-08 | iPad reports itself as a Mac | Detected through touch support as well as the user agent | P7.5 | U | ✅ |
| PWA-09 | Hosted under `/note-add/` instead of a subdomain | Manifest scope, start URL, service worker scope and router base all follow `VITE_BASE`; e2e run once with the base set | P7.3 | E | ➕ |
| PWA-10 | Service worker install fails (storage full) | App still works online; no error shown to the user | P7.1 | — | ➕ (note) |
| A11Y-01 | Screen reader reads `(300.00)` | Accessible label "minus 300 rupees" | P2.12 | C | ✅ |
| A11Y-02 | Live total | Announced politely, throttled (not on every keystroke) | P2.12 | C | ✅ |
| A11Y-03 | New page created by Enter | Announced: "Page 4 started, brought forward 1,280.75" | P2.12 | C | ✅ |
| A11Y-04 | Invalid-amount flag | Has a text label, not just a dot | P2.7 | C | ✅ |
| A11Y-05 | Dialogs | Focus moves in, is trapped, and returns to the trigger | P3.9 | E | ✅ |
| A11Y-06 | Reduced motion | No slide or stack animations | P7.7 | E | ✅ |
| A11Y-07 | Touch targets | ≥ 44 × 44 px on every screen | P4.8 | E | ✅ |

## 17. Security and build-environment cases

| ID | Scenario | Expected | Task | Test | Status |
|---|---|---|---|---|---|
| SEC-01 | Any request to another origin | Blocked by the CSP; privacy e2e fails | P0.15, P7 | E | ✅ |
| SEC-02 | E2E tests do not see the CSP because `vite preview` does not apply `vercel.json` headers | Preview server configured with the same headers (read from `vercel.json`) so e2e runs under the real CSP | P0.8, P0.15 | E | ✅ |
| SEC-03 | Zod 4 uses `new Function` for speed, which the CSP (no `unsafe-eval`) blocks and reports | Turn on Zod's jitless mode at start-up | P6.1 | E | ➕ |
| SEC-04 | Library code needing `eval` or inline scripts (pdf-lib, PWA registration) | Checked under the CSP in e2e; PWA registers by script file | P5.5, P7.1 | E | ✅ |
| SEC-05 | User text rendered as HTML | Never; React text nodes only; canvas text is inert | arch §11 | — | ✅ |
| DEV-01 | Project path contains spaces and lives in OneDrive | All scripts quote paths; recommended move out of OneDrive (P0.0e) | P0.0e | — | ✅ |
| DEV-02 | Windows line endings (CRLF) cause Prettier and lint churn | `.gitattributes` with `* text=auto eol=lf` | P0.11 | — | ✅ |
| DEV-03 | Screenshot baselines differ between Windows and Linux font rendering | Baselines created and compared on CI Linux only (or in the Playwright Docker image) | P4, P5 | E | ✅ |
| DEV-04 | Husky hooks on Windows (Git Bash vs PowerShell) | Hook scripts written in POSIX sh, run by Git for Windows; checked once on this machine | P0.10 | M | ✅ |

---

## 18. Summary of gaps and follow-up changes

### 18.1 Decisions (❓), decided 22/11/2026

All proposed defaults below were **accepted by the owner on 22/11/2026**, with these explicit rulings:

- **MON-25:** Devanagari digits are accepted and converted to ASCII. (Full-width digits keep the proposed default and are also accepted.)
- **PST-07:** the "only" suffix `450/-` is accepted and stripped (`450/-` → 45000, `₹ 450/-` → 45000).
- **LIF-18 (changed from the proposed default):** a page **cannot** be marked Final while any amount on it is invalid (flagged). The Mark as Final button explains why and names how many amounts need fixing; the repository refuses it too.

| ID | Question | Decision |
|---|---|---|
| MON-25 | Accept Devanagari and full-width digits? | ✅ |
| PST-07 | Accept the Indian "only" suffix `450/-`? | ✅ |
| PST-13 | Split a pasted "Taxi 450" into description and amount? | ✅ |
| LIF-18 | Mark Final on a page with flagged amounts? | ✅ |
| CHN-05 | Final page total changes then changes back: keep the note? | ✅ |
| CHN-08 | Clear "Total updated…" on Reopen / re-Final? | ✅ |
| LIF-10 | Delete the only page of a notebook? | ✅ |
| EDT-03 | Rejected amount, then the user leaves the field | ✅ |
| KBD-05 | Enter on line 10 of a completely empty page | ✅ |
| DAT-07 | Meaning of "newest first" | ✅ |
| SRC-04 | Search amounts? | ✅ |
| LOOK-04 | Dark mode | ✅ |
| EXP-04 | Mark Draft pages in exports? | Yes, a small "Draft" label |
| EXP-05 | Include Reopened / Total-updated notes in exports? | Yes |
| BAK-01 | Backup with no data | Disabled with a reason |
| RES-14 | Undo creates its own safety backup? | Yes (undo is undoable) |
| RES-15 | `lastBackupAt` after restore | Set to the file's `exportedAt`; excluded from the round-trip equality check |
| MTB-02 | Same page edited in two tabs | ✅ |

### 18.2 Changes this file implied for the architecture document

**Applied on 22/11/2026** to [architecture.md](architecture.md) (§5.2, §6.4–6.6, §7.3, §9.2, §9.4, §10.4–10.5, §11) and as new tasks in [implementation-plan.md](implementation-plan.md) (P0.15a–b, P2.14–P2.17, P6.9–P6.10, P7.5a). Kept here for traceability:

1. **arch §5.2, rule 1:** do not strip all commas. Accept them only in valid Indian or Western grouping positions; anything else is invalid (MON-14, MON-16). Also accept Unicode minus and `+` (MON-13, MON-20).
2. **arch §7.3 / §7.4:** date field is a DD/MM/YYYY text input with a picker button, not a native date input (EDT-09). Amount fields are `type="text"` (EDT-01). Enter is ignored during IME composition (KBD-07).
3. **arch §6 / §7.2:** add a multi-tab policy: live updates, per-line last write wins, `BroadcastChannel` reload after restore, and Dexie `versionchange` handling (MTB-01 to MTB-04, SAV-07).
4. **arch §10.4:** extend the install hint for iPhone's separate storage between Safari and the installed app (STO-05), and add an in-app browser banner (SHR-07).
5. **arch §11:** run e2e under the real CSP headers (SEC-02); Zod jitless mode (SEC-03).
6. **arch §9.2:** byte-order mark stripping, 20 MB size cap, duplicate-ID check, strict money fields vs forgiving cosmetic fields (RES-01, RES-02, RES-07 to RES-11).

### 18.3 Tests to add to the plan (➕), grouped by phase

| Phase | IDs |
|---|---|
| 0 | SEC-02, STO-08 (preview-only device testing), DEV-02, DEV-04 |
| 1 | MON-06, 09, 13, 14, 16, 17 (`INR`), 18–22, 26, 30; PST-01–11; RND-02–05; FMT-02; TOT-01, 04, 06; CHN-01, 07, 12, 13, 16–19; DAT-01 (2100), 08; EDT-12; SRC-03, 07 |
| 2 | CHN-09, 10, 11, 14, 15; PST-04, 12, 13; EDT-01, 04–11, 14–17; KBD-06–09, 11; SAV-03 (note), 04 (quota), 06, 07; DAT-03; STO-01; MTB-01, 02, 04; A11Y-01, 03; FMT-07; TOT-03; NB-09 (notebook), 10; LIF-17 |
| 3 | LIF-03, 04, 06, 07, 08, 11, 13, 14, 18 (refuse Final while invalid); NB-03, 06, 08; SRC-01, 06; ACT-01, 02, 04; LOOK-07; PWA-05; RND-06 |
| 4 | FMT-08; EDT-08, 18; LOOK-02, 05, 06; PWA-06; DEV-03 |
| 5 | EXP-01, 03 (RTL), 07, 08, 09, 11, 12; FN-02, 03; SHR-05, 06; SAV-06; LIF-15 |
| 6 | BAK-03, 04; RES-01 (size, 0 bytes), 02, 07, 08 (duplicates), 09, 10, 11, 13, 16, 17; REM-02; DAT-05; SEC-03; MTB-03; LIF-16; OLD-01, 02, 04–07, 09, 12, 13 (OLD-03, 08 when format v2 exists) |
| 7 | STO-02, 05; SHR-07; PWA-03 (flush), 04, 09, 10; LOOK-05 |
| 8 | STO-06, 07 (README warnings) |

When an item is built and tested, change its status to ✅ in this file in the same pull request.
