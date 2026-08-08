# AGENTS.md

## Repo shape
- Single Astro static site; source root is `src/` (`astro.config.mjs` sets `srcDir: './src'`).
- Use pnpm and `pnpm-lock.yaml`; do not reintroduce `package-lock.json`.
- Astro dependency requires a current Node line (`^20.19.0 || >=22.12.0` via lockfile packages).
- Deployed on Vercel; build/install/output settings are pinned in `vercel.json` (framework `astro`, `pnpm run build`, `pnpm install --frozen-lockfile`, output `dist`) rather than left to dashboard defaults - keep it in sync if the build pipeline changes.

## Commands
- Dev server: `pnpm run dev`.
- Production build: `pnpm run build` (`astro build` only - does not call live third-party APIs).
- Refresh generated Mixcloud/Spotify/Tidal metadata locally: `pnpm run enrich` (or the individual `pnpm run enrich:shows` / `enrich:playlists` / `enrich:next-show` scripts).
- Preview the built site: `pnpm run preview`.
- Typecheck: `pnpm run typecheck` (`tsc --noEmit`).
- Lint (formatting, lint rules, import order via Biome): `pnpm run lint`; auto-fix safe issues with `pnpm run lint:fix`.

## Data flow and generated files
- Human-edited content inputs are `src/data/show-sources.json` and `src/data/playlist-sources.json`; `docs/shows.md` is a reference list for show ordering/titles and should stay consistent when show sources change.
- `scripts/enrich-shows.ts` writes `src/data/shows.generated.json` from Mixcloud API data, falling back to the previous generated entry or source-only data on fetch failure.
- `scripts/enrich-playlists.ts` writes `src/data/playlists.generated.json` from Spotify oEmbed data, falling back the same way.
- Generated JSON (`shows.generated.json`, `playlists.generated.json`, `next-show.generated.json`) is committed to the repo and refreshed by scheduled GitHub Actions (`.github/workflows/shows-refresh.yml`, `.github/workflows/next-show-refresh.yml`), not by the production build. `pnpm run build` runs `astro build` only and does not refetch third-party data, so it is deterministic and unaffected by upstream API outages. If a task needs fresh metadata, run `pnpm run enrich` locally or dispatch the relevant workflow.
- Homepage ordering is code-defined in `src/pages/index.astro` via `sortShows(..., "newest")` from `src/lib/shows.ts`.

## UI/product constraints
- `PRODUCT.md` is the compact brand brief: listening-first, nocturnal/crate-dug tone, avoid SaaS/festival/corporate polish, target WCAG 2.2 AA.
- Avoid repeating rounded-card treatments everywhere; existing design uses bands/rails/asymmetry to break repetition.
- `src/components/ShowArchive.astro` intentionally shows 6 archive shows first, then reveals the rest; keep the `has-js`/data-attribute disclosure behavior scoped to this component.

## Tooling quirks
- `biome.json` configures formatting/lint rules; wired into `pnpm run lint` / `pnpm run lint:fix`. It respects `.gitignore` (`vcs.useIgnoreFile`) and explicitly excludes non-project tool-cache dirs (`.build-cache`, `.pnpm-store`, `.claude`, `.dialogue`, `.vscode`, `.hallmark`, `.impeccable`).
- Astro files have Biome unused-import/unused-variable rules disabled via `overrides`; do not “fix” that unless the Astro false positives are addressed.
- The Astro docs MCP (`https://mcp.docs.astro.build/mcp`) is configured for both OpenCode (`opencode.json`) and Claude Code (`.mcp.json`); use it for Astro API/docs checks when needed.
