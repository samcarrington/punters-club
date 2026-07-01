# PRD: Structured Data for Shows and Playlists

## 1. Executive Summary

**Problem Statement**: The listing page presents a clear archive of radio shows and playlists to humans, but search engines and AI agents currently have to infer the page structure from HTML content alone. This limits reliable agent parsing, Generative Engine Optimization (GEO), and conventional SEO understanding of the site's media catalog.

**Proposed Solution**: Add JSON-LD structured data to the existing Astro static listing page using Schema.org `CollectionPage`, with separate `ItemList` entities for archived shows and playlists. Model shows as `RadioEpisode` items and playlists as `MusicPlaylist` items, generated from the current static JSON data used by the page.

**Success Criteria**:

- The production listing page includes exactly one valid JSON-LD graph describing the page, show archive, and playlist collection.
- The structured data validates with zero errors in Schema.org Validator for the rendered page HTML.
- Google Rich Results Test reports no structured-data syntax errors, while accepting that music/radio lists may not qualify for rich-result display.
- `pnpm exec astro build` completes successfully without refreshing or requiring external metadata.
- Structured data content is generated from the same source objects as the visible show and playlist UI, with no manually duplicated show or playlist lists.

## 2. User Experience & Functionality

**User Personas**:

- **Search engine crawler**: Needs machine-readable context for the page, its entities, and outbound media links.
- **AI agent or assistant**: Needs reliable extraction of shows, playlists, titles, providers, genres, and canonical URLs for answering user questions or summarizing the site.
- **Site maintainer**: Needs structured data that stays in sync with existing static data and does not create a second content-maintenance workflow.
- **Listener discovering the site through search or agents**: Benefits from clearer indexing and more accurate summaries of the site's shows and playlists.

**User Stories**:

- As an AI agent, I want the listing page to expose show and playlist entities as structured data so that I can parse the catalog without guessing from presentation markup.
- As a search crawler, I want the page to identify itself as a media collection so that I can understand the relationship between the homepage, show archive, and playlist list.
- As a site maintainer, I want JSON-LD generated from existing data so that adding a show or playlist does not require editing structured data by hand.
- As a future implementer, I want the schema model to support future detail pages so that individual shows and playlists can later receive richer standalone metadata.

**Acceptance Criteria**:

- For the AI-agent story:
  - The rendered page includes a `CollectionPage` JSON-LD entity.
  - The `CollectionPage.mainEntity` contains one `ItemList` named `Archive shows` and one `ItemList` named `Playlists`.
  - Each show list item includes `@type: "RadioEpisode"`, `name`, `url`, and `position`.
  - Each playlist list item includes `@type: "MusicPlaylist"`, `name`, `url`, `description` when available, and `position`.

- For the search-crawler story:
  - The JSON-LD uses `https://schema.org` as `@context`.
  - Show entities include `partOfSeries` with a `RadioSeries` named `The Punters' Club`.
  - Show entities include `genre` only when genre/tag data is available.
  - Image URLs are included only when the generated data provides an artwork or thumbnail URL.
  - No property is populated with a guessed value solely to satisfy a schema field.

- For the maintainer story:
  - The implementation reads from the existing generated show and playlist data already imported by `src/pages/index.astro`.
  - There is a single structured-data builder or helper function, rather than inline repeated object construction in multiple components.
  - Adding, removing, or reordering shows/playlists in the existing data flow updates `position` values automatically on build.
  - The structured data is emitted server-side in the static HTML and does not require client-side JavaScript.

- For the future-detail-page story:
  - The schema model can be reused for a future standalone show page as a top-level `RadioEpisode`.
  - The schema model can be reused for a future standalone playlist page as a top-level `MusicPlaylist`.
  - Future-only properties, such as full track lists, `numTracks`, embedded audio URLs, and transcript-like descriptions, are not required for the MVP.

**Non-Goals**:

- Do not build individual show or playlist detail pages as part of the MVP.
- Do not add track-level metadata unless it already exists in the local data model.
- Do not scrape Spotify, Tidal, or Mixcloud pages for extra schema fields.
- Do not claim Google carousel eligibility for shows or playlists, because current Google carousel documentation only supports selected content types.
- Do not use `Event` schema for archived shows unless the site later publishes upcoming live broadcasts or in-person events.
- Do not use `MusicRecording` for shows, because a radio/DJ show is not a single music track.
- Do not put Mixcloud page URLs into `AudioObject.contentUrl`; use audio/embed fields only when an actual media or embed URL is available.

