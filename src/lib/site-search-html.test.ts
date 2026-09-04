import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFile(resolve(path), "utf8");

describe("global site search markup", () => {
  it("mounts one search utility in the shared header", async () => {
    const header = await readSource("src/components/AppHeader.astro");

    expect(header.match(/<SiteSearch \/>/g)).toHaveLength(1);
    expect(header).toContain('aria-controls="primary-nav-links"');
    expect(header).toContain('aria-expanded="false"');
  });

  it("provides a labelled native dialog and explicit close control", async () => {
    const search = await readSource("src/components/SiteSearch.astro");

    expect(search.match(/<dialog/g)).toHaveLength(1);
    expect(search).toContain('aria-labelledby="site-search-title"');
    expect(search).toContain('aria-label="Close search"');
    expect(search).toContain('aria-live="polite"');
  });

  it("renders the track title first and emphasises it above the artist", async () => {
    const [search, styles] = await Promise.all([
      readSource("src/components/SiteSearch.astro"),
      readSource("src/styles/global.css"),
    ]);

    expect(search).toContain("record.append(title, artist)");
    expect(styles).toMatch(
      /\.site-search-track-title\s*{[^}]*font-weight:\s*var\(--font-weight-title\)/s,
    );
  });

  it("does not mount search inside the archive page", async () => {
    const archive = await readSource("src/pages/shows/index.astro");

    expect(archive).not.toMatch(/SiteSearch|TrackSearch|data-site-search/);
  });

  it("keeps analytics behind the consent-aware bridge", async () => {
    const search = await readSource("src/components/SiteSearch.astro");

    expect(search).toContain("puntersAnalytics?.track(event)");
    expect(search).not.toMatch(/dataLayer\.push|\bgtag\s*\(/);
  });
});
