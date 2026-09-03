# Track Search v2 — Global Header Overlay Plan

**Status:** Implemented — GTM workspace publication pending
**Date:** 2026-09-03  
**Goal:** Move track search out of the archive content and into the shared site header, with a responsive results overlay and a mobile-first navigation model.

## Confirmed direction

- Search is available from the shared header on every page.
- Mobile gains two peer icon controls: search and menu.
- Search uses a responsive hybrid overlay: a near-full-screen modal sheet on mobile and a compact header-aligned overlay panel on larger screens.
- The v1 static endpoint, index construction, ranking, duplicate grouping, and internal show links remain unchanged.
- The archive page no longer renders a standalone search section.
- Search funnel interactions are sent to Google Tag Manager through the existing consent-aware `window.puntersAnalytics.track()` bridge without collecting the entered search text.

## Experience brief

### Job and audience

A listener should be able to look up a remembered artist or track from anywhere on the site without first navigating to the archive. The interaction remains secondary to listening but is always one tap away.

### Outcome and proof

- Opening search immediately exposes a focused artist/title field.
- Typing at least two characters returns ranked tracks and every show appearance.
- Selecting a show result navigates directly to its existing show detail page.
- Closing search returns focus to the control that opened it.
- Mobile navigation remains available through a separate menu control and never competes with the search overlay.
- Google Analytics can measure search opens, result outcomes, result selections, errors, and close reasons while respecting the visitor's analytics consent choice.

### Structural and visual direction

- Treat search as a site utility in the header, not archive content.
- Use one bright, near-white search surface with dark legible text, existing magenta/cyan accents, existing type families, and restrained rounded edges.
- Avoid a generic command-palette appearance: keep the language music-led (`Find a record`, artist, title, show, track number) and preserve the current result hierarchy.
- On mobile, the white search sheet occupies the usable viewport beneath a compact top row and provides its own close control.
- On desktop, the same search surface appears as a bounded panel aligned visually beneath the header, with the page visible behind a subdued backdrop.

## EARS requirements