## 3. AI System Requirements (If Applicable)

This is not an AI-powered feature, but AI and agent consumers are a primary target of the output.

**Tool Requirements**:

- JSON-LD output must be readable from the static HTML without executing JavaScript.
- Entity names, descriptions, genres, URLs, providers, and positions must be explicit enough for crawlers and agents to parse deterministically.
- The schema should prefer stable, standards-based Schema.org types:
  - `CollectionPage` for the listing page.
  - `ItemList` and `ListItem` for ordered collections.
  - `RadioEpisode` and `RadioSeries` for archived radio shows.
  - `MusicPlaylist` for external playlists.
  - `Organization` or `MusicGroup` may be considered later if the site adds richer entity pages for The Punters' Club or Radio Waters.

**Evaluation Strategy**:

- Validate the rendered page in Schema.org Validator and require zero errors.
- Validate the rendered page in Google Rich Results Test and require zero syntax or parsing errors.
- Add a lightweight local verification step that parses the emitted JSON-LD from built HTML and checks:
  - valid JSON syntax;
  - expected top-level `@context`;
  - exactly two `ItemList` entries;
  - show item count equals visible source show count used by the page;
  - playlist item count equals source playlist count used by the page;
  - every `ListItem.position` is a positive integer and strictly ordered.

## 4. Technical Specifications

**Architecture Overview**:

- The existing Astro page remains the source of composition for the listing page.
- A structured-data helper builds a JSON-LD object from the same `shows`, `archiveShows`, `latestShow`, and `playlists` data already used for rendering.
- The listing page serializes the JSON-LD into a `<script type="application/ld+json">` element in the page output.
- The schema graph should be generated at build time as part of Astro's static rendering.

Recommended MVP structure:

```json
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "The Punters' Club | Radio Waters",
  "description": "The Punters' Club: disco and modern electronic selections from a husband-and-wife DJ duo on Radio Waters.",
  "mainEntity": [
    {
      "@type": "ItemList",
      "name": "Archive shows",
      "itemListElement": []
    },
    {
      "@type": "ItemList",
      "name": "Playlists",
      "itemListElement": []
    }
  ]
}
```

Show item shape:

```json
{
  "@type": "ListItem",
  "position": 1,
  "item": {
    "@type": "RadioEpisode",
    "name": "The Punters' Club - Spring Forward",
    "url": "https://www.mixcloud.com/radiowaters/the-punters-club-spring-forward/",
    "partOfSeries": {
      "@type": "RadioSeries",
      "name": "The Punters' Club"
    }
  }
}
```

Playlist item shape:

```json
{
  "@type": "ListItem",
  "position": 1,
  "item": {
    "@type": "MusicPlaylist",
    "name": "Sample Sources",
    "description": "A growing list of source tracks from crate diggers and record collectors",
    "url": "https://open.spotify.com/playlist/..."
  }
}
```

Complete reference JSON-LD example:

```json
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "The Punters' Club | Radio Waters",
  "description": "The Punters' Club: disco and modern electronic selections from a husband-and-wife DJ duo on Radio Waters.",
  "url": "https://example.com/",
  "mainEntity": [
    {
      "@type": "ItemList",
      "name": "Archive shows",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "item": {
            "@type": "RadioEpisode",
            "name": "The Punters' Club - Spring Forward",
            "url": "https://www.mixcloud.com/radiowaters/the-punters-club-spring-forward/",
            "genre": ["Disco", "Electronic"],
            "image": "https://thumbnail.example/show-artwork.jpg",
            "partOfSeries": {
              "@type": "RadioSeries",
              "name": "The Punters' Club",
              "url": "https://www.mixcloud.com/radiowaters/"
            }
          }
        },
        {
          "@type": "ListItem",
          "position": 2,
          "item": {
            "@type": "RadioEpisode",
            "name": "Gwawr & Kelsurprise - The Punters' Club (30 May)",
            "url": "https://www.mixcloud.com/radiowaters/gwawr-kelsurprise-the-punters-club-30-may/",
            "description": "Gwawr and KelSurprise bringing sundown-sounds to the hot evening",
            "partOfSeries": {
              "@type": "RadioSeries",
              "name": "The Punters' Club",
              "url": "https://www.mixcloud.com/radiowaters/"
            }
          }
        }
      ]
    },
    {
      "@type": "ItemList",
      "name": "Playlists",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "item": {
            "@type": "MusicPlaylist",
            "name": "Sample Sources",
            "description": "A growing list of source tracks from crate diggers and record collectors",
            "url": "https://open.spotify.com/playlist/0FHIhH7YFk4bsWVUYnJLu4",
            "image": "https://thumbnail.example/playlist-artwork.jpg",
            "provider": {
              "@type": "Organization",
              "name": "Spotify"
            }
          }
        },
        {
          "@type": "ListItem",
          "position": 2,
          "item": {
            "@type": "MusicPlaylist",
            "name": "Cam and Kruder",
            "description": "Revisiting some Trip Hop classics with a new lens",
            "url": "https://tidal.com/playlist/c7db223a-6940-46ea-bf84-e758f5fce676",
            "provider": {
              "@type": "Organization",
              "name": "Tidal"
            }
          }
        }
      ]
    }
  ]
}
```

