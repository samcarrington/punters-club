# The Punters' Club

Static Astro site for The Punters' Club on Radio Waters: latest Mixcloud show, archive links, and playlist offshoots.

## Requirements

- Node `^20.19.0` or `>=22.12.0`
- npm (this repo uses `package-lock.json`)

## Commands

```sh
pnpm install
pnpm run dev      # local Astro dev server
pnpm run build    # refresh generated show/playlist metadata, then build
pnpm run preview  # preview the built static site
```

For UI-only validation without refreshing generated metadata:

```sh
npx astro build
```

## Content and data flow

- Edit show inputs in `src/data/show-sources.json`.
- Keep `docs/shows.md` aligned as the human-readable show ordering/title reference.
- Edit playlist inputs in `src/data/playlist-sources.json`.
- `npm run enrich` updates:
  - `src/data/shows.generated.json` from Mixcloud API data
  - `src/data/playlists.generated.json` from Spotify oEmbed data
- Enrichment falls back to previous generated data or source-only data when external fetches fail.

Homepage ordering is defined in `src/pages/index.astro`: the last generated show is the latest show; previous shows are reversed into the archive.

## Project notes

- Main source lives under `src/` (`astro.config.mjs` sets `srcDir: './src'`).
- Brand and design constraints live in `PRODUCT.md`.
- Agent-specific repo guidance lives in `AGENTS.md`.
