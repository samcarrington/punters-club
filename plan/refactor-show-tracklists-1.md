---
goal: Separate authoritative per-show tracklists from metadata and reduce the lazy search payload without changing listening or browsing behavior
version: 1.0
date_created: 2026-11-15
last_updated: 2026-11-15
owner: Repository maintainers
status: 'Planned'
tags: [refactor, data, performance, search, migration]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Extract hand-authored tracklists into one private build-input JSON file per show, remove their duplication from source/generated show metadata, and separately normalize the search response. Keep static show pages, archive browsing, existing URLs, global search behavior, and deterministic production builds.

This document proposes implementation; it does not authorize or perform a data migration. Complete Phases 1-3 as one coordinated release. Phase 4 is a separately deployable optimization depending on Phase 3.

## 1. Requirements & Constraints

### Measured Baseline

Measurements taken from the working tree on 2026-11-15. All sizes below are bytes, not kilobytes. Compression uses Node's default `gzipSync` and `brotliCompressSync`; these are reproducible comparison estimates, not measured Vercel transfer sizes.

| Resource | Raw | Gzip | Brotli |
| --- | ---: | ---: | ---: |
| Current generated show file, on-disk formatting | 154695 | 23238 | 17898 |
| Same generated records without tracklists, pretty printed, before new references | 75917 | 5619 | 4332 |
| Current v1 search response rebuilt in memory from these records | 142640 | 18604 | 15165 |
| Normalized v2 search response prototype using a show table and appearance tuples | 57194 | 16653 | 14291 |

There are 22 source shows containing 679 tracks, but only 21 generated shows containing 647 tracks. All 21 shared tracklists match exactly when joined by Mixcloud URL. The source-only show is `Fireworks and Sparkles`, with 32 tracks. Preserve it during extraction; do not silently promote it into the published catalog or invent missing generated metadata. Publishing it remains the existing enrichment workflow, outside this refactor.

Existing local build output is stale: its search JSON is 127927 bytes, not the current in-memory 142640-byte baseline. Rebuild before drawing output comparisons. Capture implementation-time baselines again if content changes.

The generated file is imported in Astro frontmatter and static endpoints, not fetched wholesale by the browser. Tracklist separation therefore primarily improves authoring, review, ownership, and metadata processing. It does not by itself remove 154695 bytes from initial page loads. Show HTML already contains its own tracklist; search separately fetches a minified index only after a normalized query reaches two characters. The prototype saves about 60% raw search bytes, but only 10% gzip and 6% Brotli: do not claim raw savings as transfer savings.

### Impact Map

