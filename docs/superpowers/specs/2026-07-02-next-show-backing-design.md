# Next Show — Backing Design

- **Date:** 2026-07-02
- **Status:** Approved (design), oracle-reviewed (2026-07-02)
- **Issue:** https://github.com/samcarrington/punters-club/issues/3
- **Scope:** The *data backing* for a "next show" module — config, enrichment script, generated data contract, scheduled refresh workflow, and a minimal consuming component. **Out of scope (explicit future TODOs):** visual/UX design of the card and its placement/page UI.

## Problem

The homepage needs a "next show" module. Show scheduling lives on the Radio Waters WordPress site (The Events Calendar plugin, `tribe_events`), which we do not control. Shows are ad-hoc, roughly monthly. We must populate the card with accurate data without abusing the station's API, and without the ability to edit their source.

An edge case: sometimes the club appears as a **guest** on another show (e.g. `Saturday Night In With…` on 2026-07-04) whose title does not contain "Punter's Club".

## Decisions (locked)

1. **Source of truth = the station's Events Calendar REST API** (scrape-first). The site reads a single committed generated JSON file produced from it, mirroring the existing `enrich-shows` / `enrich-playlists` pattern.
2. **Named shows are discovered by title match**; **guest slots are identified manually** by a small committed override list (they cannot be title-matched).
3. **Refresh is a scheduled GitHub Action that opens a PR** you approve. Nothing goes live without a human merge. Merge → Vercel deploys.
4. **Do not add a runtime/agent dependency** (no Eve, no Bluesky ingestion). The Bluesky-signal sketch is set aside; the API is a cleaner, human-approvable source.

## Upstream API contract (verified)

Endpoint (The Events Calendar REST API, plugin ≥ 6.0.0):

```
GET https://www.radiowaters.co.uk/wp-json/tribe/events/v1/events
```

Verified against a live probe and the official docs (docs.theeventscalendar.com/rest-endpoints):

- Public read, **no auth** required for published upcoming events.
- Default order is **ascending by start date** (`orderby = date, ID; order = ASC`) → `start_date=<today>&per_page=1` yields the soonest upcoming event.
- Params used: `start_date` (events starting after), `end_date` (events starting before), `per_page` (**max 50**), `page`, `search` (title or description).
- Envelope: `{ events, total, total_pages, rest_url, next_rest_url, previous_rest_url }`.
- Per-event fields used: `title`, `slug`, `url`, `start_date`, `end_date`, `timezone`, `utc_start_date`, `utc_end_date`, `description`, `excerpt`, `image` (`image.url`), `categories`, `tags`.
- Guest slot `saturday-night-in-with` for 2026-07-04 **is present** in this API with correct `Europe/London` (BST) times, resolvable via date filter or `/events/by-slug/{slug}`.
- **No official rate-limit or caching policy** is documented. We stay polite by design: build-time enrichment + one daily scheduled poll only.

## Files

| File | Role |
| --- | --- |
| `src/data/next-show-config.json` | Committed, human-edited config: title patterns, guest overrides, lookahead. |
| `src/lib/next-show.ts` | Shared types + pure helpers (normalize event, match, select). |
| `scripts/enrich-next-show.ts` | Fetch → filter → select soonest → write generated JSON, with resilient fallback. |
| `src/data/next-show.generated.json` | The single resolved record the site reads at build. |
| `src/components/NextShow.astro` | Minimal consumer of the generated JSON (visual design deferred — see TODO). |
| `.github/workflows/next-show-refresh.yml` | Daily scheduled refresh that opens/updates a PR on change. |

## Config contract — `next-show-config.json`

```json
{
  "endpoint": "https://www.radiowaters.co.uk/wp-json/tribe/events/v1/events",
  "titlePatterns": ["punters?['’]?\\s+club"],
  "guestAppearances": [{ "slug": "saturday-night-in-with", "date": "2026-07-04" }],
  "lookaheadDays": 60
}
```

