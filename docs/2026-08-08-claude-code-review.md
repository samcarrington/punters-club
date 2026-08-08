# Code Review: The Punters' Club

**Date:** 2026-08-08  
**Project:** Punters' Club · Internet Radio Show  
**Scope:** Full-repository review of `src/` and `scripts/` — code quality, TypeScript type safety, silent-failure/observability audit, dead code and duplication, and architecture/data-flow assessment.

## Method

Five parallel, read-only review passes were run against the current working tree (no edits made during review):

1. General code quality (`code-reviewer`)
2. TypeScript type-safety and idioms (`typescript-reviewer`) — ran `tsc --noEmit` and `biome check .` directly
3. Silent-failure / observability audit (`silent-failure-hunter`), scoped to the enrichment scripts and their fallback behavior
4. Dead code and duplication audit (`refactor-cleaner`), cross-checked with `knip`
5. Architecture and data-flow assessment (`architect`)

No CRITICAL security issues, hardcoded secrets, or injection vulnerabilities were found in any pass.

## Executive Summary

The codebase is small (~3.8k lines across `src/` and `scripts/`), clean, and reasonably well-tested where it matters most (`src/lib/`). There is one real compile error and no other correctness bugs. The dominant theme across all five reviews is **inconsistency rather than absence of good patterns**: `scripts/enrich-next-show.ts` already does failure-logging, fallback design, and typing better than its two siblings, and `src/lib/` already has the discipline that the `.astro` layer's prop typing lacks. The highest-leverage fixes are about spreading existing good patterns, not inventing new ones.

The single most consequential finding is architectural: production builds currently call three live third-party APIs (`pnpm run build` → `pnpm run enrich` → Mixcloud/Spotify/Tribe Events), which makes deploys fragile to unrelated upstream outages and makes builds non-reproducible.

---

## Findings

### CRITICAL

#### `src/lib/platform.ts:32-40` — Real `tsc --noEmit` compile failure

`PLATFORM_DEFINITIONS` is declared `as const`, so the `Map` built from it infers a narrow literal-union key type (e.g. `"open.spotify.com" | "tidal.com" | ...`) instead of `string`. `detectPlatform`'s `.get(new URL(url).hostname)` call then fails strict type-checking because `hostname` is a plain `string`.

**Impact:** The project does not currently type-check clean. Harmless at runtime today (`Map.get` doesn't enforce types at runtime), but gives false confidence and will surface as a real build break the moment a `typecheck` script or `astro check` is wired in.

**Recommendation:** Type the `Map` explicitly as `Map<string, Platform>` rather than letting it infer from the literal tuple.

---

### HIGH

#### 1. Production builds are coupled to three live third-party APIs

**Files:** `package.json` (`"build": "pnpm run enrich && astro build"`), `scripts/enrich-shows.ts:37`

Every Vercel production build refetches Mixcloud, Spotify oEmbed, and the WordPress Tribe Events API, even though the generated JSON is already committed to the repo. `enrich-shows.ts:37` exits non-zero on failure, so an unrelated content or CSS change can fail to deploy purely because an upstream API is having an outage. It also means rebuilding an old commit does not reproduce the same output — the build is not deterministic.

**Impact:** Deploy fragility tied to systems outside the project's control; non-reproducible builds.

**Recommendation:** Follow the pattern already used for next-show data (`.github/workflows/next-show-refresh.yml`): move show/playlist enrichment to a scheduled/on-demand GitHub Action that commits the generated JSON, and reduce `build` to just `astro build`.

#### 2. Silent failures in `enrich-shows.ts` and `enrich-playlists.ts`

**Files:** `scripts/enrich-shows.ts:23-30`, `scripts/enrich-playlists.ts:39-46, 53-56, 71-73`

The documented fallback-to-stale-data design (per `AGENTS.md`) is intentional and correct. The problem is these two scripts implement it with bare `catch { return stale }` blocks — no `console.warn`/`error`, no distinction between HTTP 404, network timeout, or malformed response, and (in `enrich-playlists.ts:53-56`) not even a `catch`, just a silent early return on a malformed Tidal URL. Compare to `scripts/enrich-next-show.ts`, which logs warnings with slug/status context at every failure point (lines 150, 175, 200, 263).

**Impact:** A persistently broken Mixcloud or Spotify feed can silently serve stale data indefinitely with a green build/exit code — the kind of outage that goes unnoticed until someone manually compares content dates.

**Recommendation:** Port `enrich-next-show.ts`'s warn-with-context logging style into the other two scripts.

#### 3. The data model is a diamond, not three clean tiers

**Files:** `src/pages/shows/index.astro:24`, `src/pages/shows/[slug].astro:20`, `src/lib/shows.ts:62-70`

Tracklists exist only in `show-sources.json`, not in the generated output, so both show pages call `mergeShowsWithSources` to fuzzy-join (URL match, then slug fallback) generated data back against source data at render time. Pages end up consuming two tiers and performing a join, rather than the clean source → generated → consumed pipeline the rest of the design implies. This is also why `src/data/shows.json` ended up an orphaned, stale duplicate (see Dead Code below) — a symptom of the same tiering confusion.

**Impact:** An extra runtime join with fuzzy matching, and a data model that's harder to reason about than intended.

**Recommendation:** Fold tracklists into `shows.generated.json` during enrichment so pages consume a single tier; the join heuristic in `mergeShowsWithSources` can then be removed.

#### 4. Show ordering is expressed two incompatible ways

**Files:** `src/pages/index.astro:26-27`, `src/lib/shows.ts:73-101` (`sortShows`), `src/pages/shows/index.astro:123-163`

The homepage uses raw array order (`shows.at(-1)` / `shows.slice(0, -1).reverse()`) — an *implicit* contract on whatever order `enrich-shows.ts` happens to write. The shows-index page uses the explicit, tested `sortShows(..., "newest")`. Separately, that same page's client-side `<script>` re-sort (lines 123-163) reimplements all four sort modes again, tie-breaking on `title` only (vs. `sortShows`'s `slug ?? url ?? title`) and reading from string `data-*` attributes instead of the typed `Show` object.

