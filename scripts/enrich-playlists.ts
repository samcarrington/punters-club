import { resolve } from "node:path";
import { detectPlatform } from "../src/lib/platform";
import type { Playlist } from "../src/lib/playlist";
import { buildSpotifyOEmbedUrl, normalizePlaylist } from "../src/lib/spotify";
import {
  buildTidalEmbedUrl,
  extractTidalPlaylistId,
  normalizeTidalPlaylist,
  scrapeTidalThumbnail,
} from "../src/lib/tidal";
import { fetchWithFallback, readJson, writeJson } from "./lib/enrich-utils";

const sourcePath = resolve("src/data/playlist-sources.json");
const generatedPath = resolve("src/data/playlists.generated.json");

const main = async () => {
  const sources = (await readJson<Playlist[]>(sourcePath)) ?? [];
  const previous = (await readJson<Playlist[]>(generatedPath)) ?? [];
  const previousByUrl = new Map(
    previous.map((playlist) => [playlist.url, playlist]),
  );

  const enrichSpotify = (source: Playlist) =>
    fetchWithFallback({
      label: "enrich-playlists",
      identify: source.url,
      fetchAndNormalize: async () => {
        const response = await fetch(buildSpotifyOEmbedUrl(source.url));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const oembed = (await response.json()) as Record<string, unknown>;
        return normalizePlaylist(source, oembed);
      },
      fallback: () =>
        previousByUrl.get(source.url) ?? normalizePlaylist(source),
    });

  const enrichTidal = (source: Playlist) => {
    const playlistId = extractTidalPlaylistId(source.url);
    if (!playlistId) {
      console.warn(
        `[enrich-playlists] could not extract a Tidal playlist id from ${source.url}, using stale fallback.`,
      );
      return previousByUrl.get(source.url) ?? normalizeTidalPlaylist(source);
    }

    return fetchWithFallback({
      label: "enrich-playlists",
      identify: source.url,
      fetchAndNormalize: async () => {
        const embedUrl = buildTidalEmbedUrl(playlistId);
        console.log(
          `Fetching Tidal embed page for ${source.title} (${embedUrl})`,
        );
        const response = await fetch(embedUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        const thumbnailUrl = scrapeTidalThumbnail(html) ?? undefined;
        console.log(
          `Scraped thumbnail URL for ${source.title}: ${thumbnailUrl ?? "none"}`,
        );

        return normalizeTidalPlaylist(source, thumbnailUrl);
      },
      fallback: () =>
        previousByUrl.get(source.url) ?? normalizeTidalPlaylist(source),
    });
  };

  const generated = await Promise.all(
    sources.map((source) => {
      const platform = detectPlatform(source.url);
      if (platform === "spotify") return enrichSpotify(source);
      if (platform === "tidal") return enrichTidal(source);
      return previousByUrl.get(source.url) ?? source;
    }),
  );

  await writeJson(generatedPath, generated);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
