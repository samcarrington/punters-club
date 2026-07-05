# Show Archive and Show Detail Pages PRD

## 1. Executive Summary

- **Problem Statement**: The current show archive is useful for browsing recent shows, but individual shows are not independently indexable, shareable, or expandable with richer content such as descriptions and track listings.
- **Proposed Solution**: Add a dedicated show archive page and static show detail pages generated from slugs. The archive page will list all shows with sorting by date or listens, and each show page will include an embedded player, description, and manually maintained track listing module.
- **Success Criteria**:
  - 100% of archive shows have a stable, human-readable slug and generated detail page.
  - Show detail pages are indexable and include unique page titles, descriptions, canonical URLs, and structured content.
  - Archive-to-detail click-through rate can be measured and increases from baseline after launch.
  - Mixcloud/player engagement can be measured and increases from baseline after launch.
  - Archive and detail pages pass WCAG 2.2 AA-oriented accessibility checks and production Astro build validation.

## 2. User Experience & Functionality

- **User Personas**:
  - **Returning listener**: Wants to find and replay older shows quickly.
  - **New visitor**: Lands from search/social and needs context before listening.
  - **Music collector/crate-digger**: Wants to inspect track listings before or during playback.
  - **Site editor**: Needs a simple repo-based way to add show metadata and track listings.

- **User Stories**:
  - As a listener, I want to browse a complete show archive so that I can find older shows without relying on the homepage.
  - As a listener, I want to sort archive shows by date or listens so that I can find either the newest or most popular shows.
  - As a listener, I want to open an individual show page so that I can listen, read the description, and view the track listing in one place.
  - As a new visitor, I want each show page to have a clear title, description, and player so that I understand what I’m listening to before pressing play.
  - As a site editor, I want track listings to be maintained manually in JSON so that the site does not depend on incomplete third-party metadata.
  - As a maintainer I want the listing page and the show page to include structured data (ld+json) describing the list/show

- **Acceptance Criteria**:
  - The site includes a dedicated archive route, e.g. `/shows/`.
  - The archive page lists every show from the existing show data source, excluding only invalid or unpublished entries.
  - The Pages use consistent styles and components with the prior art in the landing page
  - Each archive item includes at minimum:
    - show title
    - date or publish date
    - listen/play count where available
    - short description or excerpt where available
    - link to the show detail page
  - The archive page supports sorting by:
    - newest/oldest date
    - highest/lowest listens
  - Sorting controls are keyboard accessible, labelled, and preserve readable fallback behaviour if JavaScript is unavailable.
  - Each show has a stable slug.
  - Each show detail page is generated at `/shows/[slug]/`.
  - Each show detail page includes:
    - show title
    - embedded Mixcloud player
    - description
    - date
    - listen/play count where available
    - track listing module
    - link back to the archive
  - Track listings are sourced from manually edited JSON.
  - If a show has no track listing yet, the page displays a clear empty state rather than broken UI.
  - Detail pages include unique SEO metadata:
    - `<title>`
    - meta description
    - canonical URL
    - Open Graph title/description where appropriate
  - Production validation must pass with `pnpm exec astro build`.

- **Non-Goals**:
  - No CMS integration.
  - No user accounts, comments, favourites, or ratings.
  - No automatic track extraction from Mixcloud audio.
  - No Spotify/Tidal playlist matching for show tracks in MVP.
  - No server-side rendering requirement; pages should remain statically generated.

## 3. AI System Requirements (If Applicable)

Not applicable. This feature does not require AI functionality.

## 4. Technical Specifications

- **Architecture Overview**:
  - Use Astro static routing.
  - Add an archive page under `src/pages/shows/index.astro`.
  - Add dynamic show detail generation under `src/pages/shows/[slug].astro`.
  - Extend show data so every generated show has a slug.
  - Add a manual track-listing data source, likely JSON under `src/data/`.
  - Join show metadata and track listings at build time.

- **Integration Points**:
  - Existing generated show metadata: `src/data/shows.generated.json`.
  - Existing human-edited show source data: `src/data/show-sources.json`.
  - New manual track listing data source: `TBD`, recommended `src/data/show-tracks.json`.
  - Existing Mixcloud player/widget helpers should be reused where possible.
  - No authentication required.
  - No database required.

- **Security & Privacy**:
  - No personal user data is collected by the feature itself.
  - Embedded Mixcloud players should retain existing privacy/security attributes used elsewhere in the site.
  - External links should use safe link attributes where applicable.
  - Build-time data parsing should fail clearly on malformed required fields such as duplicate slugs.

## 5. Risks & Roadmap

- **Phased Rollout**:
  - **MVP**:
    - Add `/shows/` archive page.
    - Add `/shows/[slug]/` detail pages.
    - Add slug support.
    - Add manual JSON track listings.
    - Add sorting by date and listens.
  - **v1.1**:
    - Add richer SEO/Open Graph imagery.
    - Add previous/next show navigation.
    - Add filter/search by title, tags, or year.
  - **v2.0**:
    - Add structured data for music/radio episodes if appropriate.
    - Add analytics events for archive sort usage, show clicks, and player engagement.
    - Consider automated enrichment of track metadata if reliable sources are available.

- **Technical Risks**:
  - Existing show data may not contain reliable dates for every show.
  - Listen counts may be missing or stale if Mixcloud enrichment fails.
  - Slug generation must avoid collisions and preserve stable URLs over time.
  - Manual track listings may become inconsistent unless validation is added.
  - Running full `pnpm run build` may update generated Mixcloud metadata; UI-only validation should prefer `pnpm exec astro build` unless enrichment changes are intentional.