- `titlePatterns`: case-insensitive regex fragments applied to the **HTML-decoded** event `title` (the API returns entity-encoded titles, e.g. `The Punters&#8217; Club` → decode to `The Punters' Club` first). The pattern must tolerate a straight or curly apostrophe positioned after the `s` — verified live against `The Punters' Club – Summer Holiday Sounds` (2026-08-22). Matches are "our" named shows.
- `guestAppearances`: **slug + date pairs**. A bare slug is unsafe because guest shows like `saturday-night-in-with` are *recurring station shows* — verified live: that slug appears twice in August 2026 alone (Aug 1 and Aug 29). Only the specific dated instance is us. Each entry is resolved to that exact date and its slug is verified before inclusion.
- `lookaheadDays`: how far ahead to scan (bounds pagination; a month is comfortably < 50 events — August 2026 returned 28 on a single page — but paginate defensively).

## Generated data contract — `next-show.generated.json`

```json
{
  "status": "upcoming",
  "show": {
    "title": "Saturday Night In With…",
    "slug": "saturday-night-in-with",
    "url": "https://www.radiowaters.co.uk/show/saturday-night-in-with/2026-07-04/",
    "startsAtUtc": "2026-07-04T18:00:00Z",
    "endsAtUtc": "2026-07-04T20:00:00Z",
    "timezone": "Europe/London",
    "description": "…plain text, HTML stripped…",
    "posterUrl": "https://…/image.jpg",
    "matchedBy": "guest"
  },
  "source": "tribe/events/v1"
}
```

- **No `generatedAt` / run timestamp in this file.** A per-run timestamp would produce a diff on every scheduled run and make the bot open a PR daily even when the show hasn't changed — defeating the approval model. The file is only rewritten when `status`/`show` change **semantically**. Run time belongs in CI logs / the PR body, not the committed artifact. (The script should compare against the existing file and skip the write when semantically unchanged.)
- `status`: `"upcoming"` or `"none"`. `"none"` means **"no verified upcoming qualifying show available right now"** — it is *not* an error signal. Upstream-unavailable-with-no-usable-fallback is logged in CI, not encoded as a distinct JSON state; empty-state copy stays neutral either way.
- **Time:** `startsAtUtc` (UTC) is canonical; `timezone` is the IANA zone for display. Format at build via `Intl.DateTimeFormat('en-GB', { timeZone })` so BST/GMT is always correct.
- `description`: **plain text, HTML stripped at enrich time.** The WP `description`/`excerpt` are HTML-capable; we normalize to a text excerpt and never carry third-party HTML into the artifact (avoids a future XSS/formatting footgun). If rich formatting is ever wanted, add an explicit sanitizer first.
- `matchedBy`: `"title"` (named show) or `"guest"` (override) — useful for later UI/debugging and audit.

## Selection logic (`enrich-next-show.ts`)

