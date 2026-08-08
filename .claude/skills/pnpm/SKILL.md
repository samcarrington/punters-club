---
name: pnpm
description: "Run pnpm build, test, lint, and dev commands for this repository.
  Use when the user asks to build, test, lint, run, preview, or enrich data with
  pnpm, or invokes the pnpm command."
---

# pnpm Build

## Project Info
- **Tool:** pnpm 11.9.0 (pinned via `packageManager` field, activated through corepack)
- **Config file:** `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`
- **Language:** Astro (TypeScript) static site
- **Node:** `>=22.12.0` (also compatible with `^20.19.0` per Astro's dependency range)

## Prerequisites

None. No environment variables or API keys are required — the enrich scripts
(Mixcloud, Spotify) fall back to previously generated or source-only data if the
external fetch fails.

## Quick Commands

### Dev server
```bash
pnpm run dev
```

### Build (UI-only, default)
```bash
pnpm exec astro build
```
Skips the enrich step. Use this for day-to-day UI/content work — it's faster and
doesn't touch generated show/playlist JSON.

### Full production build (with data refresh)
```bash
pnpm run build
```
Runs `pnpm run enrich` (Mixcloud shows, Spotify playlists, next-show) then
`astro build`. This is what generates fresh `*.generated.json` files. Only use
when you actually want to refresh show/playlist/play-count data — otherwise it
introduces unrelated JSON churn into a UI-only change.

### Preview built site
```bash
pnpm run preview
```

### Run tests
```bash
pnpm run test
```

### Run tests with coverage (routine practice before merging)
```bash
pnpm run test:coverage
```

### Enrich data only (without building)
```bash
pnpm run enrich
```
Individual steps: `pnpm run enrich:shows`, `pnpm run enrich:playlists`,
`pnpm run enrich:next-show`.

## Opt-in / Manual-Only Commands

### Remote next-show test
```bash
RUN_REMOTE_TESTS=1 pnpm run test:next-show:remote
```
Hits a live API rather than mocks. Not part of the default `pnpm run test` suite —
run manually when validating next-show fetch behaviour specifically, not routinely.

### Structured data verification
```bash
pnpm run verify:structured-data
```

## Lint / Typecheck

### Lint (formatting, lint rules, import order)
```bash
pnpm run lint
```

### Auto-fix safe lint/format issues
```bash
pnpm run lint:fix
```

Both run `biome check` (`@biomejs/biome`, config in `biome.json`) — this covers
formatting, lint rules, and import ordering in one pass. Biome respects
`.gitignore` and additionally excludes non-project tool-cache directories
(`.build-cache`, `.pnpm-store`, `.claude`, `.dialogue`, `.vscode`, `.hallmark`,
`.impeccable`) via `files.includes` in `biome.json` — don't remove those excludes,
Biome will otherwise try to read into unrelated local tool state and can error.

Astro files have `noUnusedImports`/`noUnusedVariables` disabled via an override
in `biome.json` (Astro frontmatter produces false positives) — don't "fix" that
override unless the underlying false positives are addressed upstream.

There is **no typecheck script** in this repo. `pnpm exec astro build` (or the
full `pnpm run build`) is the fallback verification step for type errors.

## Common Flags

| Flag/Pattern | Purpose | When to Use |
|---|---|---|
| `pnpm exec astro build` | Build without enrich | Default for UI-only changes |
| `pnpm run build` | Build with enrich | Only when refreshing generated data intentionally |
| `pnpm install --frozen-lockfile` | Strict install (used in CI) | CI/reproducible installs; local dev can use plain `pnpm install` |

## Troubleshooting

- If a UI-only change unexpectedly modifies `src/data/*.generated.json`, you likely
  ran `pnpm run build` instead of `pnpm exec astro build` — revert the unrelated
  generated-file churn.
- Do not reintroduce `package-lock.json`; this repo is pnpm-only.
