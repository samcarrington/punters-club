import { SITE } from "./constants";
import type { Show } from "./mixcloud";
import { xmlEscape } from "./xml";

type SitemapChangeFrequency = "weekly" | "monthly";

type SitemapEntry = {
  url: string;
  lastmod: string;
  changefreq: SitemapChangeFrequency;
  priority: "1.0" | "0.8" | "0.6";
};

type BuildSitemapOptions = {
  siteUrl: string;
  generatedAt: Date;
  shows: Show[];
};

const dateOnly = (value: Date): string => value.toISOString().slice(0, 10);

const dateOnlyFromOptionalIso = (value: string | undefined, fallback: Date) => {
  const parsed = value ? new Date(value) : null;
  return parsed && Number.isFinite(parsed.getTime())
    ? dateOnly(parsed)
    : dateOnly(fallback);
};

const sitemapEntry = ({ url, lastmod, changefreq, priority }: SitemapEntry) => `  <url>
    <loc>${xmlEscape(url)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;

export const buildSitemapXml = ({
  siteUrl,
  generatedAt,
  shows,
}: BuildSitemapOptions): string => {
  const baseUrl = new URL(siteUrl);
  const generatedDate = dateOnly(generatedAt);
  const entries: SitemapEntry[] = [
    {
      url: new URL(SITE.homePath, baseUrl).toString(),
      lastmod: generatedDate,
      changefreq: "weekly",
      priority: "1.0",
    },
    {
      url: new URL(SITE.showsPath, baseUrl).toString(),
      lastmod: generatedDate,
      changefreq: "monthly",
      priority: "0.8",
    },
    ...shows.flatMap((show) =>
      show.slug
        ? [
            {
              url: new URL(`${SITE.showsPath}${show.slug}/`, baseUrl).toString(),
              lastmod: dateOnlyFromOptionalIso(show.publishedAt, generatedAt),
              changefreq: "monthly" as const,
              priority: "0.6" as const,
            },
          ]
        : [],
    ),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(sitemapEntry).join("\n")}
</urlset>
`;
};