| Surface | Current controlling files | Planned effect |
| --- | --- | --- |
| Show detail pages | `src/pages/shows/[slug].astro` | Load only the matching authoritative tracklist at build time; keep complete HTML and empty state without browser fetches. |
| Full archive | `src/pages/shows/index.astro` | Read metadata only; retain all sort modes, DOM data attributes, links, artwork, genres, and no-JavaScript browsing. No tracklist request is needed. |
| Homepage latest show and archive rail | `src/pages/index.astro`, `src/components/LatestShow.astro`, `src/components/ShowArchive.astro` | Remain metadata-only; preserve newest-first ordering and the scoped six-show disclosure. |
| Global search on every page | `src/pages/api/tracks.json.ts`, `src/lib/track-search.ts`, `src/components/SiteSearch.astro`, `src/lib/constants.ts`, `src/components/AppHeader.astro` | Join all published shows with tracklists at build time; later introduce compact v2 transport. Preserve one lazy request, ranking, results, retry, focus, and accessibility behavior. |
| Search analytics and consent | `src/lib/search-analytics.ts`, `src/lib/cookie-consent.ts`, their tests | No schema or consent changes; decode compact appearances back to the existing renderer's model so titles, paths, positions, ranks, and error-stage events remain correct. |
| Sitemap and route identity | `src/pages/sitemap.xml.ts`, `src/lib/sitemap.ts`, `src/lib/shows.ts` | Remain metadata-only; preserve public slugs, canonical URLs, date fields, counts, and slug validation. |
| SEO and structured data | `src/lib/structured-data.ts`, `scripts/verify-structured-data.ts` | Episode/list JSON-LD currently does not use tracklists. Preserve it; verify metadata counts without loading tracks. |
| Enrichment and stale fallback | `scripts/enrich-shows.ts`, `src/lib/mixcloud.ts`, `scripts/lib/enrich-utils.ts` | Stop spreading tracks into generated metadata on both success and failure. Keep the current source reference fresh even when API metadata falls back. |
| Scheduled refresh and deployment | `.github/workflows/shows-refresh.yml`, `package.json`, `vercel.json` | Continue committing only enriched metadata. Tracklists are hand-authored inputs, never bot-generated output. Keep static deployment and the existing build command. |
| Tracklist authoring and conversion | `scripts/convert-tracklist.ts`, `src/data/show-sources.json`, `docs/data/2026-11-14.txt` | Converter output becomes the per-show array file's contents, not an array pasted into the central source file. Do not silently add an output-writing mode. |
| Contributor guidance and architecture | `AGENTS.md`, `README.md`, `docs/shows.md`, `docs/decisions/001-static-track-search.md` | Document ownership, add/edit steps, missing-file behavior, and the changed search-index inputs. Preserve show ordering/title reference. |
| Playlists, next-show scheduling, player consent | Playlist/next-show pipelines and `src/components/MixcloudWidget.astro` | No behavioral change. Metadata-only `Show` remains sufficient for the player. These pipelines do not consume show tracklists. |

### Target Data Contract

