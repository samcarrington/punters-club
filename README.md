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
pnpm run dev      # local Astro dev server
pnpm run build    # refresh generated show/playlist metadata, then build
pnpm run preview  # preview the built static site
```

For UI-only validation without refreshing generated metadata:

```sh
pnpm exec astro build
```

## Content and data flow

- Edit show inputs in `src/data/show-sources.json`.
- Keep `docs/shows.md` aligned as the human-readable show ordering/title reference.
- Edit playlist inputs in `src/data/playlist-sources.json`.
- `pnpm run enrich` updates:
  - `src/data/shows.generated.json` from Mixcloud API data
  - `src/data/playlists.generated.json` from Spotify oEmbed data
- Enrichment falls back to previous generated data or source-only data when external fetches fail.

Homepage ordering is defined in `src/pages/index.astro`: the last generated show is the latest show; previous shows are reversed into the archive.

## Project notes

- Main source lives under `src/` (`astro.config.mjs` sets `srcDir: './src'`).
- Brand and design constraints live in `PRODUCT.md`.
- Agent-specific repo guidance lives in `AGENTS.md`.