| ID | Pattern | Requirement |
| --- | --- | --- |
| SRCH2-001 | Ubiquitous | The website shall expose the track-search trigger in the shared header on every page. |
| SRCH2-002 | Event-driven | When a visitor activates the search trigger, the website shall open the search overlay and focus the search input. |
| SRCH2-003 | Event-driven | When a visitor closes the search overlay, the website shall close it and restore focus to the search trigger. |
| SRCH2-004 | State-driven | While the search overlay is open, the website shall prevent keyboard focus from moving into obscured page content. |
| SRCH2-005 | Event-driven | When a visitor presses Escape while search is open, the website shall close the search overlay. |
| SRCH2-006 | State-driven | While the viewport is below the desktop navigation breakpoint, the header shall display search and menu as peer icon buttons with at least 44 by 44 CSS-pixel targets. |
| SRCH2-007 | State-driven | While the viewport is below the desktop navigation breakpoint, primary navigation links shall be hidden until the visitor activates the menu button. |
| SRCH2-008 | State-driven | While the mobile menu is open, its trigger shall expose the expanded state and the navigation links shall be keyboard accessible. |
| SRCH2-009 | Unwanted-behaviour | If the visitor opens search while the mobile menu is open, then the website shall close the mobile menu before opening search. |
| SRCH2-010 | Unwanted-behaviour | If the visitor opens the mobile menu while search is open, then the website shall close search before opening the menu. |
| SRCH2-011 | State-driven | While the viewport is below the desktop navigation breakpoint, search shall render as a near-full-screen overlay sheet without horizontal overflow. |
| SRCH2-012 | State-driven | While the viewport is at or above the desktop navigation breakpoint, search shall render as a bounded panel visually aligned beneath the shared header. |
| SRCH2-013 | Ubiquitous | The search overlay shall use a near-white surface, dark text meeting WCAG 2.2 AA, existing accent colours, and existing small/medium radius tokens. |
| SRCH2-014 | State-driven | While the search query contains fewer than two trimmed characters, the website shall show guidance and shall not display result rows. |
| SRCH2-015 | Event-driven | When a query produces matches, the website shall display up to eight ranked tracks and every show appearance associated with each displayed track. |
| SRCH2-016 | Unwanted-behaviour | If the track index request fails, then the website shall keep the overlay operable and display a retryable error state. |
| SRCH2-017 | Event-driven | When a visitor clears search, the website shall clear the query and results while retaining focus in the input. |
| SRCH2-018 | Ubiquitous | The archive page shall not render a second in-content search interface. |
| SRCH2-019 | Optional-feature | Where JavaScript is unavailable, the website shall keep normal navigation and archive browsing usable without displaying an inert search control. |
| SRCH2-020 | Ubiquitous | Search opening, loading, result counts, empty results, errors, and closure shall be exposed to assistive technology without duplicate announcements. |
| SRCH2-021 | Event-driven | When the search overlay opens successfully, the website shall submit one `track_search_open` analytics event through `window.puntersAnalytics.track()`. |
| SRCH2-022 | Event-driven | When a distinct normalized query produces one or more results, the website shall submit one `track_search_results` analytics event for that query during the current overlay session. |
| SRCH2-023 | Event-driven | When a distinct normalized query produces no results, the website shall submit one `track_search_no_results` analytics event for that query during the current overlay session. |
| SRCH2-024 | Event-driven | When a visitor activates a show link in a search result, the website shall submit one `track_search_result_select` event before navigation. |
| SRCH2-025 | Event-driven | When loading or validating the track index fails, the website shall submit one `track_search_error` event for that failed attempt. |
| SRCH2-026 | Event-driven | When the search overlay closes, the website shall submit one `track_search_close` event containing a stable close-reason value. |
| SRCH2-027 | Ubiquitous | Search analytics events shall use the existing consent-aware analytics bridge so pending-consent events are queued, accepted-consent events are sent, and rejected-consent events are discarded. |
| SRCH2-028 | Unwanted-behaviour | The website shall not include the raw query, normalized query, artist name, song title, free text, or other user-entered content in analytics payloads. |
| SRCH2-029 | Unwanted-behaviour | If Google Tag Manager, Google Analytics, or the analytics bridge is unavailable, then search and result navigation shall continue without visible error or delay. |
| SRCH2-030 | Ubiquitous | Analytics event names and parameter values shall use the stable schema defined in this plan and shall not derive event names from content or viewport dimensions. |

## Google event tracking specification

### Transport and consent contract

- Emit events only through `window.puntersAnalytics?.track(event)`; do not call `gtag()`, push directly to `dataLayer`, or initialize another analytics client from the search component.
- The existing cookie-consent implementation remains the authority for delivery: accepted consent pushes events to `dataLayer`, pending consent queues events locally, and rejected consent drops events.
- Analytics calls are fire-and-forget and wrapped so tracking failure cannot block opening, closing, searching, or following a result link.
- Do not add a second Google Tag Manager container or GA measurement ID.
- Event payloads contain only bounded enums, counts, ranks, the selected internal show path, and track position. They never contain the search term or track metadata.

### Event schema

All event names are lower-case snake case and remain below GA4's 40-character event-name limit. Ranks are one-based integers.

| Event | Emit when | Parameters | Deduplication |
| --- | --- | --- | --- |
| `track_search_open` | `showModal()` succeeds and input focus is requested. | `search_location: "site_header"`; `trigger_variant: "icon" \| "label"` | Once per overlay opening. |
| `track_search_results` | A query of at least two normalized characters resolves with matches. | `search_location: "site_header"`; `query_length`; `query_token_count`; `result_count` | Once per distinct normalized query per overlay opening. Do not emit for stale responses. |
| `track_search_no_results` | A query of at least two normalized characters resolves with zero matches. | `search_location: "site_header"`; `query_length`; `query_token_count`; `result_count: 0` | Once per distinct normalized query per overlay opening. Do not emit for stale responses. |
| `track_search_result_select` | A rendered show-appearance link is activated. | `search_location: "site_header"`; `result_rank`; `appearance_rank`; `appearance_count`; `show_path`; `track_position` | Once per activation. |
| `track_search_error` | Index fetch, response validation, or result rendering fails. | `search_location: "site_header"`; `error_stage: "fetch" \| "validate" \| "render"` | Once per failed attempt; no exception message, URL, or status text. |
| `track_search_close` | An open dialog closes. | `search_location: "site_header"`; `close_reason: "button" \| "escape" \| "backdrop" \| "menu_opened" \| "navigation"`; `query_length`; `result_count` | Once per overlay opening, after the final state is known. |

