# Accessibility Audit: The Punters' Club

**Date:** 2026-06-30  
**Project:** Punters' Club · Internet Radio Show  
**Scope:** Static Astro site accessibility pass focused on WCAG 2.2 AA risks.

## Verification

- `rtk npx astro build` passed.
- `rtk npm run build` was blocked by the sandbox because `tsx` could not open its IPC pipe during the enrichment step.
- Browser-level Playwright checks could not run because the Chromium binary is not installed in this environment.
- Contrast was checked numerically against the declared OKLCH tokens.

## Findings

### Medium - Small Mobile Navigation Targets

**Files:** `src/styles/global.css`

The nav links have no stable vertical hit-area padding and are reduced to `--text-xs` on very small screens. Their effective target height can fall below WCAG 2.2 AA target-size expectations, especially inside the `max-width: 414px` media query.

**Impact:** Keyboard, touch, and motor-impaired users may have a harder time activating navigation links on mobile.

**WCAG/Standard:** WCAG 2.2 AA, Target Size (Minimum) 2.5.8.

**Recommendation:** Give `.nav-links a` a stable target area, such as `min-height: 2.75rem`, or at least `min-height: 24px` with vertical padding. Avoid shrinking nav link text and target size together on the smallest breakpoint.

**Suggested command:** `$impeccable adapt`

### Medium - No Keyboard-Visible Skip Link

**File:** `src/layouts/PuntersLayout.astro`

The page has a valid `<main>` landmark, but keyboard users still tab through the sticky navigation before reaching the page content. A visible-on-focus "Skip to content" link would make bypassing repeated navigation explicit.

**Impact:** Keyboard and switch users have extra repeated tab stops before the primary content.

**WCAG/Standard:** WCAG 2.4.1 Bypass Blocks.

**Recommendation:** Add a `.skip-link` before `<AppHeader />` pointing to `#top`, styled off-screen by default and visible on focus.

**Suggested command:** `$impeccable harden`

### Low - Repeated Generic External Link Labels

**Files:** `src/components/PlaylistGrid.astro`, `src/components/LatestShow.astro`

Links such as "Open playlist" and "Open on Mixcloud" rely on surrounding visual context. In screen-reader link lists, these labels are less clear than contextual accessible names.

**Impact:** Screen-reader users may need extra navigation to understand which show or playlist a link opens.

**WCAG/Standard:** WCAG 2.4.4 Link Purpose (In Context).

**Recommendation:** Add contextual accessible names, for example 

```plaintext
aria-label={/`Open ${playlist.title} on Spotify/`}`
```

and

```plaintext
aria-label={/`Open ${show.title} on Mixcloud`}
```

**Suggested command:** `$impeccable clarify`

### Low - New-Tab Behavior Is Not Announced

**Files:** `src/components/ShowArchive.astro`, `src/components/PlaylistGrid.astro`, `src/components/LatestShow.astro`, `src/components/AppFooter.astro`

Most outbound links use `target="_blank"` but do not tell users they open a new tab/window.

**Impact:** Screen-reader and keyboard users may experience an unexpected context change.

**WCAG/Standard:** WCAG 3.2.5 Change on Request advisory pattern; general accessible-link usability.

**Recommendation:** Either avoid opening new tabs or include concise accessible text/labels such as "opens in a new tab."

**Suggested command:** `$impeccable clarify`

## Passed Checks

- The page has a single `<main>` landmark.
- Primary sections use labelled headings.
- The Mixcloud iframe has a descriptive `title`.
- Decorative artwork uses empty `alt=""` or `aria-hidden="true"`.
- The archive disclosure has a no-JavaScript fallback.
- Reduced-motion handling exists in CSS.
- Token contrast is comfortably above WCAG AA for tested text/background combinations:
  - `ink` on `paper`: 15.60:1
  - `muted` on `paper`: 9.25:1
  - `muted` on `paper-2`: 8.38:1
  - `muted` on `paper-3`: 7.32:1
  - `accent` on `paper`: 8.29:1
  - `accent` on `paper-2`: 7.51:1
  - `accent` on `paper-3`: 6.56:1
  - `paper` on `accent`: 8.29:1
  - `paper` on `accent-alt`: 9.20:1
  - `focus` on `paper-2`: 9.20:1

## Recommended Order

1. Add the skip link.
2. Stabilize mobile nav target sizes.
3. Add contextual labels to repeated outbound links.
4. Decide whether external links should open in new tabs; if yes, announce that behavior.