- **REQ-001**: Store each authoritative array at `src/data/tracklists/<tracklistId>.json`. Each item retains exactly `position`, `artist`, and `title`. Preserve array order, spelling, punctuation, Unicode, remixes, duplicate plays, and existing position values.
- **REQ-002**: Add required `tracklistId: string` to each `ShowSource`; generated `Show` records carry the same reference. Remove inline `tracklist` from both metadata files and from the metadata type. Use `ShowWithTracklist = Show & { tracklist: ShowTrackItem[] }` only at detail/search composition boundaries.
- **REQ-003**: Seed IDs once from existing generated slugs matched by source URL. For a source without generated metadata, seed from its Mixcloud URL's final pathname segment. Validate `^[a-z0-9]+(?:-[a-z0-9]+)*$`, uniqueness, and collisions before writing. Thereafter IDs are explicit and immutable, independent of title or public-slug edits.
- **REQ-004**: A show with no known tracks has an existing file containing `[]`. Missing referenced files, malformed JSON, unsafe IDs, duplicate references, and orphan files fail validation; never silently treat broken references as empty tracklists. A source-only show's referenced file is valid, not orphaned.
- **REQ-005**: Add metadata-only `src/lib/show-data.ts` exporting `getShows()`, with existing slug validation. Add separate build-only `src/lib/show-tracklists.ts` exporting asynchronous `getTracklist(tracklistId)` and `getShowsWithTracklists()`. Use a literal lazy `import.meta.glob("../data/tracklists/*.json", { import: "default" })` registry in the latter. Validate imported JSON as unknown before use. Cache imports within a build; do not import the tracklist loader into client scripts or metadata-only consumers.
- **REQ-006**: Detail pages load their own referenced array in frontmatter; `getStaticPaths()` still supplies metadata props. Search joins all and only generated/published shows, preserving newest-first appearance ordering. Unpublished source-only shows must not leak into routes, sitemap, JSON-LD, or search.
- **REQ-007**: Tracklist-only edits must affect the next static build and its search index without enrichment. Production builds must not fetch third-party metadata or generate committed content files.
- **REQ-008**: Do not add a database, search service, client framework, content-collection migration, public per-show JSON endpoint, or browser request per tracklist. File splitting does not imply network sharding.
- **REQ-009**: Preserve existing search normalization, case/diacritic grouping, exact/prefix/substring/token ranking, eight-result limit, all appearances, retry after failures, and privacy-preserving analytics. Keep the current two-character threshold and 250 ms debounce.
- **REQ-010**: Keep `ShowTrackItem` position validation to positive integers; do not require consecutive positions or renumber existing data. The existing search fixtures intentionally contain positions 8 and 9.
- **CON-001**: No changes to public show slugs, show count, metadata values, styles, archive UX, playlist generation, or next-show matching are part of the migration. Retain all other generated fields, including pictures and descriptions; metadata pruning is a separate follow-up.
- **CON-002**: Use existing pnpm, TypeScript, Vitest, Biome, Astro static endpoints, and committed generated-file conventions. No new dependencies. Do not run live enrichment to manufacture a migration baseline.
- **SEC-001**: Resolve tracklist IDs through the registry rather than unchecked filesystem paths. Compact search decoding must validate the full response, internal show paths, tuple bounds, integer positions, and text fields before rendering with the existing text-based DOM APIs.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Record a frozen baseline and implement a lossless, offline extraction. This phase prepares local work only; do not deploy an intermediate state with broken consumers.
- Dependencies: none. TASK-002 depends on TASK-001; TASK-003 depends on TASK-002.
- Completion criteria: all source tracklists extract exactly once; shared generated/source arrays agree; metadata other than tracklist references is unchanged; repeated migration is a no-op.

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-001 | In `scripts/migrate-show-tracklists.ts`, add an offline preflight and `--check` mode. Read both show files strictly, join by URL, reject duplicate URLs/IDs and divergent shared arrays, calculate proposed IDs and output paths, and print counts plus raw/gzip/Brotli baselines. Capture the old v1 payload and track-array hashes in a temporary verification directory outside committed content. Do not use the lenient enrichment reader for migration failures. | No | Not started |
| TASK-002 | Implement extraction in the same migration script: validate every input and destination before writing, refuse differing pre-existing output files, write one two-space-indented array plus newline per source show, replace inline arrays with `tracklistId`, and remove inline arrays from generated records. Preserve all remaining record fields and record order. Support rerun/check against already-extracted data; never delete existing files automatically. | No | Not started |
| TASK-003 | Run preflight then extraction on a cleanly reviewed working tree. At this snapshot expect 22 files/679 source tracks and 21 generated references/647 published tracks. Preserve the 32-track source-only show. Verify parsed field equality excluding only old `tracklist` and new `tracklistId`; stop on conflicts instead of favoring generated content. | No | Not started |

### Implementation Phase 2

- GOAL-002: Establish explicit metadata/tracklist boundaries and validate hand-authored content without upstream APIs.
- Dependencies: Phase 1. TASK-005 and TASK-006 depend on TASK-004; TASK-007 depends on TASK-005.
- Completion criteria: metadata-only types cannot carry tracks; broken references fail a local check and a production build; enrichment success/fallback cannot reintroduce tracks or overwrite authored arrays.

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-004 | Update `ShowSource`/`Show` in `src/lib/mixcloud.ts` to require `tracklistId`, remove metadata's `tracklist`, and export `ShowWithTracklist`. Preserve `ShowTrackItem`. Add pure `validateTracklistId` and `parseTracklist` helpers in `src/lib/tracklists.ts`; reject invalid entries without trimming or rewriting valid strings. | No | Not started |
| TASK-005 | Implement `getShows()` in `src/lib/show-data.ts` and the separate lazy registry in `src/lib/show-tracklists.ts` as specified by REQ-005. Join tracks to generated shows, not to the full authoring catalog. Add `scripts/verify-show-data.ts` to validate all source references, generated/source ID agreement, JSON shape, forbidden inline arrays, and orphan/missing files offline. Add `pnpm run verify:show-data`; invoke equivalent shared validation from build-time show-data loading without changing `build` from `astro build`. | No | Not started |
| TASK-006 | Update `normalizeShow` and `scripts/enrich-shows.ts` so success and fallback carry the current source `tracklistId` but never carry tracks from old cache objects. Build fallback by explicitly removing any legacy inline `tracklist` property before merging existing metadata; preserve current hand-authored title refresh semantics. Do not extend the bot's staged paths to authored tracklists. | No | Not started |
| TASK-007 | Add focused validation/loader and mocked enrichment tests using existing Vitest conventions. Test explicit empty lists, invalid/missing/orphan IDs, Unicode preservation, duplicate positions rejected, nonconsecutive positive positions accepted, cache behavior, and success/stale/source-only fallback without network access. | No | Not started |