### Parameter definitions

| Parameter | Type | Definition |
| --- | --- | --- |
| `search_location` | string enum | Always `site_header` in v2; retained to support future search placements without changing event names. |
| `trigger_variant` | string enum | `icon` for the compact mobile trigger; `label` for the wider icon-plus-label trigger. |
| `query_length` | integer | Character count of the normalized query; the query value itself is never sent. Use `0` when the dialog closes without a query. |
| `query_token_count` | integer | Count of non-empty whitespace-delimited normalized query tokens. |
| `result_count` | integer | Number of ranked track rows displayed, bounded by the existing limit of eight. |
| `result_rank` | integer | One-based rank of the selected track row in the displayed result set. |
| `appearance_rank` | integer | One-based rank of the selected show within that track row's appearance list. |
| `appearance_count` | integer | Total show appearances attached to the selected track row. |
| `show_path` | string | Existing internal path such as `/shows/the-punters-club-spring-forward/`; never a full external URL. |
| `track_position` | integer | Track number from the selected show appearance. |
| `error_stage` | string enum | Stable failure stage only; never an exception message or arbitrary error text. |
| `close_reason` | string enum | The user/system action that closed the overlay. Programmatic close paths must set this before calling `close()`. |

### Google Tag Manager and GA4 configuration

Code emission alone does not forward custom `dataLayer` events into GA4. The release therefore includes a GTM workspace change:

1. Create one Custom Event trigger matching the regular expression `^track_search_(open|results|no_results|result_select|error|close)$`.
2. Create Data Layer Variables for every parameter in the schema, using Version 2 lookup.
3. Create one GA4 Event tag that uses the incoming `{{Event}}` value as the GA4 event name and maps only the parameters defined for that event.
4. Attach the custom-event trigger to the GA4 Event tag and retain the container's existing consent checks for `analytics_storage`.
5. Register only reportable parameters as GA4 custom dimensions: `search_location`, `trigger_variant`, `show_path`, `error_stage`, and `close_reason`. Counts and ranks remain event metrics/parameters and do not require high-cardinality custom dimensions.
6. Preview the container with Tag Assistant, verify accepted/pending/rejected consent behavior, then publish the GTM container as a separately recorded release action.

Do not register query text, artist, title, or arbitrary error details as dimensions. `show_path` is bounded to the site's finite set of show routes and is acceptable as a content dimension.

## Responsive interaction specification

### Mobile: default and narrow widths

Header order:

1. Wordmark.
2. Search icon button, labelled `Search tracklists`.
3. Menu icon button, labelled `Open menu` / `Close menu` according to state.

Search overlay:

- Opens in the top layer as a modal surface.
- Uses the available dynamic viewport height and safe-area insets.
- Places `Find a record`, the close button, and the search field above a vertically scrollable result region.
- Keeps the input and close control fixed within the overlay header while long results scroll.
- Shows one result per row: artist and title first, then show links and track positions.
- Avoids nested horizontal layouts that compress long artist, track, or show titles.

Mobile menu:

- Expands from the shared header as a simple navigation region, not a second modal.
- Contains Archive, Playlists, About, and Listen now.
- Closes after a navigation link is activated and when Escape is pressed.

### Desktop and wider widths

Header order:

1. Wordmark.
2. Primary navigation links.
3. Search trigger with icon and visible `Search` label.
4. Existing `Listen now` action.

Search overlay:

- Uses the top layer with a subdued backdrop.
- Appears as a near-white rounded panel below and visually aligned with the header's content width.
- Has a bounded height; only the result region scrolls.
- Uses a two-column result row where space permits: track identity on the left and show appearances on the right.
- Closes through the close button, Escape, or backdrop interaction.

