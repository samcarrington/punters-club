# The Punters' Club

[![Live Site](https://img.shields.io/badge/live-thepunters.club-CB6D43?logo=safari&logoColor=white)](https://www.thepunters.club)
[![Deploy Status](https://deploy-badge.vercel.app/?url=https://www.thepunters.club&name=vercel)](https://vercel.com/samcarrington-8470s-projects/punters-club/)
[![Astro](https://img.shields.io/badge/Astro-7.0-FF5D01?logo=astro&logoColor=white)](https://astro.build)
[![Node](https://img.shields.io/badge/Node-%3E%3D22.12-5FA04E?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-11.9-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)

Static Astro site for The Punters' Club on Radio Waters: latest Mixcloud show, archive links, and playlist offshoots.

## Requirements

- Node `>=22.12.0`
- pnpm (this repo uses `pnpm-lock.yaml`)

## Commands

```sh
pnpm install
pnpm run dev       # local Astro dev server
pnpm run build     # astro build only - does not call any third-party APIs
pnpm run preview   # preview the built static site
pnpm run lint      # check formatting, lint rules, and import order (Biome)
pnpm run lint:fix  # apply safe fixes for the above
pnpm run typecheck # tsc --noEmit
```

To refresh generated show/playlist/next-show metadata locally:

```sh
pnpm run enrich    # runs enrich:shows, enrich:playlists, enrich:next-show in sequence
```

## Content and data flow

- Edit show inputs in `src/data/show-sources.json`.
- Keep `docs/shows.md` aligned as the human-readable show ordering/title reference.
- Edit playlist inputs in `src/data/playlist-sources.json`.
- `pnpm run enrich` updates:
  - `src/data/shows.generated.json` from Mixcloud API data
  - `src/data/playlists.generated.json` from Spotify oEmbed data
- Enrichment falls back to previous generated data or source-only data when external fetches fail, and logs a warning with context when it does.
- Generated JSON is committed to the repo and kept fresh by scheduled GitHub Actions (`.github/workflows/shows-refresh.yml` and `.github/workflows/next-show-refresh.yml`), which open a PR when the data changes. The production build (`pnpm run build`) never calls Mixcloud/Spotify/Tidal/Tribe Events itself, so deploys aren't affected by unrelated upstream outages and rebuilding an old commit reproduces the same output.

Homepage ordering is defined in `src/pages/index.astro` using the shared `sortShows` helper from `src/lib/shows.ts`.

## Project notes

- Main source lives under `src/` (`astro.config.mjs` sets `srcDir: './src'`).
- Brand and design constraints live in `PRODUCT.md`.
- Agent-specific repo guidance lives in `AGENTS.md`.