### Implementation Phase 3

- GOAL-003: Migrate all consumers while preserving existing rendered output and v1 search behavior; release the storage refactor.
- Dependencies: Phase 2. TASK-008 and TASK-009 may run in parallel; TASK-010 depends on both; TASK-011 depends on TASK-010.
- Completion criteria: existing published routes, metadata, rendered track rows, JSON-LD, sitemap, and decoded search results are equivalent to baseline. A tracklist-only edit updates show HTML and search on the next build without enrichment.

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-008 | Replace direct generated imports with `getShows()` in `src/pages/index.astro`, `src/pages/shows/index.astro`, `src/pages/sitemap.xml.ts`, and `src/pages/shows/[slug].astro`. In detail frontmatter load `await getTracklist(show.tracklistId)` and render that array using `ShowTrackItem`; keep existing empty-state markup. Confirm `LatestShow`, `ShowArchive`, `MixcloudWidget`, sort helpers, sitemap helpers, and structured-data builders only need metadata; do not add loaders to them. | No | Not started |
| TASK-009 | Change `src/pages/api/tracks.json.ts` to asynchronously join published shows through `getShowsWithTracklists()` before `buildTrackSearchIndex`. Change that builder's input to `readonly ShowWithTracklist[]`. Preserve v1 output shape/order and static prerendering. Update `shows.test.ts` metadata fixtures to references and `track-search.test.ts` fixtures to the explicit joined type. | No | Not started |
| TASK-010 | Update `README.md` and `AGENTS.md` authoring/data-flow instructions and document using `scripts/convert-tracklist.ts` output as a per-show JSON array. Add an accepted `docs/decisions/002-show-tracklist-storage.md` when implemented, covering private authored files, immutable references, build-only joins, and why network sharding was rejected. Update ADR-001's input/refresh consequences without erasing its history. Check `docs/shows.md` for parity, changing it only if incorrect. | No | Not started |
| TASK-011 | Run TEST-001 through TEST-007 and the release commands below. Inspect `.github/workflows/shows-refresh.yml` to confirm it still stages only existing generated metadata outputs. Preserve `vercel.json` and the workflow unless the implementation demonstrably needs a pipeline change. Deploy the coordinated data/types/loaders/consumer changes together; never deploy only the extracted data. | No | Not started |

### Implementation Phase 4

- GOAL-004: Reduce the actual lazy search response without adding requests or changing result behavior.
- Dependencies: Phase 3. TASK-013 depends on TASK-012; TASK-014 depends on TASK-013.
- Completion criteria: compact v2 decodes to exactly the existing search model; the legacy endpoint remains usable; measured payload budgets pass against the same content snapshot.

Use this exact transport shape, distinct from the existing expanded `TrackSearchEntry` used by ranking/rendering:

```typescript
type TrackSearchResponseV2 = {
  version: 2;
  shows: { title: string; path: string }[];
  entries: {
    artist: string;
    title: string;
    appearances: [showIndex: number, position: number][];
  }[];
};
```

