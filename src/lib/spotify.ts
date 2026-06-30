import type { Playlist, PlaylistSource } from "./playlist";

export type { Playlist, PlaylistSource };

export const buildSpotifyOEmbedUrl = (url: string) =>
  `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;

export const isSpotifyUrl = (url: string) => {
  try {
    return new URL(url).host === "open.spotify.com";
  } catch {
    return false;
  }
};

export const normalizePlaylist = (
  source: PlaylistSource,
  oembed?: Record<string, unknown>,
): Playlist => ({
  ...source,
  title: source.title,
  author_name: oembed?.author_name as string | undefined,
  provider_name: oembed?.provider_name as string | undefined,
  thumbnail_url: oembed?.thumbnail_url as string | undefined,
  thumbnail_width:
    typeof oembed?.thumbnail_width === "number"
      ? oembed.thumbnail_width
      : undefined,
  thumbnail_height:
    typeof oembed?.thumbnail_height === "number"
      ? oembed.thumbnail_height
      : undefined,
});
