import type { Show, ShowSource } from "./mixcloud";

export type ShowWithTracklist = Show & {
  tracklist?: ShowSource["tracklist"];
};

export type ShowSort = "newest" | "oldest" | "listens-high" | "listens-low";

const urlKey = (value?: string) => value?.trim().toLowerCase();
const slugKey = (value?: string) => value?.trim().toLowerCase();

const compareText = (left?: string, right?: string) =>
  (left ?? "").localeCompare(right ?? "");

const compareNumber = (
  left: number | undefined,
  right: number | undefined,
  direction: "asc" | "desc",
) => {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return direction === "asc" ? left - right : right - left;
};

const compareDate = (
  left: string | undefined,
  right: string | undefined,
  direction: "asc" | "desc",
) => {
  const leftTime = left ? Date.parse(left) : Number.NaN;
  const rightTime = right ? Date.parse(right) : Number.NaN;
  const leftValid = Number.isFinite(leftTime);
  const rightValid = Number.isFinite(rightTime);

  if (!leftValid && !rightValid) return 0;
  if (!leftValid) return 1;
  if (!rightValid) return -1;

  return direction === "asc" ? leftTime - rightTime : rightTime - leftTime;
};

export const mergeShowsWithSources = (
  generatedShows: Show[],
  sourceShows: ShowSource[],
): ShowWithTracklist[] => {
  const sourceByUrl = new Map<string, ShowSource>();
  const sourceBySlug = new Map<string, ShowSource>();

  for (const source of sourceShows) {
    const normalizedUrl = urlKey(source.url);
    if (normalizedUrl) sourceByUrl.set(normalizedUrl, source);

    const slugFromUrl = slugKey(
      new URL(source.url).pathname.split("/").filter(Boolean).at(-1),
    );
    if (slugFromUrl && !sourceBySlug.has(slugFromUrl)) {
      sourceBySlug.set(slugFromUrl, source);
    }
  }

  return generatedShows.map((show) => {
    const matchedSource =
      (show.url ? sourceByUrl.get(urlKey(show.url) ?? "") : undefined) ??
      (show.slug ? sourceBySlug.get(slugKey(show.slug) ?? "") : undefined);

    return matchedSource?.tracklist
      ? { ...show, tracklist: matchedSource.tracklist }
      : { ...show };
  });
};

export const sortShows = (
  shows: ShowWithTracklist[],
  sort: ShowSort,
): ShowWithTracklist[] => {
  const sorted = [...shows];

  sorted.sort((left, right) => {
    const primary =
      sort === "newest"
        ? compareDate(left.publishedAt, right.publishedAt, "desc")
        : sort === "oldest"
          ? compareDate(left.publishedAt, right.publishedAt, "asc")
          : sort === "listens-high"
            ? compareNumber(left.playCount, right.playCount, "desc")
            : compareNumber(left.playCount, right.playCount, "asc");

    if (primary !== 0) return primary;

    const byDate = compareDate(left.publishedAt, right.publishedAt, "desc");
    if (byDate !== 0) return byDate;

    return compareText(
      left.slug ?? left.url ?? left.title,
      right.slug ?? right.url ?? right.title,
    );
  });

  return sorted;
};

export const assertValidShowSlugs = (shows: Show[]): void => {
  const seen = new Map<string, string>();

  for (const show of shows) {
    if (!show.slug?.trim()) {
      throw new Error(
        `Generated show is missing a slug: ${show.title} (${show.url})`,
      );
    }

    const normalizedSlug = slugKey(show.slug)!;
    const existingUrl = seen.get(normalizedSlug);
    if (existingUrl) {
      throw new Error(
        `Duplicate generated show slug "${show.slug}" for URLs ${existingUrl} and ${show.url}`,
      );
    }

    seen.set(normalizedSlug, show.url);
  }
};
