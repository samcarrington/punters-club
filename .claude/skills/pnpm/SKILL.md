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

### Build (production and UI-only, same command)
```bash
pnpm run build
```
Equivalent to `pnpm exec astro build`. The build does **not** call any
third-party API — it never touches generated show/playlist/next-show JSON.
Generated data is refreshed separately (see below) and committed to the repo,
so builds are deterministic and unaffected by upstream API outages.

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

### Refresh generated show/playlist/next-show data
```bash
pnpm run enrich
```
Individual steps: `pnpm run enrich:shows`, `pnpm run enrich:playlists`,
`pnpm run enrich:next-show`. Run this when you intentionally want to refresh
show/playlist/play-count data — otherwise it introduces unrelated JSON churn
into a UI-only change. In production this runs on a schedule via
`.github/workflows/shows-refresh.yml` and `.github/workflows/next-show-refresh.yml`,
which open a PR when the generated data changes; it is no longer part of the
build step.

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

### Typecheck
```bash
pnpm run typecheck
```
Runs `tsc --noEmit`.

## Common Flags

| Flag/Pattern | Purpose | When to Use |
|---|---|---|
| `pnpm run build` | Build (astro build only) | Always — build never touches generated data |
| `pnpm run enrich` | Refresh generated JSON | Only when refreshing generated data intentionally |
| `pnpm install --frozen-lockfile` | Strict install (used in CI) | CI/reproducible installs; local dev can use plain `pnpm install` |

## Troubleshooting

- If a UI-only change unexpectedly modifies `src/data/*.generated.json`, you likely
  ran `pnpm run enrich` (or one of the `enrich:*` scripts) unintentionally —
  revert the unrelated generated-file churn.
- Do not reintroduce `package-lock.json`; this repo is pnpm-only.
