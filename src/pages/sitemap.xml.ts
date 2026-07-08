import generatedShowsData from "../data/shows.generated.json";
import type { Show } from "../lib/mixcloud";
import { assertValidShowSlugs } from "../lib/shows";
import { xmlEscape } from "../lib/xml";

const DEFAULT_SITE_URL = "https://punters.club";

const sitemapEntry = (url: string, changefreq: "weekly" | "monthly") => `  <url>
    <loc>${xmlEscape(url)}</loc>
    <changefreq>${changefreq}</changefreq>
  </url>`;

export function GET({ site }: { site?: URL }) {
  assertValidShowSlugs(generatedShowsData as Show[]);

  const baseUrl = site ?? new URL(DEFAULT_SITE_URL);
  const showUrls = (generatedShowsData as Show[]).flatMap((show) =>
    show.slug ? [new URL(`/shows/${show.slug}/`, baseUrl).toString()] : [],
  );

  const entries = [
    sitemapEntry(new URL("/", baseUrl).toString(), "weekly"),
    sitemapEntry(new URL("/shows/", baseUrl).toString(), "monthly"),
    ...showUrls.map((url) => sitemapEntry(url, "monthly")),
  ];

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`,
    {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
      },
    },
  );
}
