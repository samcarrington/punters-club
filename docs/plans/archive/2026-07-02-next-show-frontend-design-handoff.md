# Handoff: Next Show front-end design implementation

## Objective

Design and implement the polished front-end treatment for the placeholder `NextShow.astro` module on the Punters Club homepage.

This is the deferred design work from:

- `[design-001]` NextShow card visual/UX design
- Part of `[design-002]` Homepage placement/page UI/UX, but **do not add JSON-LD Event structured data unless explicitly asked**

## Branch

Work on:

```bash
feature/next-event-front-end
```

## Relevant files

Primary:

- `src/components/NextShow.astro`
- `src/pages/index.astro`
- `src/styles/global.css`
- `src/styles/tokens.css`
- `PRODUCT.md`

Supporting data/types:

- `src/data/next-show.generated.json`
- `src/lib/next-show.ts`

## Current implementation state

The backing/data work is complete.

`NextShow.astro` currently:

- imports `src/data/next-show.generated.json`
- handles `status: "upcoming"` and `status: "none"`
- formats date/time with `Intl.DateTimeFormat("en-GB", { timeZone })`
- renders a minimal placeholder card:
  - date/time
  - title
  - description
  - link to the Radio Waters event URL

Generated data currently includes a guest appearance:

```json
{
  "status": "upcoming",
  "show": {
    "title": "Saturday Night In With…",
    "startsAtUtc": "2026-07-04T18:00:00.000Z",
    "timezone": "Europe/London",
    "matchedBy": "guest"
  }
}
```

The component has a TODO:

```astro
// TODO [design-001]: visual/UX polish — poster treatment, hierarchy, empty-state copy.
```

## Design direction

Follow the existing product/brand direction:

- Listening-first, nocturnal, crate-dug, warm, slightly off-centre.
- Avoid SaaS/festival/corporate polish.
- Avoid repeating rounded-card treatments everywhere.
- Existing design uses bands, rails, asymmetry, texture, and contrast.
- Target WCAG 2.2 AA.
- Keep the site feeling hand-curated rather than generic.

Important prior design decisions:

- Latest show already uses a banded/asymmetrical section.
- Ethos/pre-footer uses full-bleed structural treatment.
- Archive intentionally has scoped progressive disclosure.
- Avoid turning every section into another rounded panel.

## Scope

Implement polished UI/UX for the next-show module, including:

- Stronger visual hierarchy for date/time, show title, and description.
- Clear affordance for “guest appearance” vs named Punters Club show using `matchedBy`.
- Optional poster treatment using `posterUrl` if it improves the design.
- Empty state for `status: "none"` that feels intentional, not broken.
- Responsive layout at mobile widths.
- Accessible structure, focus states, and link affordance.

## Constraints

Do **not**:

- Change the enrichment/data pipeline.
- Change `src/lib/next-show.ts` unless absolutely necessary.
- Add runtime fetching.
- Add JSON-LD Event structured data unless explicitly asked.
- Reintroduce `package-lock.json`.
- Run `pnpm run build` for UI-only validation unless you intend to handle generated metadata churn.

Prefer validation with:

```bash
pnpm exec astro build
```

If you do run `pnpm run build`, restore unrelated churn in:

- `src/data/shows.generated.json`
- `src/data/playlists.generated.json`

## Implementation notes

If rendering `posterUrl` with Astro image optimization, you may need to whitelist the Radio Waters media host in `astro.config.mjs`.

However, prefer the simplest safe implementation first:

- plain `<img>` is acceptable if poster treatment is needed
- do not add image-domain config unless the implementation requires it

## Verification

Run:

```bash
pnpm exec astro build
```

Then verify:

- Homepage builds successfully.
- `dist/index.html` contains “Next show”.
- Upcoming state renders the decoded show title.
- Empty state can be checked by temporarily changing local generated JSON, but do not commit that test change.
- No unrelated generated JSON churn remains.
- `git status --short` only shows intended files.

## Commit guidance

This is next-show functionality/design work. Use issue `#3`, not `#13`.

Suggested commit style:

```bash
feat: polish next-show module design (#3)
```
