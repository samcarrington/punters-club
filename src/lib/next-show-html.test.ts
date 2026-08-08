import { describe, expect, it } from "vitest";
import { extractShowSlugsFromHtml, extractViewsTokens } from "./next-show-html";

// Trimmed fixtures modelled on real The Events Calendar (TEC) markup:
// the views-v2 nonce tokens are embedded in an inline JSON blob on
// organizer/listing pages, and event links follow TEC's `/show/<slug>/`
// (optionally dated) permalink structure.
const ORGANIZER_PAGE_HTML = `
<html>
  <body>
    <div id="tribe-events" data-view="month">
      <script type="application/json" id="tribe-events-view-data">
        {"view":"month","url":"https://example.com/dj/dj-slug/","should_manage_url":true,"tvn1":"abc123nonce","tvn2":"def456nonce","publicApiUrl":"https://example.com/wp-json/tribe/views/v2/html"}
      </script>
      <a href="/show/first-show-slug/" class="tribe-event-url">First Show</a>
      <a href="/show/second-show-slug/2026-08-22/" class="tribe-event-url">Second Show</a>
    </div>
  </body>
</html>
`;

const VIEWS_V2_FRAGMENT_HTML = `
<div class="tribe-events-calendar-month">
  <a href="/show/first-show-slug/2026-08-01/">First Show</a>
  <a href="/show/second-show-slug/2026-08-22/">Second Show</a>
  <a href="/show/first-show-slug/2026-09-01/">First Show (recurring)</a>
  <a href="/organizer/dj-slug/">Not a show link</a>
</div>
`;

describe("extractViewsTokens", () => {
  it("extracts tvn1/tvn2 from an organizer page's inline JSON blob", () => {
    expect(extractViewsTokens(ORGANIZER_PAGE_HTML)).toEqual({
      tvn1: "abc123nonce",
      tvn2: "def456nonce",
    });
  });

  it("returns null when tvn1 is missing", () => {
    const html = `{"tvn2":"def456nonce"}`;
    expect(extractViewsTokens(html)).toBeNull();
  });

  it("returns null when tvn2 is missing", () => {
    const html = `{"tvn1":"abc123nonce"}`;
    expect(extractViewsTokens(html)).toBeNull();
  });

  it("returns null for HTML with no token blob at all", () => {
    expect(
      extractViewsTokens("<html><body>No tokens here</body></html>"),
    ).toBeNull();
  });

  it("tolerates empty token values", () => {
    const html = `{"tvn1":"","tvn2":""}`;
    expect(extractViewsTokens(html)).toEqual({ tvn1: "", tvn2: "" });
  });
});

describe("extractShowSlugsFromHtml", () => {
  it("extracts show slugs from an organizer page, ignoring dated permalinks", () => {
    expect(extractShowSlugsFromHtml(ORGANIZER_PAGE_HTML)).toEqual([
      "first-show-slug",
      "second-show-slug",
    ]);
  });

  it("deduplicates repeated slugs across recurring event links", () => {
    expect(extractShowSlugsFromHtml(VIEWS_V2_FRAGMENT_HTML)).toEqual([
      "first-show-slug",
      "second-show-slug",
    ]);
  });

  it("ignores links that don't match the /show/<slug>/ pattern", () => {
    expect(extractShowSlugsFromHtml(VIEWS_V2_FRAGMENT_HTML)).not.toContain(
      "dj-slug",
    );
  });

  it("returns an empty array when there are no show links", () => {
    expect(
      extractShowSlugsFromHtml("<html><body>Nothing here</body></html>"),
    ).toEqual([]);
  });

  it("respects the limit parameter", () => {
    const manySlugsHtml = Array.from(
      { length: 30 },
      (_, i) => `<a href="/show/slug-${i}/">Show ${i}</a>`,
    ).join("\n");

    expect(extractShowSlugsFromHtml(manySlugsHtml, 5)).toHaveLength(5);
  });

  it("handles slugs containing hyphens and numbers", () => {
    const html = `<a href="/show/the-punters-club-25th-april-2026/">Show</a>`;
    expect(extractShowSlugsFromHtml(html)).toEqual([
      "the-punters-club-25th-april-2026",
    ]);
  });
});
