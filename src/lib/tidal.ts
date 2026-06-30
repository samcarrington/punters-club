import type { Playlist, PlaylistSource } from "./playlist";

export const isTidalUrl = (url: string) => {
  try {
    return new URL(url).hostname === "tidal.com";
  } catch {
    return false;
  }
};

/** Extract the playlist ID from a tidal.com/playlist/{id} URL. */
export const extractTidalPlaylistId = (url: string): string | null => {
  try {
    const match = new URL(url).pathname.match(/^\/playlist\/([a-f0-9-]+)/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
};

/** Build the embed page URL for a Tidal playlist ID. */
export const buildTidalEmbedUrl = (playlistId: string) =>
  `https://embed.tidal.com/playlists/${playlistId}`;

/**
 * Scrape the playlist artwork URL from a Tidal embed page HTML response.
 * Skips the inline SVG loader and returns the first content image.
 */
export const scrapeTidalThumbnail = (html: string): string | null => {
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
  for (;;) {
    const match = imgRegex.exec(html);
    if (!match) break;
    const src = match[1];
    // Skip inline SVGs (loader placeholders)
    if (src.endsWith(".svg") || src.includes("/embed-resources/")) continue;
    // Return the first real content image
    return src;
  }
  return null;
};

export const normalizeTidalPlaylist = (
  source: PlaylistSource,
  thumbnailUrl?: string,
): Playlist => ({
  ...source,
  provider_name: "Tidal",
  thumbnail_url: thumbnailUrl,
});
