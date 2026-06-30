import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Playlist } from "../src/lib/playlist";
import {
  buildSpotifyOEmbedUrl,
  isSpotifyUrl,
  normalizePlaylist,
} from "../src/lib/spotify";
import {
  buildTidalEmbedUrl,
  extractTidalPlaylistId,
  isTidalUrl,
  normalizeTidalPlaylist,
  scrapeTidalThumbnail,
} from "../src/lib/tidal";

const sourcePath = resolve("src/data/playlist-sources.json");
const generatedPath = resolve("src/data/playlists.generated.json");

const readJson = async <T>(path: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return null;
  }
};

const main = async () => {
  const sources = (await readJson<Playlist[]>(sourcePath)) ?? [];
  const previous = (await readJson<Playlist[]>(generatedPath)) ?? [];
  const previousByUrl = new Map(
    previous.map((playlist) => [playlist.url, playlist]),
  );

  const enrichSpotify = async (
    source: Playlist,
    previousByUrl: Map<string, Playlist>,
  ) => {
    try {
      const response = await fetch(buildSpotifyOEmbedUrl(source.url));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const oembed = (await response.json()) as Record<string, unknown>;
      return normalizePlaylist(source, oembed);
    } catch {
      return previousByUrl.get(source.url) ?? normalizePlaylist(source);
    }
  };

  const enrichTidal = async (
    source: Playlist,
    previousByUrl: Map<string, Playlist>,
  ) => {
    const playlistId = extractTidalPlaylistId(source.url);
    if (!playlistId) {
      return previousByUrl.get(source.url) ?? normalizeTidalPlaylist(source);
    }
    try {
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
    } catch {
      return previousByUrl.get(source.url) ?? normalizeTidalPlaylist(source);
    }
  };

  const generated = await Promise.all(
    sources.map(async (source) => {
      if (isSpotifyUrl(source.url)) return enrichSpotify(source, previousByUrl);
      if (isTidalUrl(source.url)) return enrichTidal(source, previousByUrl);
      return previousByUrl.get(source.url) ?? source;
    }),
  );

  await writeFile(generatedPath, `${JSON.stringify(generated, null, 2)}\n`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
