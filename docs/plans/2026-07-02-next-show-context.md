# Next Show Backing — Execution Context

> Companion to the **spec** (`docs/superpowers/specs/2026-07-02-next-show-backing-design.md`) and the **plan** (`docs/plans/2026-07-02-next-show-backing.md`). Those two are authoritative and self-contained for *what* and *how*. This doc captures the surrounding decisions, verified facts, and repo conventions a fresh session needs so it doesn't have to re-derive or re-probe anything.

## How to run this work

- **Mode:** subagent-driven, task-by-task, in a **new session**. Orchestrator reads spec + plan + this doc, dispatches one implementer per task (Tasks 0–11 in the plan), reviews each diff and runs that task's tests/build before moving on. Tasks are **sequential** (each builds on the previous) — no parallelism.
- **Branch:** work continues on `feature/next-event-discovery` (already checked out; spec + plan are committed here). Do **not** work on `main`.
- **Gate:** the human wants to approve the go/no-go before implementation begins.

## Repo conventions (must follow)

- **pnpm is canonical.** Never reintroduce `package-lock.json`. `sharp` is an explicit prod dep for Vercel.
- **Commits:** Conventional Commits. Reference **`#13`** (testing-infra issue) on the test-tooling/TDD commits (plan Tasks 0–5). Commit only when the task's step says so; do not batch.
- **Build caveat:** `pnpm run build` runs `enrich && astro build` and can rewrite `src/data/shows.generated.json` / `playlists.generated.json` (Mixcloud play counts, Spotify art). For checks unrelated to that data, use **`pnpm exec astro build`**, and `git checkout --` any unrelated generated churn before committing. Only `src/data/next-show.generated.json` should change from this work.
- **Biome:** `biome.json` exists but Biome is not in scripts/deps; Astro files have `noUnusedImports`/`noUnusedVariables` disabled via overrides — don't "fix" that.
- **No test runner exists yet** — Task 0 introduces vitest. This aligns with the owner's recorded preference ("use vitest for TS utility testing in Astro projects").

## Owner operating rules (from working memory)

- Ask, don't assume; flag uncertainty rather than guessing.
- Simplest solution for simple problems; **no speculative flexibility** (YAGNI). This is a personal static site.
- Don't touch unrelated code; surface smells separately rather than fixing inline.
- Concise, high-signal communication.

## Verified upstream API facts (probed live + against official docs on 2026-07-02 — do not re-probe)

Endpoint: `GET https://www.radiowaters.co.uk/wp-json/tribe/events/v1/events` (The Events Calendar plugin, `tribe_events`, REST v1, introduced in plugin 6.0.0).

- Public read, **no auth**. Default order **ascending by start date** → `start_date=<today>&per_page=1` is literally "next show".
- Params: `start_date` (starts-after), `end_date` (starts-before), `per_page` (**max 50**), `page`, `search` (title OR description). Date format `YYYY-MM-DD`.
- Envelope: `{ events, total, total_pages, rest_url, next_rest_url, previous_rest_url }`.
- Per-event fields used: `title`, `slug`, `url`, `start_date` (local wall time), `end_date`, `timezone` (IANA, e.g. `Europe/London`), `utc_start_date` (UTC wall time — **always present in observed data**), `utc_end_date`, `description`/`excerpt` (HTML-capable), `image.url`.
- **No documented rate limit.** We stay polite by design: 1 build-time call + 1 daily scheduled call, each ~1 page.

Concrete live evidence (drives test fixtures in plan Tasks 3–4):

- **Titles are HTML-entity-encoded.** Real example: `The Punters&#8217; Club &#8211; Summer Holiday Sounds` → decode to `The Punters’ Club – Summer Holiday Sounds`. The apostrophe is a **curly** `’` (U+2019) sitting **after** the `s`. Hence the tolerant pattern `punters?['’]?\s+club` applied to **decoded** text.
- **Recurring-slug proof:** slug `saturday-night-in-with` appears **twice in August 2026 alone** (Aug 1 and Aug 29). Only a specific dated instance is "ours" → guest overrides are **slug + date**, never slug alone.
- **The new August show** (`the-punters-club-summer-holiday-sounds`, 2026-08-22 19:00 local / `2026-08-22T18:00:00Z`, `Europe/London`, poster present) is found by both the month-window query and `search=punter` (which returns exactly it). It is correctly the next *named* show (no July named listing).
- **Guest example** for the config seed: slug `saturday-night-in-with`, date `2026-07-04`, 19:00 local / `2026-07-04T18:00:00Z`.

## Decision log (condensed, with rationale)

1. **Source of truth = scrape the station's TEC REST API**, materialised into one committed generated JSON the site reads at build. Mirrors the existing `enrich-*` pattern. (User chose scrape-as-source over committed-JSON and over a Bluesky signal.)
2. **No runtime/agent dependency.** The Eve/Bluesky sketch (`docs/eve-bluesky-agent.md`) is set aside — the API is a cleaner, human-approvable source and the repo must not depend on Eve.
3. **Named shows by title-regex; guest slots by manual slug+date override.** Guest slots are discoverable in the API but not identifiable by title, so a human names them; the script resolves + verifies them from the same API.
4. **Refresh = daily scheduled Action that opens a PR the human merges** (merge → Vercel deploy). Nothing goes live without approval. One durable `bot/next-show` branch/PR.
5. **No `generatedAt`/timestamp in the artifact** + **no-op-skip writes** (semantic-diff only). Without this the bot would open a PR every day. (Oracle-caught blocker.)
6. **Store UTC + IANA timezone; format at build with `Intl`.** HTML-decode titles and strip HTML from descriptions at enrich time — never carry third-party HTML into the artifact.
7. **`status: "none"`** means "no verified upcoming qualifying show right now" — not an error. Fetch failure falls back to the previous artifact; if that fallback is itself past → `none`.

## The one deviation from the spec to reconcile

The spec's UTC rule lists a middle branch: "else derive from `start_date` + `timezone`". The plan **omits** it and uses **prefer `utc_start_date`, else discard + warn**, because wall-time→UTC conversion is unreliable without a timezone library and the API always supplies `utc_start_date` (YAGNI). If the human accepts this (it was flagged, not objected to), update spec §"Selection logic" step 3 to match. Do **not** add a timezone library for the dead branch.

## Out of scope for this work (do not build)

- Visual/UX design of the `NextShow` card and its homepage placement — deferred TODOs `[design-001]` / `[design-002]`, routed to a designer pass later. Task 9 ships only a **minimal, low-styling** functional consumer + empty state.
- JSON-LD `Event` structured data for the next show — part of `[design-002]`, not this plan.
- Any change to Mixcloud/Spotify/Tidal enrichment or existing components beyond adding the new section import.

## Definition of done

- `pnpm test` green (vitest suite for `src/lib/next-show.ts`).
- `pnpm exec astro build` succeeds; `dist/index.html` shows a "Next show" section with the decoded show title.
- `pnpm exec tsx scripts/enrich-next-show.ts` produces a valid `src/data/next-show.generated.json` (upcoming, decoded title, ISO-Z UTC, `Europe/London`).
- `.github/workflows/next-show-refresh.yml` present; opens a `bot/next-show` PR on change, nothing on no-op.
- `git status` shows only intended files; no unrelated generated churn committed.
