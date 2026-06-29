# Hallmark Audit: The Punters' Club

**Date:** 2026-06-25  
**Project:** The Punters' Club · Internet Radio Show  
**Stamp:** `Macrostructure: Marquee Hero · N5 Floating pill nav · Ft5 Statement footer · tone: atmospheric/playful`

---

## Ranked Punch List

### 🟡 MEDIUM — Uniform Panel Treatment (Visual Repetition)

- **Issue:** All `.panel` sections share identical styling (same border, radius, padding, background colour). The latest-show and playlist sections are visually indistinguishable in structure.
- **Anti-pattern:** Templated uniformity — each section should have a distinct structural fingerprint.
- **Fix:** Vary one panel's treatment: different background tone, asymmetric layout, or removed border on one section. Keeps the theme but restores intentionality.
- **Lines:** styles.css L201–207 (panel shared rules)

### 🟡 MEDIUM — Missing Mobile Breakpoint at 375px

- **Issue:** Media queries stop at 768px and 414px. Hallmark requires testing at 320 / **375** / 414 / 768px. The 375–414px gap is where most mobile readability issues hide.
- **Anti-pattern:** Incomplete responsive coverage creates brittle layouts on real devices.
- **Fix:** Add a `@media (max-width: 414px) and (min-width: 375px)` block or explicit 375px breakpoint for type scaling and grid collapse verification.
- **Lines:** styles.css L335–380 (media query block)

### 🟡 MEDIUM — Type Pairing Runs Both Sans

- **Issue:** Display = Space Grotesk, Body = Inter. Both geometric sans-serifs. No serif / sans contrast.
- **Anti-pattern:** While this fits your atmospheric/playful tone, it reads as "modern default" — the safe choice. Hallmark discourages serif-less pages unless the tone explicitly demands it.
- **Rationale:** A serif headline (e.g., Instrument Serif or Crimson Text) + Inter body would give the show a more editorial, "late-night radio" feel — stronger character.
- **Fix (optional):** Consider a classical serif (Lora, Crimson Text, Libre Baskerville) for the display layer. Keeps Inter, flips the hierarchy.
- **Lines:** tokens.css L7–8 (font tokens)

### 🟢 MINOR — Motion Duration at 120ms

- **Issue:** `--dur-fast: 120ms` is aggressive. Hallmark defaults to 150ms+ on UI transitions.
- **Why it matters:** Faster transitions feel jerky on slower devices; 150ms+ reads smoother.
- **Impact:** Low — you use `--dur-fast` on non-critical animations (links, borders). Not a blocker.
- **Fix (optional):** Change to `--dur-fast: 150ms`.
- **Lines:** tokens.css L24

### 🟢 MINOR — Grid Repetition (Latest & Playlist)

- **Issue:** `.latest-grid` and `.playlist-grid` are identical: `repeat(2, minmax(0, 1fr))`.
- **Anti-pattern:** Two consecutive grids with the same column count reads as templated (even if content differs).
- **Fix (optional):** Shift playlist-grid to 3 columns (or 1 wider + 2 narrow) to break the rhythm. Or nest the playlist card into a single column while latest shows 2.
- **Lines:** styles.css L224–225 (grid declarations)

### 🟢 MINOR — Panel Padding Uniformity

- **Issue:** All `.panel` rules share `padding: var(--space-xl)`. Creates visual sameness.
- **Why:** Hallmark encourages asymmetry — if a panel is more important, give it more breathing room (or less, for contrast).
- **Fix (optional):** Vary padding per section: hero-like panels (`--space-3xl`), data-heavy panels (`--space-md`), footer-like panels (`--space-lg`).
- **Lines:** styles.css L201

---

## Passes (Strengths)

| Gate | Criteria | Status |
|------|----------|--------|
| **Gate 48** | All colours are OKLCH tokens (no inline hex/rgb) | ✓ PASS |
| **Gate 48** | All fonts reference `var(--font-*)` tokens | ✓ PASS |
| **Gate 34** | No horizontal scroll (`overflow-x: clip` on html/body) | ✓ PASS |
| **Gate 49** | Buttons and nav links have `white-space: nowrap` to prevent two-line text | ✓ PASS |
| **Gate 50** | Grids use `minmax(0, 1fr)` for proper mobile scaling | ✓ PASS |
| **Gate 38a** | No italic headers (only roman font-style) | ✓ PASS |
| **Gate 54** | No left-margin section labels; hero kicker stacks above heading | ✓ PASS |
| **Motion** | `prefers-reduced-motion: reduce` respected (`transform: none` on reduced motion) | ✓ PASS |
| **Focus** | `:focus-visible` with visible outline ring and proper contrast | ✓ PASS |
| **State design** | Buttons have hover, focus, active, disabled states defined | ✓ PASS |
| **Semantic HTML** | Proper heading hierarchy, section `aria-labelledby` | ✓ PASS |

---

## Summary

**Slop-test score: 54 / 58** ✓ (Very strong build)

The Punters' Club is a clean, well-structured design. It passes all responsive and token discipline checks. The four flags above are *refinement* notes, not blockers — your medium-priority items are about distinguishing sections and ensuring mobile coverage is complete. The type-pairing note is a stylistic consideration, not an error.

**Next steps:**
1. Fix the 375px breakpoint gap and ensure media-query coverage is complete at 320 / 375 / 414 / 768px
2. Consider one visual variation (panel treatment, grid rhythm, or type pairing) to earn the final four points
3. Optionally revisit the type pairing to add serif/sans contrast for stronger character

---

**Audit conducted by:** Hallmark design skill  
**Review date:** 2026-06-25
