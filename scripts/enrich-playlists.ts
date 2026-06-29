import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildSpotifyOEmbedUrl, isSpotifyUrl, normalizePlaylist, type Playlist } from '../src/lib/spotify';

const sourcePath = resolve('src/data/playlist-sources.json');
const generatedPath = resolve('src/data/playlists.generated.json');

const readJson = async <T>(path: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return null;
  }
};

const main = async () => {
  const sources = (await readJson<Playlist[]>(sourcePath)) ?? [];
  const previous = (await readJson<Playlist[]>(generatedPath)) ?? [];
  const previousByUrl = new Map(previous.map((playlist) => [playlist.url, playlist]));

  const generated = await Promise.all(
    sources.map(async (source) => {
      if (!isSpotifyUrl(source.url)) {
        return previousByUrl.get(source.url) ?? normalizePlaylist(source);
      }

      try {
        const response = await fetch(buildSpotifyOEmbedUrl(source.url));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const oembed = (await response.json()) as Record<string, unknown>;
        return normalizePlaylist(source, oembed);
      } catch {
        return previousByUrl.get(source.url) ?? normalizePlaylist(source);
      }
    }),
  );

  await writeFile(generatedPath, `${JSON.stringify(generated, null, 2)}\n`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