### Breakpoint policy

Use the existing token scale and establish one navigation breakpoint based on content fit, expected near the existing 768px archive breakpoint. Do not add multiple device-specific breakpoints unless browser verification demonstrates a real overflow defect.

## Component and behavior design

### Shared header composition

Refactor `AppHeader.astro` into three responsibilities:

- static wordmark and primary navigation;
- mobile menu trigger/state;
- global search trigger and overlay through the renamed search component.

The header remains server-rendered. JavaScript enhances the two controls after load. Search and menu triggers must be hidden when their corresponding behavior cannot initialize, preventing dead controls under script failure or no-JavaScript browsing.

### Search component

Rename `TrackSearch.astro` to `SiteSearch.astro` because it becomes a global utility. The component shall own:

- the search trigger appropriate to desktop and mobile presentation;
- one native modal `<dialog>` search overlay;
- input, clear, close, status, loading, empty, error, and results markup;
- lazy loading and reuse of `/api/tracks.json`;
- result rendering through DOM APIs that assign text with `textContent`;
- focus placement, focus return, Escape behavior, and backdrop close behavior;
- cancellation/race protection so stale asynchronous results cannot overwrite a newer query or a closed overlay.
- consent-aware event emission using the stable Google event schema in this plan, including per-open query-outcome deduplication.

Use the native dialog top layer rather than an absolutely positioned dropdown inside the header. This avoids clipping and stacking-context failures caused by the header backdrop filter and guarantees modal focus behavior on mobile. Desktop positioning is visual alignment to the header rather than reliance on experimental CSS anchor positioning.

### Mobile menu behavior

Keep mobile-menu logic in `AppHeader.astro` unless implementation shows meaningful reuse elsewhere. Use a button with `aria-controls` and `aria-expanded`; do not use a checkbox hack. The search component and menu shall communicate through small custom events or a shared header-level coordinator so only one surface can be open at a time.

### Icons

Use `astro-icon` and extend the existing Lucide allow-list with `search`, `menu`, and `x`. Icons are decorative inside correctly labelled buttons and therefore receive no duplicate accessible name.

## Visual system additions

Add semantic light-overlay tokens in `tokens.css` rather than scattering literal colours through component styles:

- overlay surface: neutral near-white;
- overlay surface-muted: subtle neutral for hover/selected rows;
- overlay ink: dark violet-neutral related to the current paper hue;
- overlay ink-muted: AA-compliant secondary text;
- overlay rule: quiet divider;
- existing magenta accent and cyan alternate accent remain action/link/focus colours where contrast permits.

The panel uses `--radius-md` or `--radius-lg`; result rows remain rails separated by rules rather than individual cards. No glass effect, gradient, nested cards, or oversized rounding is introduced.

## Implementation phases

### Phase 1 — Header shell and semantic tokens

**Files:**

- Modify `src/styles/tokens.css`.
- Modify `astro.config.mjs`.
- Modify `src/components/AppHeader.astro`.
- Modify the header/navigation sections of `src/styles/global.css`.

**Tasks:**

1. Add semantic light-overlay tokens with verified normal, muted, link, hover, and focus contrast.
2. Add Lucide `search`, `menu`, and `x` to the icon integration allow-list.
3. Change the mobile header to a single compact row with wordmark, search trigger slot, and menu button.
4. Move primary links and `Listen now` into the mobile disclosure region while preserving the current desktop navigation order.
5. Add the menu state script with expanded-state synchronization, Escape handling, focus return, link-activation close, and mutual exclusion hooks for search.
6. Ensure the desktop header retains the current nocturnal shell and does not increase page-content width.

**Completion criteria:**

- At 320px width, the wordmark and both 44px icon targets fit without wrapping or horizontal scrolling.
- At the desktop breakpoint, the hamburger is absent and all primary actions fit on one row.
- With JavaScript disabled, ordinary navigation remains visible and usable in a non-collapsed fallback.

### Phase 2 — Convert archive search into global overlay

**Files:**