`showIndex` is zero-based within this response, not a persistent ID. Track positions remain one-based. Order the show table by the existing newest-first sort and preserve entry and appearance ordering. This schema version is unrelated to the previously shipped "Track Search v2" UI redesign.

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-012 | Add `buildTrackSearchResponseV2` and strict `decodeTrackSearchResponse` to `src/lib/track-search.ts`. Keep the expanded ranking model and existing builder. Serialize a single show table and indexed appearance tuples, rejecting invalid references during decoding. Add round-trip, grouping/ranking parity, malformed-payload, and deterministic-serialization tests to `src/lib/track-search.test.ts`. | No | Not started |
| TASK-013 | Add prerendered `src/pages/api/tracks-v2.json.ts` using the joined published data and compact builder. Point `SITE.trackSearchEndpoint` in `src/lib/constants.ts` to `/api/tracks-v2.json`; update `SiteSearch.astro` to decode v2 inside its existing validation error boundary. Retain `/api/tracks.json` with v1 output for old open pages/cached scripts. Do not remove it in this change or fetch both endpoints. Keep one memoized request after two characters and reset it after errors. | No | Not started |
| TASK-014 | Add an offline report/budget script `scripts/verify-show-data-size.ts` and `pnpm run verify:show-data-size`; report raw, gzip, and Brotli for metadata and both built endpoints, and compare v1/v2 built from identical content. Run TEST-008 through TEST-010, update ADR-001 with the new transport and compatibility endpoint, then run all release gates again. Record actual deployment transfer encoding separately; do not assume static endpoint Response headers become Vercel CDN policy. | No | Not started |

## 3. Alternatives

- **ALT-001**: Only split the generated file. Rejected: leaves the hand-authored monolith and duplicate track ownership, and metadata refresh still churns track content.
- **ALT-002**: Only minify generated JSON. Rejected as the primary fix: reduces formatting bytes but not duplication, and search JSON is already minified. Keep authored data readable.
- **ALT-003**: Fetch one public JSON file per show in the browser. Rejected: show pages gain a loading/failure state and lose complete no-JavaScript tracklists; global search still needs every show and would incur many requests.
- **ALT-004**: Use a database, hosted search, serverless query endpoint, or Astro content collections. Deferred: current 647 published tracks and roughly 19 KB gzip index do not justify runtime infrastructure or a broader data-model migration.
- **ALT-005**: Remove unused pictures/user/counter metadata and duplicated descriptions now. Deferred: useful separate audit, but not necessary for authoritative tracklist extraction; preserve output parity and keep this migration bounded.
- **ALT-006**: Replace v1 in place with v2. Rejected: already-open pages execute the old version check and would fail when fetching a new incompatible response. Retain v1 at its old URL and introduce v2 separately.
- **ALT-007**: Implement Phase 4 before the storage refactor. Technically possible but not selected: source ownership is the requested foundation. Phase 4 remains separately releasable because its modest compressed savings should be evaluated independently.

## 4. Dependencies

- **DEP-001**: Existing Astro/Vite JSON imports and lazy glob registry, plus static prerendered endpoints. Glob patterns must be literal strings. No dependency/version upgrades.
- **DEP-002**: Existing TypeScript/tsx, Vitest, Biome, and pnpm scripts. Node's built-in JSON, filesystem, crypto, and zlib APIs are sufficient for migration and verification.
- **DEP-003**: Existing Mixcloud URL-to-slug correspondence for seeding IDs, checked rather than assumed. Scheduled enrichment continues independently after migration.
- **DEP-004**: Phase 4 requires an endpoint/client coordinated deployment but retains v1 compatibility. No GTM publication or analytics schema migration is required.

## 5. Files

