import { describe, expect, it } from "vitest";

import { buildSitemapXml } from "./sitemap";

describe("buildSitemapXml", () => {
  it("emits homepage, shows index, and show detail metadata", () => {
    const xml = buildSitemapXml({
      siteUrl: "https://punters.club",
      generatedAt: new Date("2026-07-09T12:34:56Z"),
      shows: [
        {
          title: "Encoded & Show",
          url: "https://www.mixcloud.com/radiowaters/encoded-show/",
          slug: "encoded-show",
          publishedAt: "2026-03-28T21:22:24Z",
        },
      ],
    });

    expect(xml).toContain("<loc>https://punters.club/</loc>");
    expect(xml).toContain("<lastmod>2026-07-09</lastmod>");
    expect(xml).toContain("<changefreq>weekly</changefreq>");
    expect(xml).toContain("<priority>1.0</priority>");

    expect(xml).toContain("<loc>https://punters.club/shows/</loc>");
    expect(xml).toContain("<changefreq>monthly</changefreq>");
    expect(xml).toContain("<priority>0.8</priority>");

    expect(xml).toContain("<loc>https://punters.club/shows/encoded-show/</loc>");
    expect(xml).toContain("<lastmod>2026-03-28</lastmod>");
    expect(xml).toContain("<priority>0.6</priority>");
  });
});
