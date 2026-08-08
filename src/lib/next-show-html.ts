/**
 * HTML scraping helpers used to discover next-show events from The Events
 * Calendar's server-rendered pages when the JSON API doesn't surface them
 * directly (organizer pages, views-v2 fragments). These are the most
 * brittle part of the discovery pipeline - a markup change on the WordPress
 * side breaks them silently - so they're isolated here and tested against
 * fixture HTML.
 */

export type ViewsTokens = { tvn1: string; tvn2: string };

/** Extracts the views-v2 "tvn1"/"tvn2" nonce tokens embedded in an organizer page's inline script. */
export const extractViewsTokens = (html: string): ViewsTokens | null => {
  const tvn1 = html.match(/"tvn1":"([^"]*)"/);
  const tvn2 = html.match(/"tvn2":"([^"]*)"/);

  if (!tvn1 || !tvn2) {
    return null;
  }

  return { tvn1: tvn1[1], tvn2: tvn2[1] };
};

/** Extracts unique show slugs from `/show/<slug>/` links in rendered TEC HTML. */
export const extractShowSlugsFromHtml = (
  html: string,
  limit = 20,
): string[] => {
  const matches = html.matchAll(
    /\/show\/([^/"'#?]+)(?:\/\d{4}-\d{2}-\d{2})?\//g,
  );
  const slugs = new Set<string>();

  for (const match of matches) {
    const slug = match[1];
    if (!slug) continue;
    slugs.add(slug);
    if (slugs.size >= limit) break;
  }

  return [...slugs];
};