- **FILE-001**: Modify `src/data/show-sources.json` and `src/data/shows.generated.json`; add `src/data/tracklists/*.json`, one per source show.
- **FILE-002**: Modify `src/lib/mixcloud.ts`; add `src/lib/tracklists.ts`, `src/lib/show-data.ts`, `src/lib/show-tracklists.ts`, and focused tests beside these modules.
- **FILE-003**: Modify `scripts/enrich-shows.ts`; add `scripts/migrate-show-tracklists.ts`, `scripts/verify-show-data.ts`, `scripts/verify-show-data-size.ts`, and focused migration/enrichment tests using Vitest's existing discovery. Reuse shared validation rather than duplicating parser logic.
- **FILE-004**: Modify `src/pages/index.astro`, `src/pages/shows/index.astro`, `src/pages/shows/[slug].astro`, `src/pages/sitemap.xml.ts`, and `src/pages/api/tracks.json.ts`.
- **FILE-005**: Modify `src/lib/track-search.ts`, `src/lib/track-search.test.ts`, `src/lib/shows.test.ts`, `src/components/SiteSearch.astro`, `src/lib/constants.ts`, and search markup tests where behavior expectations change; add `src/pages/api/tracks-v2.json.ts`.
- **FILE-006**: Modify `package.json`, `README.md`, `AGENTS.md`, and `docs/decisions/001-static-track-search.md`; add `docs/decisions/002-show-tracklist-storage.md` on implementation. Inspect but do not automatically rewrite `docs/shows.md`, converter, workflow, deployment configuration, or structured-data verification.
- **FILE-007**: Regression-check existing `src/components/LatestShow.astro`, `src/components/ShowArchive.astro`, `src/components/MixcloudWidget.astro`, `src/lib/structured-data.ts`, `src/lib/sitemap.ts`, `src/lib/search-analytics.ts`, and related tests without expanding their responsibilities.

## 6. Testing

- **TEST-001**: Migration parity: compare per-URL source arrays and migrated files by parsed content/hash; preserve 679 source tracks and 647 published appearances for this snapshot, including the unpublished 32-track list. Compare every non-track metadata value and record order. Preflight rejects divergent generated/source arrays, conflicting destination files, duplicate URLs/IDs, and unsafe path segments. Running extraction twice is a no-op.
- **TEST-002**: Data validation: all references resolve; `[]` is valid; missing files, non-arrays, invalid entries, blank artist/title, noninteger/nonpositive or duplicate positions, duplicate references, and true orphans fail with the responsible show/file. Preserve nonconsecutive positions, Unicode, punctuation, and repeated artist/title pairs at different positions.
- **TEST-003**: Enrichment: mocked success and failed fetch paths preserve the current `tracklistId`; old cached inline tracks cannot reappear; authored files are never written. Tracklist-only changes are visible without enrichment. Existing title/description behavior is otherwise unchanged.
- **TEST-004**: Build/render parity: compare every published detail page's track rows with baseline, including empty-tracklist fixtures. Match published route set, titles, canonical URLs, archive count/order, all four archive sort modes, homepage latest show, six-item disclosure, sitemap entries, and parsed JSON-LD. Confirm the source-only show stays unpublished during the offline migration.
- **TEST-005**: v1 search parity: rebuilt Phase 3 response matches the pre-migration response after JSON parsing, including 629 grouped entries and 647 appearances at this snapshot; grouping, ranking, limits, show labels/paths/positions, and newest-first appearance ordering remain unchanged.
- **TEST-006**: Browser network/no-JavaScript: on home, archive, and a detail route, zero track-index requests before a two-character query and zero per-show JSON requests at all times. Without JavaScript, detail tracklists and archive links remain usable. Inspect built client assets for accidental full metadata or tracklist bundles; build-only chunks are not by themselves a browser regression.
- **TEST-007**: Source freshness: temporarily modify a per-show track title in an isolated test fixture/worktree, build without enrichment, and assert only the appropriate detail track row and search data change. Restore only that test's own fixture changes. Verify production builds do not write committed JSON.
- **TEST-008**: v2 decoder: round-trip to exactly the expanded v1 entries; reject unknown version, invalid show table, noninternal paths, missing fields, malformed tuples, out-of-range/negative/fractional indexes, and invalid positions. Keep failures retryable with `error_stage: validate`. Check old v1 URL with an old-client fixture.
- **TEST-009**: Search interaction on mobile and desktop: keyboard opening/closing, focus restoration, navigation/menu exclusion, loading/results/empty/error/retry, and selected appearance links behave as before. Analytics remains consent-aware, with unchanged event names/counts/ranks and no query/artist/title payloads.
- **TEST-010**: Size gates: for the frozen baseline metadata, pretty-printed metadata plus references must be <=55% of the original generated file's raw size. For identical built search content, v2 must be <=60% of v1 raw and <=95% of v1 gzip; report Brotli without a hard cross-version threshold. Compare ratios using recomputed identical-content baselines, not stale `dist` or fixed global byte ceilings that fail as shows are added. Report client-script gzip change alongside payload savings.