- Rename `src/components/TrackSearch.astro` to `src/components/SiteSearch.astro`.
- Modify `src/components/AppHeader.astro`.
- Modify search sections of `src/styles/global.css`.
- Modify `src/pages/shows/index.astro`.
- Add `src/lib/search-analytics.ts`.
- Add `src/lib/search-analytics.test.ts`.

**Tasks:**

1. Remove the `TrackSearch` import and in-content render from the archive page.
2. Mount `SiteSearch` from the shared header so one instance exists on every route.
3. Replace the in-flow `<section>` shell with a labelled search trigger and modal `<dialog>`.
4. Preserve v1 lazy endpoint loading, search ranking, grouping, safe DOM rendering, clear behavior, result limit, and show links.
5. Add explicit open/close state, initial input focus, trigger focus restoration, backdrop close, and dynamic-viewport sizing.
6. Keep stale fetch/search completions from updating a closed dialog or superseded query.
7. Replace archive-specific search class names with site-search names and remove dead archive search rules.
8. Implement mobile stacked result rails and the desktop two-column result layout.
9. Add typed, side-effect-free builders for the six search analytics event payloads so event names, bounded enum values, ranks, counts, privacy exclusions, and close reasons are independently testable.
10. Emit analytics through the optional existing `window.puntersAnalytics.track()` bridge at the lifecycle points defined in the event specification.
11. Reset query-outcome deduplication when a new overlay session opens; suppress events from stale asynchronous responses.

**Completion criteria:**

- Search opens from every route that uses `PuntersLayout`.
- The archive contains no in-content `Find a record` section.
- Mobile and desktop use the same semantic dialog and result data, differing only in responsive composition.
- The endpoint is fetched only after first search interaction and reused for the page lifetime.
- Search continues normally when the analytics bridge is absent or throws.
- No emitted event contains raw or normalized query text, artist, title, or arbitrary error details.

### Phase 3 — Accessibility, regression coverage, and responsive verification

**Files:**

- Modify `src/lib/track-search.test.ts` only if behavior-domain coverage needs extension.
- Add `src/lib/site-search-html.test.ts` for static markup contracts if the component remains practical to inspect as source/output.
- Modify `docs/decisions/001-static-track-search.md` only to note that the client-side consumer moved from archive content into the shared header; do not replace the accepted endpoint decision.

**Tasks:**

1. Test that v1 index construction and ranking remain unchanged.
2. Add regression checks for one global search trigger, one labelled dialog, one close control, and removal from archive content.
3. Verify keyboard flow: trigger → input → results → show link; Escape closes; focus returns to trigger.
4. Verify screen-reader state: trigger label, dialog name, loading message, result count, empty message, and error message.
5. Verify mutual exclusion between mobile menu and search.
6. Unit-test exact analytics event names and payloads, one-based ranks, query length/token counts, bounded enums, and the absence of prohibited content fields.
7. Verify each query outcome is emitted once per distinct normalized query per overlay opening and stale responses emit nothing.
8. Verify accepted consent sends to `dataLayer`, pending consent queues, rejected consent discards, and a missing/throwing analytics bridge does not affect search.
9. Verify responsive layouts at 320px, 375px, 768px, and 1280px, including long real artist/title/show strings.
10. Verify 200% text zoom, reduced motion, touch targets, dynamic mobile viewport height, and no horizontal overflow.
11. Run `pnpm run test`, `pnpm run typecheck`, changed-file Biome checks, and `pnpm run build`.
12. Browser-test the built site on the home, archive, and one show-detail route at mobile and desktop widths.
13. Use GTM Preview and GA4 DebugView to verify all six events and their mapped parameters after analytics consent is accepted.
14. Verify no search event reaches GA4 after analytics consent is rejected and queued pending-consent events are discarded on rejection.

**Completion criteria:**

- Tests, typecheck, and production build pass.
- No changed-file lint errors are introduced.
- The modal traps focus through native dialog behavior and restores focus on every close path.
- Search results remain readable and operable with the longest current content at all target widths.
- Search analytics follow the specified schema, contain no query text, and obey all three consent states.

### Phase 4 — Google Tag Manager release configuration

**External configuration:**

