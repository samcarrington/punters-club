import type { Normalizer } from "./normalizer";
import type { Playlist, PlaylistSource } from "./playlist";

export const buildSpotifyOEmbedUrl = (url: string) =>
  `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;

export const normalizePlaylist: Normalizer<
  PlaylistSource,
  Record<string, unknown>,
  Playlist
> = (source, oembed) => ({
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
