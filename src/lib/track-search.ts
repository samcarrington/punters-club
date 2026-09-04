import type { Show } from "./mixcloud";

export type TrackAppearance = {
  showTitle: string;
  showPath: string;
  position: number;
};

export type TrackSearchEntry = {
  artist: string;
  title: string;
  appearances: TrackAppearance[];
};

export type TrackSearchResponse = {
  version: 1;
  entries: TrackSearchEntry[];
};

const combiningMarks = /\p{M}/gu;
const whitespace = /\s+/g;

export const normalizeSearchText = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(combiningMarks, "")
    .toLocaleLowerCase("en-GB")
    .replace(whitespace, " ")
    .trim();

const entryKey = (artist: string, title: string) =>
  `${normalizeSearchText(artist)}\u0000${normalizeSearchText(title)}`;

export const buildTrackSearchIndex = (
  shows: readonly Show[],
): TrackSearchEntry[] => {
  const entries = new Map<string, TrackSearchEntry>();

  for (const show of shows) {
    const slug = show.slug?.trim();
    if (!slug || !show.tracklist) continue;

    for (const track of show.tracklist) {
      const artist = track.artist.trim();
      const title = track.title.trim();
      if (!artist || !title) continue;

      const key = entryKey(artist, title);
      const entry = entries.get(key) ?? {
        artist,
        title,
        appearances: [],
      };
      const appearance = {
        showTitle: show.title,
        showPath: `/shows/${slug}/`,
        position: track.position,
      };

      if (
        !entry.appearances.some(
          (existing) =>
            existing.showPath === appearance.showPath &&
            existing.position === appearance.position,
        )
      ) {
        entry.appearances.push(appearance);
      }

      entries.set(key, entry);
    }
  }

  return [...entries.values()].sort(
    (left, right) =>
      left.artist.localeCompare(right.artist, "en-GB") ||
      left.title.localeCompare(right.title, "en-GB"),
  );
};

const matchScore = (entry: TrackSearchEntry, query: string): number | null => {
  const artist = normalizeSearchText(entry.artist);
  const title = normalizeSearchText(entry.title);

  if (artist === query || title === query) return 0;
  if (artist.startsWith(query) || title.startsWith(query)) return 1;
  if (artist.includes(query) || title.includes(query)) return 2;

  const combined = `${artist} ${title}`;
  const tokens = query.split(" ").filter(Boolean);
  return tokens.every((token) => combined.includes(token)) ? 3 : null;
};

export const searchTrackIndex = (
  entries: readonly TrackSearchEntry[],
  value: string,
  limit = 8,
): TrackSearchEntry[] => {
  const query = normalizeSearchText(value);
  if (query.length < 2 || limit <= 0) return [];

  return entries
    .map((entry) => ({ entry, score: matchScore(entry, query) }))
    .filter(
      (candidate): candidate is { entry: TrackSearchEntry; score: number } =>
        candidate.score !== null,
    )
    .sort(
      (left, right) =>
        left.score - right.score ||
        right.entry.appearances.length - left.entry.appearances.length ||
        left.entry.artist.localeCompare(right.entry.artist, "en-GB") ||
        left.entry.title.localeCompare(right.entry.title, "en-GB"),
    )
    .slice(0, limit)
    .map(({ entry }) => entry);
};