**Impact:** If the generator's write order ever changes, the homepage's "latest show" silently becomes wrong with no test to catch it. The client-side re-sort will keep drifting from the server-side sort since neither is tested against shared fixtures.

**Recommendation:** Route the homepage through `sortShows`. Separately, consider generating the client-side sort keys from the same source as `sortShows` rather than maintaining a second implementation.

#### 5. Test coverage is inverted relative to code risk

**Files:** `scripts/enrich-next-show.ts:80-107` (HTML token/slug regex helpers), all of `src/lib/*.test.ts`

All 10 existing test files live in `src/lib/`. The most regex-heavy, brittle code in the repo — the HTML scraping/token-extraction helpers used to discover next-show events — has zero tests. `src/lib/mixcloud.ts`, `spotify.ts`, `tidal.ts`, `playlist.ts` also have no tests, breaking the project's own established test-pairing convention. `next-show.test.ts` doesn't cover `fetchEvents`/`staleFallback`, and `next-show.remote.test.ts` only exercises the happy path (opt-in, live-network only).

**Impact:** The code most likely to break silently when a third party changes their markup is exactly the code with no regression safety net.

**Recommendation:** Move the pure regex/token helpers from `enrich-next-show.ts` into `src/lib/` and test them against saved HTML fixtures. Identified as the highest-leverage, lowest-cost fix available in this review.

#### 6. Next-show status flips silently on discovery failure

**File:** `scripts/enrich-next-show.ts:287-296` (`staleFallback`)

The fallback chain itself is good design and already the best-instrumented part of the codebase. But when all discovery methods fail and a previously-stale show's start time has passed, the script downgrades status from "upcoming" to "none" with only a `console.warn` and a green exit code — indistinguishable from an actual schedule gap.

**Impact:** An operator watching only for warnings could miss that the site is showing "no upcoming show" because of a sustained fetch failure, not because there genuinely isn't one scheduled.

