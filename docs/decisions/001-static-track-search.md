# ADR-001: Use a prerendered track index with client-side filtering

## Status

Accepted

## Date

2026-09-03

## Context

The archive needs autocomplete-style search across artists and song titles, with each result identifying the show or shows where the track appeared. The site currently builds to static files and deploys the `dist` directory to Vercel. Show data is public, committed, refreshed outside the production build, and small enough to filter in a browser.

Introducing interactivity creates two independent choices: where filtering runs and whether a client UI framework is required. A runtime Vercel function would require Astro server output or a separately managed function. A Vue island would require Vue and Astro's Vue integration even though the feature has one input and one result list.

## Decision

Generate `/api/tracks.json` as an Astro static endpoint during `astro build`. Build its typed payload from `shows.generated.json`, grouping case-insensitive duplicate artist/title pairs and including stable internal show links.

Add an Astro component with a bundled, framework-free TypeScript script. It lazily fetches the static endpoint on first interaction and performs normalized, ranked filtering in the browser. The server-rendered archive remains complete without JavaScript; only search enhancement depends on JavaScript.

## Alternatives Considered

### Vercel serverless search function

- Pros: Small response per query; server owns ranking; scales to private or very large data.
- Cons: Adds runtime infrastructure, cold starts, request cost, and deployment coupling for a small public dataset.
- Rejected: Current data size and refresh frequency do not justify runtime compute.

### Vue island with an embedded or fetched index

- Pros: Declarative state and rendering; natural path if the archive becomes a larger client application.
- Cons: Adds Vue, an Astro integration, hydration JavaScript, and framework conventions for one isolated control.
- Rejected: Native DOM APIs provide the required behavior with less shipped code and no new dependency.

### Embed index in archive HTML

- Pros: No secondary request; search works immediately after script execution.
- Cons: Every archive visit pays the track-index transfer cost, including visitors who never search.
- Rejected: Lazy fetching better preserves the archive's initial page weight.

## Consequences

- Static deployment and deterministic builds remain unchanged.
- The endpoint is a network resource but not a runtime API; query parameters do not filter server-side.
- Search logic is independently unit tested and shared by endpoint construction and browser filtering.
- New tracklists become searchable after enrichment updates committed generated data and the site rebuilds.
- A future server-backed implementation can preserve the response shape and component while replacing the endpoint internals.
