# AGENTS.md

## Repo shape
- Single Astro static site; source root is `src/` (`astro.config.mjs` sets `srcDir: './src'`).
- Use pnpm and `pnpm-lock.yaml`; do not reintroduce `package-lock.json`.
- Astro dependency requires a current Node line (`^20.19.0 || >=22.12.0` via lockfile packages).

## Commands
- Dev server: `pnpm run dev`.
- Full production build: `pnpm run build` (`pnpm run enrich && astro build`).
- Build without refreshing generated Mixcloud/Spotify metadata: `pnpm exec astro build`.
- Preview the built site: `pnpm run preview`.
- There are no repo scripts for tests, lint, or typecheck; use build as the main verification step unless you add those scripts.

## Data flow and generated files
- Human-edited content inputs are `src/data/show-sources.json` and `src/data/playlist-sources.json`; `docs/shows.md` is a reference list for show ordering/titles and should stay consistent when show sources change.
- `scripts/enrich-shows.ts` writes `src/data/shows.generated.json` from Mixcloud API data, falling back to the previous generated entry or source-only data on fetch failure.
- `scripts/enrich-playlists.ts` writes `src/data/playlists.generated.json` from Spotify oEmbed data, falling back the same way.
- `pnpm run build` can update generated play counts/artwork metadata. If the task is UI-only, restore unrelated generated JSON churn or use `pnpm exec astro build` for validation.
- Homepage ordering is code-defined in `src/pages/index.astro`: `shows.at(-1)` is the latest show; `shows.slice(0, -1).reverse()` is the archive.

## UI/product constraints
- `PRODUCT.md` is the compact brand brief: listening-first, nocturnal/crate-dug tone, avoid SaaS/festival/corporate polish, target WCAG 2.2 AA.
- Avoid repeating rounded-card treatments everywhere; existing design uses bands/rails/asymmetry to break repetition.
- `src/components/ShowArchive.astro` intentionally shows 6 archive shows first, then reveals the rest; keep the `has-js`/data-attribute disclosure behavior scoped to this component.

## Tooling quirks
- `biome.json` exists for formatting/lint rules, but Biome is not currently in `package.json` scripts or devDependencies.
- Astro files have Biome unused-import/unused-variable rules disabled via `overrides`; do not “fix” that unless the Astro false positives are addressed.
- Repo-local `opencode.json` only configures the Astro docs MCP; use it for Astro API/docs checks when needed.