**Recommendation:** Add an explicit, distinct signal (different log level, or surfaced in the Action's PR body) specifically for this upcoming → none transition.

---

### MEDIUM

#### Duplicated fetch/fallback scaffolding across enrich scripts

**Files:** `scripts/enrich-shows.ts:8-14`, `scripts/enrich-playlists.ts:20-26`, `scripts/enrich-next-show.ts:15-21`

Three byte-for-byte (or near-identical) copies of a `readJson<T>` helper, plus three repetitions of the same try/fetch/fallback shape. A bug fix to fallback behavior in one script won't propagate to the others.

**Recommendation:** Extract a shared `scripts/lib/` module. Do this alongside the logging fix (High #2) rather than as a separate pass, since both touch the same lines.

#### Provider host-detection duplicated, with a real latent bug

**Files:** `src/lib/spotify.ts` (`isSpotifyUrl`), `src/lib/tidal.ts` (`isTidalUrl`), `src/lib/platform.ts` (`detectPlatform`)

`isSpotifyUrl`/`isTidalUrl` duplicate logic that `platform.ts`'s `detectPlatform` already generalizes — and `isTidalUrl` is missing a `www.tidal.com` case that `platform.ts` already handles correctly. Consolidating onto `platform.ts` fixes this bug as a side effect. Only consumer is `scripts/enrich-playlists.ts`.

#### `formatShowTime` options duplicated between server and client

**Files:** `src/lib/local-time.ts:1-19`, `src/components/NextShow.astro:25-34`

`NextShow.astro` rebuilds the exact same `Intl.DateTimeFormat` option object inline inside an `is:inline` script (needed for client-side local-timezone rendering). Two call sites are reasonable given the client/server split; two independently-typed-out option literals are not.

**Recommendation:** Export the option object as a named constant from `local-time.ts` and import it on both sides.

#### `cookie-consent.ts` helpers bypassed by their own component

**Files:** `src/lib/cookie-consent.ts:55, 62, 69`, `src/components/CookieConsent.astro`

`getConsentStatus`, `shouldShowConsentBanner`, and `canUseAnalytics` are exported and tested but used only by tests — `CookieConsent.astro`'s inline script reimplements the same logic by hand instead of calling them.

#### Redundant/unsafe non-null assertions

**Files:** `src/lib/next-show.ts:164`, `src/lib/shows.ts:113`

- `next-show.ts:164` — `event.timezone!` is genuinely redundant: the guard three lines above (`if (!event.timezone || !isValidIanaZone(event.timezone)) return null;`) already lets TypeScript narrow to `string`. This is dead assertion left over from a refactor, not a safety net.
- `shows.ts:113` — `slugKey(show.slug)!` (also flagged by Biome). Safe today because of a call-site guard, but `slugKey`'s own signature doesn't narrow, so the `!` is compensating for a signature that could be tightened instead.

#### `cookie-consent.ts:89-92` — parameter ignored, name misleading

`discardQueuedEvents(_queue)` always returns `[]` regardless of its argument. Either the parameter should be used or removed — as written, the function name implies behavior it doesn't have.

#### No runtime validation at external-JSON trust boundaries

**Files:** `src/pages/sitemap.xml.ts:8,16`, `src/pages/shows/index.astro:23,25`, `src/pages/shows/[slug].astro:19,21` (one is a double-cast `as unknown as Show[]`), `src/components/NextShow.astro:9`, `src/pages/index.astro:25`, `scripts/enrich-next-show.ts:231-234`

No schema-validation library (zod or similar) is used anywhere. Casts like `generatedShowsData as Show[]` and `rawResult as NextShowResult` assume the shape without checking it. Lower risk than a live external API cast since these are committed/generated files, but a malformed hand-edit to a source JSON file would sail through silently until it crashes deep inside an unrelated `.map()`/`.find()`. `assertValidShowSlugs` (`shows.ts:103-123`) is the only guard that exists, and it only covers slugs. Separately, `enrich-next-show.ts`'s bulk-fetch path casts the Tribe Events response with no validation at all, inconsistent with the same file's more careful by-slug path (`isTribeEvent`, itself close to a no-op since every `TribeEvent` field is optional).

**Recommendation:** Not urgent at current data volume. Worth revisiting with Astro content collections or a lightweight schema check in the enrich scripts if the data model grows.

#### `.astro` components bypass Astro's own Props typing convention

**Files:** `src/components/LatestShow.astro:6`, `ShowArchive.astro:8`, `MixcloudWidget.astro:4-8`, `PlaylistGrid.astro:14-16`, `src/pages/shows/[slug].astro:30`, `src/layouts/PuntersLayout.astro:6-12`

Every component in scope types `Astro.props` via an `as` cast instead of Astro's idiomatic `export interface Props`. `MixcloudWidget.astro`'s cast hides a prop (`placement`) that's declared but never actually read in the component body — a real dead prop the cast prevented tooling from catching. Worse: `PuntersLayout.astro` — the shared layout used by every page — has no prop typing at all, so `title` and friends are implicitly `any`; a missing or mistyped `title` at any call site would not be caught anywhere.

**Recommendation:** Convert to `export interface Props` at each component; prioritize `PuntersLayout.astro` since it's the layout every page depends on.

#### `astro.config.mjs` sets no `site`

**File:** `astro.config.mjs`, `src/pages/index.astro:21-24`

`Astro.site?.toString() ?? SITE.url` always takes the fallback since `site` is never configured. The config/constant split currently does nothing useful.

**Recommendation:** Either set `site` in `astro.config.mjs` or simplify the call sites to use `SITE.url` directly.

---

### LOW

#### Dead code

- **`src/data/shows.json`** — stale, orphaned duplicate of `show-sources.json` (17 vs. 18 entries, last touched 2026-06-30), zero references anywhere. Safe to delete.
- **`src/lib/spotify.ts:3`** — dead type re-export (`export type { Playlist, PlaylistSource }`); nobody imports types from this module.
- **`src/components/MixcloudWidget.astro:12`** — static `id="mxc-widget"` template literal, not referenced by any CSS/JS; latent duplicate-ID bug if the component is ever rendered twice on one page.

#### Drift from established constants pattern

- **`src/components/HomeHero.astro:16-17`** hardcodes `href="#latest-show"` / `href="/shows"` instead of reusing `SITE.latestShowHash` / `SITE.showsPath` from `constants.ts`, unlike `AppHeader.astro:8-12`, which correctly uses the constants for the same links.
- **`src/layouts/PuntersLayout.astro:36`** hardcodes the GTM container ID (`"GTM-MSSM6ZK7"`) inline rather than as a named constant in `constants.ts`. Not a secret (GTM IDs are public by design), just inconsistent with where every other site-wide value lives.

#### Cosmetic / not urgent

- **`src/lib/structured-data.ts`** — 8 exports (`COLLECTION_PAGE_NAME`, `buildShowEntity`, `buildPlaylistEntity`, etc.) are used only internally; over-exported but not dead.
- **Provider `normalize*` functions** (`mixcloud.ts`, `spotify.ts`, `tidal.ts`) each take different second-argument shapes with no shared interface, even though `enrich-playlists.ts:76-82` branches over "which provider" as if they were interchangeable. Not urgent with only two playlist providers today (YAGNI applies) — worth a shared `Normalizer<TSource, TApiShape, TResult>` shape only if a third provider is added.
- **`test:next-show:remote`** only exercises the happy path against the live endpoint (opt-in via `RUN_REMOTE_TESTS=1`), not error/fallback behavior.

---

## Recommended Order of Attack

1. **Decouple `build` from live API calls** (High #1) — move show/playlist enrichment to a scheduled Action, reduce `build` to `astro build`. Highest architectural leverage; fixes deploy fragility and build reproducibility together.
2. **Fix the `platform.ts` compile error** and drop the two redundant non-null assertions (Critical, part of High-adjacent Medium) — trivial, zero risk.
3. **Add warn-on-failure logging to `enrich-shows.ts`/`enrich-playlists.ts`** (High #2), extracting the shared `readJson`/fetch-fallback helper at the same time (Medium).
4. **Move `enrich-next-show.ts`'s regex/token helpers into `src/lib/` with fixture tests** (High #5) — cheapest test-coverage win with the highest payoff.
5. **Fold tracklists into `shows.generated.json`** to collapse the diamond data model and remove the fuzzy join in `mergeShowsWithSources` (High #3).
6. **Route the homepage's "latest show" through `sortShows`** (High #4) — small, independent, removes an untested implicit ordering contract.
7. Everything in Medium/Low — dead code deletion, `isSpotifyUrl`/`isTidalUrl` consolidation onto `platform.ts`, Astro `Props` typing (starting with `PuntersLayout.astro`), `cookie-consent.ts` cleanup — real but lower urgency; suited to a deliberate follow-up pass rather than piecemeal fixes.