Run focused tests first, then release gates: `pnpm run verify:show-data`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, and `pnpm run build`. After Phase 4 also run `pnpm run verify:show-data-size` against that build. Do not run live enrichment as a test.

Inspect JSON-LD on home, archive, and detail routes using existing structured-data tests and parsed built scripts. The existing `scripts/verify-structured-data.ts` assumes exactly one homepage JSON-LD block, but an upcoming event can legitimately add a second; do not make fixing that unrelated assumption a prerequisite or suppress real parity failures.

## 7. Risks & Assumptions

- **RISK-001**: Source/generated drift could lose new content or publish an incomplete source-only show. Resolve by URL, preserve all source arrays, and keep published membership unchanged until deliberate enrichment.
- **RISK-002**: Extracting data without updating fallback can resurrect cached inline arrays. Strip the legacy property explicitly on fallback and assert its absence in generated output tests.
- **RISK-003**: Stable references can be confused with public slugs. Seed IDs once, retain them on slug/title changes, and validate both identities independently.
- **RISK-004**: Compressed savings are modest at today's scale. Report them honestly; the storage refactor's main benefits are data ownership and bounded consumer inputs. Do not promise faster initial page loads or build times without measurements.
- **RISK-005**: Joining all authored tracklists instead of all published shows leaks unpublished content. `getShowsWithTracklists()` must start from generated metadata only.
- **RISK-006**: Glob imports accidentally used by browser scripts can ship all tracklists as assets. Keep metadata and tracklist modules separate, use type-only imports in search logic, and verify actual browser requests/assets.
- **RISK-007**: v2 deployed at the old endpoint breaks old pages. Keep the v1 endpoint; its eventual retirement is a separate compatibility decision, not an automatic cleanup task.
- **RISK-008**: Strict validation may reveal unrelated historical data errors. Report exact records and stop migration; do not silently normalize or renumber them. No dependency repair or unrelated cleanup belongs in this change.
- **ASSUMPTION-001**: Tracklists remain public information but private build inputs, refreshed by humans. The scheduled job only refreshes provider metadata; the production build is offline with respect to content enrichment.
- **ASSUMPTION-002**: Rollback restores the coordinated storage release as a unit. Before implementation, retain baseline input/output snapshots; do not delete or rewrite user edits. Deploy Phase 4 separately so search transport can revert without undoing storage.

## 8. Related Specifications / Further Reading

- [Repository instructions](../AGENTS.md)
- [Contributor data flow](../README.md)
- [Existing static search ADR](../docs/decisions/001-static-track-search.md)
- [Global search UI and analytics plan](../docs/plans/2026-09-03-track-search-v2.md)
- [Show reference](../docs/shows.md)
- [Astro import/glob reference](https://docs.astro.build/en/guides/imports/#importmetaglob)
- [Astro static file endpoints](https://docs.astro.build/en/guides/endpoints/#static-file-endpoints)