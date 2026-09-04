---
goal: Add searchable track autocomplete to the static show archive
version: 1.0
date_created: 2026-09-03
last_updated: 2026-09-03
owner: Punters Club
status: 'Completed'
tags: [feature, search, astro, accessibility]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

Add a progressively enhanced archive search that matches artists and song titles and identifies every show containing each matched track while preserving the site's static Astro deployment.

## 1. Requirements & Constraints

- **REQ-001**: Search artist and song-title text case-insensitively after two entered characters.
- **REQ-002**: Return each matching track with links to every show in which that track appears.
- **REQ-003**: Group case-insensitive duplicate artist/title pairs into one result.
- **REQ-004**: Provide loading, empty, error, and keyboard-accessible states.
- **CON-001**: Keep Astro's static output and deterministic production build.
- **CON-002**: Do not introduce a client framework for one isolated interaction.
- **CON-003**: Build the index from committed generated show data; do not call third-party APIs during build or search.
- **GUD-001**: Reuse existing route constants, visual tokens, archive layout, and show slugs.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Implement and expose a deterministic search index.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add typed index construction, text normalization, duplicate grouping, and ranked search in `src/lib/track-search.ts`. | ✅ | 2026-09-03 |
| TASK-002 | Add unit coverage in `src/lib/track-search.test.ts`. | ✅ | 2026-09-03 |
| TASK-003 | Add a prerendered JSON route at `src/pages/api/tracks.json.ts` built from `src/data/shows.generated.json`. | ✅ | 2026-09-03 |

### Implementation Phase 2

- GOAL-002: Add the accessible archive search interface and validate production output.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | Add `src/components/TrackSearch.astro` with lazy fetch, dynamic results, status announcements, escape handling, and safe DOM rendering. | ✅ | 2026-09-03 |
| TASK-005 | Render the search on `src/pages/shows/index.astro` and style it in `src/styles/global.css`. | ✅ | 2026-09-03 |
| TASK-006 | Run tests, typecheck, lint, and production build; verify `dist/api/tracks.json`. | ✅ | 2026-09-03 |

## 3. Alternatives

- **ALT-001**: Add Vue and `@astrojs/vue`; rejected because a single search control does not justify framework runtime and dependency cost.
- **ALT-002**: Add a Vercel serverless API that filters per request; rejected because the committed dataset is small, public, and changes only at build time.
- **ALT-003**: Embed the full index in archive HTML; rejected because lazy retrieval keeps track data out of the initial document and provides an endpoint for future consumers.

## 4. Dependencies

- **DEP-001**: Astro static endpoint generation.
- **DEP-002**: Existing committed `src/data/shows.generated.json` show metadata and tracklists.
- **DEP-003**: Existing stable `/shows/{slug}/` detail routes.

## 5. Files

- **FILE-001**: `src/lib/track-search.ts` — search index domain logic.
- **FILE-002**: `src/lib/track-search.test.ts` — domain tests.
- **FILE-003**: `src/pages/api/tracks.json.ts` — static JSON endpoint.
- **FILE-004**: `src/components/TrackSearch.astro` — interactive search UI.
- **FILE-005**: `src/pages/shows/index.astro` — archive integration.
- **FILE-006**: `src/styles/global.css` — responsive search styling.
- **FILE-007**: `src/lib/constants.ts` — endpoint route constant.

## 6. Testing

- **TEST-001**: Verify duplicate tracks group appearances from multiple shows.
- **TEST-002**: Verify artist and title matching is case- and diacritic-insensitive.
- **TEST-003**: Verify exact and prefix matches rank ahead of substring matches and result limits apply.
- **TEST-004**: Verify malformed shows without slugs or tracklists do not produce unusable entries.
- **TEST-005**: Verify tests, typecheck, lint, and static production build pass.
- **TEST-006**: Verify the production endpoint contains track entries and internal show links.

## 7. Risks & Assumptions

- **RISK-001**: A stable endpoint URL can be browser-cached across data refreshes; the response must require revalidation.
- **RISK-002**: Artist strings containing multiple collaborators remain one display value; substring and token matching still finds individual names.
- **ASSUMPTION-001**: `shows.generated.json` retains tracklists copied from the human-edited source file during enrichment.
- **ASSUMPTION-002**: The current archive is small enough for one lazy JSON download and in-browser filtering.

## 8. Related Specifications / Further Reading

- `docs/show-archive-prd.md`
- `docs/decisions/001-static-track-search.md`
- `AGENTS.md`