The example above is illustrative. Production output must replace placeholder `example.com` and thumbnail URLs with configured site URLs or real generated media URLs, and omit optional fields when their source data is unavailable.

**Integration Points**:

- `src/pages/index.astro`: imports data, composes latest show/archive/playlist sections, and should emit the JSON-LD script.
- `src/data/shows.generated.json`: generated show metadata from Mixcloud API enrichment.
- `src/data/playlists.generated.json`: generated playlist metadata from Spotify oEmbed enrichment and source fallbacks.
- `src/lib/mixcloud.ts`: show type definitions and normalization context.
- `src/lib/platform.ts`: playlist provider detection can support `provider` metadata in playlist schema.
- No database, authentication, or client-side API integration is required.

**Security & Privacy**:

- Structured data must contain only content already intended to be public on the rendered page or in public source data.
- Do not include private account identifiers, unpublished notes, build environment details, API keys, or raw enrichment responses.
- JSON-LD serialization must safely escape characters that could break out of the script tag.
- External URLs should be limited to canonical public Mixcloud, Spotify, Tidal, or site URLs already used by the visible UI.

## 5. Risks & Roadmap

**Phased Rollout**:

- **MVP**:
  - Add JSON-LD to the listing page.
  - Use `CollectionPage`, two `ItemList`s, `RadioEpisode`, `RadioSeries`, and `MusicPlaylist`.
  - Include only fields already available from current static data.
  - Validate rendered HTML with Schema.org Validator and Google Rich Results Test.

- **v1.1**:
  - Add a local structured-data verification script or test.
  - Add provider metadata for playlists using existing platform detection.
  - Add `datePublished` for shows only if dates become explicit structured fields rather than inferred from titles.
  - Add canonical site URL fields if the deployment domain is formalized in config.

- **v2.0**:
  - Reuse schema builders for future individual show and playlist detail pages.
  - Add `AudioObject` or `embedUrl` only if reliable embed/media URLs are available.
  - Add track-level `track` and `numTracks` metadata only if playlist track data is added to the static data flow.
  - Consider richer identity schema for The Punters' Club and Radio Waters if the site gains dedicated about/profile pages.

**Technical Risks**:

- **Rich result mismatch**: The schema may validate semantically but not produce Google rich results because music/radio collections are not currently supported carousel types. Mitigation: define success around validation and machine readability, not guaranteed rich-result appearance.
- **Data drift**: Duplicated schema construction could fall out of sync with visible UI. Mitigation: generate schema from the same imported objects and order used by the page.
- **Overclaiming metadata**: Inferring dates, audio URLs, or track counts from titles and external pages could create inaccurate structured data. Mitigation: include only fields that exist in local data or are reliably derived by existing code.
- **Script escaping**: Unescaped titles or descriptions could break JSON-LD output. Mitigation: serialize with `JSON.stringify` and escape closing script tags and unsafe HTML characters where needed.
- **Generated metadata churn**: Running the full enrichment build can alter generated JSON unrelated to schema work. Mitigation: use `pnpm exec astro build` for implementation verification unless enrichment changes are explicitly in scope.

**Reference Links**:

- Schema.org `CollectionPage`: https://schema.org/CollectionPage
- Schema.org `ItemList`: https://schema.org/ItemList
- Schema.org `RadioEpisode`: https://schema.org/RadioEpisode
- Schema.org `RadioSeries`: https://schema.org/RadioSeries
- Schema.org `MusicPlaylist`: https://schema.org/MusicPlaylist
- Schema.org `AudioObject`: https://schema.org/AudioObject
- Google Search structured data general guidelines: https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- Google carousel structured data guidance: https://developers.google.com/search/docs/appearance/structured-data/carousel