1. **One bounded fetch:** `?start_date=<today>&end_date=<today + lookaheadDays>&per_page=50` (paginate only if `total_pages > 1`; expected: 1 page). Both title matches and guest overrides are resolved from this single event set — no per-override extra requests.
2. Build the candidate set from that event set (**HTML-decode `title` first** — the API returns entity-encoded titles):
   - events whose decoded `title` matches any `titlePatterns` → `matchedBy: "title"`.
   - events matching a `guestAppearances` entry (`slug` equals the override slug **and** the event's local start date equals the override `date`) → `matchedBy: "guest"`.
3. For each candidate, resolve the canonical UTC start:
   - use `utc_start_date` when present and valid;
   - else derive from `start_date` + `timezone`;
   - else **discard the event and log a warning** (never guess).
   - Validate `timezone` is a real IANA zone before trusting it for display.
4. **Dedupe** by a stable key (`slug` + `utc_start_date`, or `url`) so a show matched by both title and a guest entry appears once.
5. Drop past events (`utc_start_date` < now), sort ascending by `utc_start_date` with a deterministic tiebreaker (e.g. `slug`), take the first.
6. Normalize the chosen event: **HTML-decode the `title`** and strip HTML + decode entities from `description`/`excerpt` to a plain-text excerpt. Store decoded plain text only.
7. Write `{ status: "upcoming", show }` or `{ status: "none" }` — **but only if it differs semantically from the existing file** (skip the write otherwise, so no-op runs produce no diff).
8. **Resilience:** on any fetch/parse failure, fall back to the previous `next-show.generated.json` (like `enrich-shows.ts`) rather than emitting `none`, so a transient upstream blip never blanks the card. **If the fallback record is itself now past, emit `none`** (a stale past show must not be shown as "next").
9. **Unresolved guest overrides:** if a configured `guestAppearances` entry whose `date` is within `lookaheadDays` does not resolve to an event, surface it in the CI/PR summary so the reviewer can tell "calendar changed/moved" apart from "genuinely no show".

## Build wiring

Extend the existing chain in `package.json`:

```jsonc
"enrich:next-show": "tsx scripts/enrich-next-show.ts",
"enrich": "pnpm run enrich:shows && pnpm run enrich:playlists && pnpm run enrich:next-show",
```

`pnpm run build` (`enrich && astro build`) then always refreshes the card at build time. Per repo AGENTS.md, UI-only work should keep using `pnpm exec astro build` to avoid churning generated metadata.

## Scheduled refresh + approval

`.github/workflows/next-show-refresh.yml`:

- Trigger: daily cron (e.g. `0 7 * * *`) + `workflow_dispatch`.
- Steps: checkout → pnpm/corepack setup → install → `pnpm run enrich:next-show`.
- If `git diff --quiet src/data/next-show.generated.json` reports a change, open/update **one durable bot branch/PR** (e.g. `bot/next-show`) with the diff (e.g. `peter-evans/create-pull-request`, which reuses a fixed branch by design). The PR body carries the run timestamp and any **unresolved guest-override** warnings from the enrich step.
- Because the script skips no-op writes (semantic-diff only), scheduled runs with no change produce no branch churn; if a previously-open diff resolves back to no-change, the action closes/no-ops the PR.
- Human merges the PR → Vercel deploys `main`. Guest slots are added by editing `next-show-config.json` in that same PR when needed.

**Drift is handled implicitly:** regeneration drops a now-past show (step 5) and reflects any new calendar entry, so "next show date is past" and "committed data no longer matches the calendar" both surface as a semantic diff → PR. A show going past while a PR sits unmerged simply updates the same PR on the next run.

## Politeness / safety

- Request volume: 1 build-time call + 1 daily scheduled call (each ~1 page). Negligible load.
- No credentials, no crawling, no loops beyond bounded pagination.
- Endpoint, patterns, and overrides are all committed and reviewable.

## Non-goals

- No SSR / runtime fetch of station data (keep static output on Vercel).
- No Eve / Bluesky agent dependency.
- No attempt to reconstruct the station's month-grid UI; we only need the soonest upcoming show.
- No fully-automatic publish; every change is human-approved via PR.

## Explicit future TODOs (separate work)

- **[design-001] NextShow card visual/UX design** — fit the card into the site's band/rail/asymmetry design language (per PRODUCT.md), including poster treatment, date/time formatting, guest-appearance affordance, and the `status: "none"` empty state. Route to @designer.
- **[design-002] Homepage placement & page UI/UX** — where the module sits relative to latest show / archive, and how it affects `src/pages/index.astro` ordering and structured data. Route to @designer, then reconcile JSON-LD.

## Open questions for implementation

- Decide PR-bot mechanism (`peter-evans/create-pull-request` vs `gh` in a step) and the durable branch/label naming (`bot/next-show`).
- Confirm CI pnpm setup matches the deploy path (corepack fallback if third-party actions are constrained per AGENTS.md).
- **Poster rendering (defer with the card design):** if `NextShow.astro` later uses `astro:assets` for `posterUrl`, whitelist the Radio Waters / WordPress media host in `astro.config.mjs`; otherwise render posters with a plain `<img>`. Keep this decision with the visual-design TODO.
