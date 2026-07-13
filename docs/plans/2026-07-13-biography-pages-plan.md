# Plan: Biography pages for Kelly and Sam

## Goal

Add a DJs section for the site with a landing page, individual DJ biography pages for Kelly and Sam, and a graceful fallback for unknown slugs so broken or unpublished links do not produce an unhelpful experience.

## Scope

- Create a DJs landing page that introduces the roster and links to individual DJ profiles.
- Create dedicated biography pages for Kelly and Sam under a DJs route structure.
- Use Markdown-based content so both profile pages share a consistent template and stay easy to maintain.
- Add a catch-all route for unknown DJ slugs so invalid or future routes can render a useful 404-style page.
- Add navigation entry points so the pages are discoverable from the main site experience.

## Proposed implementation

1. Create a Markdown-based content structure for DJs using Astro’s content collections workflow, with one content file per person and a shared template for rendering.
2. Add a DJs landing page at a route such as /djs/ that lists the available profiles and provides a clear entry point into the section.
3. Add a dynamic route such as /djs/[slug]/ that renders the shared biography template for valid entries and uses the content collection data to populate the page.
4. Add a catch-all 404 route for unmatched DJ slugs so unknown or unpublished profiles display a helpful fallback instead of a generic broken page.
5. Reuse the existing shared layout wrapper and visual system from the rest of the site.
6. Add styling for the DJs landing page and biography layout in the global stylesheet using the current band/panel patterns.
7. Add links from the main header or footer so visitors can reach the DJs section without friction.
8. Verify by building the site and checking that the landing page, valid DJ routes, and fallback behaviour all render correctly.

## File touchpoints

- src/content/ — new DJ biography Markdown content files
- src/pages/djs/ — landing page and dynamic DJ routes
- src/layouts/PuntersLayout.astro — shared page shell
- src/components/AppHeader.astro — navigation entry point
- src/styles/global.css — DJs landing page and biography layout styling
- src/lib/constants.ts — route constants if navigation is centralized

## Notes

- Prefer static Astro pages and content collections over a heavier dynamic system for this feature.
- Use Markdown for biography copy to keep content editable and consistent with Astro’s content collection approach.
- Favor a simple editorial layout that matches the site’s existing tone rather than a more complex component system.
- The 404-style fallback should be explicit and useful, with a clear message and a link back to the DJs landing page or home page.