- Modify the existing Google Tag Manager container referenced by `ANALYTICS.gtmContainerId`.
- Do not modify or create another container.

**Tasks:**

1. Add the Custom Event trigger, Data Layer Variables, and GA4 Event tag defined in the Google event tracking specification.
2. Confirm the tag inherits the existing `analytics_storage` consent requirement.
3. Validate event names and parameters in Tag Assistant and GA4 DebugView using a non-production preview session.
4. Publish the GTM container only after the code deployment exposing the events is available for validation.
5. Record the GTM container version and publication date in the implementation completion notes.

**Completion criteria:**

- All six specified events appear in GA4 DebugView after accepted consent.
- No search event is transmitted after rejected consent.
- No GA4 event parameter contains entered query text, artist, title, external URL, or exception text.

## Files expected to change

- `src/components/AppHeader.astro` — responsive header, menu control, and global search mount.
- `src/components/TrackSearch.astro` → `src/components/SiteSearch.astro` — trigger, dialog, and search interaction.
- `src/pages/shows/index.astro` — remove archive-level search import and render.
- `src/styles/tokens.css` — semantic light-overlay colours.
- `src/styles/global.css` — header, mobile menu, dialog, result rails, and responsive layouts.
- `astro.config.mjs` — search/menu/close icon allow-list.
- `src/lib/track-search.test.ts` — only if existing domain assertions require extension.
- `src/lib/search-analytics.ts` — typed event names, payloads, and pure event builders.
- `src/lib/search-analytics.test.ts` — analytics schema, rank/count, enum, and privacy regression coverage.
- `src/lib/site-search-html.test.ts` — static integration contract.
- `docs/decisions/001-static-track-search.md` — short consumer-location consequence update.
- Existing Google Tag Manager container — custom-event trigger, data-layer variables, GA4 event tag, and consent-aware publication.

## Explicitly unchanged

- `src/pages/api/tracks.json.ts` endpoint path and response format.
- `src/lib/track-search.ts` matching, normalization, ranking, and eight-result limit unless a regression is discovered.
- Generated show data and enrichment scripts.
- Show detail routes and result destinations.
- Cookie-consent storage, queue, grant/deny behavior, GTM container identity, archive sorting, homepage content, and Mixcloud playback. Search v2 consumes the existing analytics bridge but does not redesign it.
- No Vue, React, or other client framework is introduced.

## Risks and mitigations

- **Header overcrowding:** use a single fit-driven breakpoint and verify with the real wordmark/action labels, not device assumptions.
- **Dialog positioning differences:** depend on native top-layer and focus behavior; use ordinary viewport-relative desktop alignment rather than experimental anchor positioning.
- **White panel contrast drift:** define semantic overlay tokens and verify all text/link/focus combinations against the actual surface.
- **Two competing disclosures:** coordinate search and mobile menu so opening either closes the other.
- **No-JavaScript dead controls:** keep ordinary links available and reveal enhancement-only triggers only after successful initialization.
- **Long result sets on mobile:** keep the overlay header fixed and make only the result region scroll with dynamic viewport and safe-area constraints.
- **Stale asynchronous updates:** compare active query/open state before rendering and ignore superseded responses.
- **Accidental collection of entered text:** build analytics payloads through typed allow-list builders and test that query, artist, title, and error-message fields cannot appear.
- **Analytics event inflation:** emit outcome events once per distinct normalized query per overlay opening and never on every keypress.
- **GTM/code deployment drift:** treat container configuration as a release phase, validate in Preview/DebugView, and record the published container version.
- **Consent regression:** route exclusively through `puntersAnalytics.track()` and test accepted, pending, and rejected states rather than pushing directly to `dataLayer`.

## Review decisions locked for implementation

- Global shared-header placement: **yes**.
- Introduce mobile hamburger beside search: **yes**.
- Mobile modal plus desktop header-aligned overlay: **yes**.
- Preserve static endpoint/client filtering architecture: **yes**.
- Add consent-aware Google search funnel events without query text: **yes**.
- Add a client UI framework: **no**.

No implementation should begin until this plan is approved or corrected.
