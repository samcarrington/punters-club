import generatedShowsData from "../data/shows.generated.json";
import { SITE } from "../lib/constants";
import type { Show } from "../lib/mixcloud";
import { assertValidShowSlugs } from "../lib/shows";
import { buildSitemapXml } from "../lib/sitemap";

export function GET({ site }: { site?: URL }) {
  assertValidShowSlugs(generatedShowsData as Show[]);

  const baseUrl = site ?? new URL(SITE.url);

  return new Response(
    buildSitemapXml({
      siteUrl: baseUrl.toString(),
      generatedAt: new Date(),
      shows: generatedShowsData as Show[],
    }),
    {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
      },
    },
  );
}
